// ============================================================
// FOXYN - Scraper de preços reais (Kabum + Terabyte)
// Busca individual, extrai nome/preço/link, sem Pichau (bloqueio
// anti-bot 403 em IP de datacenter).
// SEM dependências externas (parse com regex/string nativa) para
// manter o deploy em Render simples e sem módulos nativos.
// Fontes:
//   Kabum    -> dados no script #__NEXT_DATA__ (JSON embutido).
//   Terabyte -> HTML estático com cards "product-item" (preço no
//               atributo data-tss-price).
// Qualquer falha lança erro -> o chamador cai no fallback local honesto.
// ============================================================

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8"
};

const REQUEST_TIMEOUT = 15000;

async function getHtml(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT);
  try {
    const r = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
    if (!r.ok) throw new Error("http " + r.status);
    return await r.text();
  } finally {
    clearTimeout(timer);
  }
}

// "R$ 4.399,99" ou "4399.99" -> centavos inteiros
function centsFromText(text, fallbackNum = null) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  const m = s.match(/[0-9]+(?:[.,][0-9]+)?/);
  let cents = null;
  if (m) {
    let raw = m[0];
    // último separador é a vírgula decimal; pontos são milhar
    if (/,\d{1,2}$/.test(raw)) raw = raw.replace(/\./g, "").replace(",", ".");
    else raw = raw.replace(/,/g, "");
    const n = parseFloat(raw);
    if (isFinite(n) && n > 0) cents = Math.round(n * 100);
  }
  if (cents == null && fallbackNum != null && isFinite(fallbackNum) && fallbackNum > 0) {
    cents = Math.round(fallbackNum * 100);
  }
  return cents;
}

function normId(store, seed) {
  const clean = String(seed || "").replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 80);
  return `${store}-${clean || "x"}`;
}

function decodeHtmlEntities(s) {
  return String(s)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&iacute;/g, "í")
    .replace(/&eacute;/g, "é")
    .replace(/&atilde;/g, "ã")
    .replace(/&ccedil;/g, "ç")
    .replace(/&agrave;/g, "à")
    .replace(/&aacute;/g, "á")
    .replace(/&oacute;/g, "ó")
    .replace(/&uacute;/g, "ú")
    .replace(/&etilde;/g, "ẽ")
    .replace(/&otilde;/g, "õ");
}

// ---------- Kabum: parse do JSON embutido (#__NEXT_DATA__) ----------
function parseKabum(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m || !m[1]) return [];
  let data;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const arr = data?.props?.pageProps?.data?.catalogServer?.data;
  if (!Array.isArray(arr)) return [];

  const results = [];
  const seen = new Set();
  for (const p of arr) {
    const price = centsFromText(null, p.price);
    if (price == null) continue;
    const code = String(p.code ?? "");
    const key = code || p.name || "";
    const id = normId("kabum", code || key);
    if (seen.has(id)) continue;
    seen.add(id);
    const url = `https://www.kabum.com.br/produto/${code}/${(p.friendlyName || "").trim()}`;
    results.push({
      id,
      name: String(p.name || "Produto"),
      brand: String(p.brand?.name || p.brand || ""),
      priceCents: price,
      prevCents: centsFromText(null, p.oldPrice),
      store: "Kabum",
      stock: p.available ?? true,
      trend: 0,
      permalink: url
    });
  }
  return results;
}

// ---------- Terabyte: parse do HTML estático (cards product-item) ----------
// Separa a página em blocos por card (cards são irmãos em .tss-results-grid)
// e extrai os atributos/preço/nome/link de cada um.
function parseTerabyte(html) {
  const chunks = html.split('class="product-item"');
  const results = [];
  const seen = new Set();
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i];
    // ignora estocados? data-tss-estoque="0" = esgotado
    const est = chunk.match(/data-tss-estoque="(\d)"/);
    if (est && est[1] === "0") continue;

    const priceAttrMatch = chunk.match(/data-tss-price="([0-9.]+)"/);
    const priceNum = priceAttrMatch ? parseFloat(priceAttrMatch[1]) : NaN;

    const nameMatch = chunk.match(/class="product-item__name"[^>]*?\bhref="([^"]+)"[^>]*?\btitle="([^"]+)"/);
    const href = nameMatch ? nameMatch[1] : null;
    const title = nameMatch ? decodeHtmlEntities(nameMatch[2]) : "";

    const priceSpan = chunk.match(/class="product-item__new-price"[\s\S]*?<span>([^<]+)<\/span>/);
    const price = centsFromText(priceSpan ? priceSpan[1] : "", priceNum);
    if (price == null) continue;
    if (!title || !href) continue;

    const id = normId("tera", title);
    if (seen.has(id)) continue;
    seen.add(id);

    const oldPriceSpan = chunk.match(/class="product-item__old-price"[\s\S]*?<span>([^<]+)<\/span>/);
    const brandMatch = chunk.match(/data-tss-brand="([^"]*)"/);

    results.push({
      id,
      name: title,
      brand: brandMatch ? decodeHtmlEntities(brandMatch[1]) : "",
      priceCents: price,
      prevCents: centsFromText(oldPriceSpan ? oldPriceSpan[1] : "", null),
      store: "Terabyte",
      stock: true,
      trend: 0,
      permalink: href.startsWith("http") ? href : `https://www.terabyteshop.com.br${href}`
    });
  }
  return results;
}

// ---------- Principal: busca nas lojas ----------
export async function scrapeStores(query) {
  const term = String(query || "").trim();
  if (!term) return [];

  const slug = term.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  const jobs = [];
  if (slug) {
    jobs.push(async () =>
      parseKabum(await getHtml(`https://www.kabum.com.br/busca/${encodeURIComponent(slug)}`))
    );
  }
  jobs.push(async () =>
    parseTerabyte(await getHtml(`https://www.terabyteshop.com.br/busca?str=${encodeURIComponent(term)}`))
  );

  const out = [];
  const seen = new Set();
  const settled = await Promise.allSettled(jobs.map((j) => j()));
  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    for (const it of s.value) {
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      out.push(it);
    }
  }
  return out;
}
