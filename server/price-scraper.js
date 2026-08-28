// ============================================================
// FOXYN - Scraper de preços reais (Kabum + Terabyte)
// Busca individual, extrai nome/preço/link, sem Pichau (bloqueio
// anti-bot 403 em IP de datacenter).
// Fontes:
//   Kabum    -> HTML contém os dados no script #__NEXT_DATA__ (JSON).
//               Paramos o JSON em vez do DOM (que é carregado por JS).
//   Terabyte -> HTML estático com cards (.product-item) e preço no
//               atributo data-tss-price.
// Qualquer falha lança erro -> o chamador cai no fallback local honesto.
// ============================================================
import * as cheerio from "cheerio";

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

const reFloat = /[0-9]+(?:[.,][0-9]+)?/;

// "R$ 4.399,99" ou "4399.99" -> centavos inteiros
function centsFromText(text, fallbackNum = null) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (!s) return fallbackNum != null ? Math.round(fallbackNum * 100) : null;
  // remove tudo exceto dígitos, ',' e '.'
  const cleaned = s.replace(/[^0-9.,]/g, "");
  const m = cleaned.match(reFloat);
  if (!m) {
    if (fallbackNum != null) return Math.round(fallbackNum * 100);
    // tenta num já numérico (ex.: data-tss-price="4399.99")
    const n = parseFloat(s);
    return isFinite(n) ? Math.round(n * 100) : null;
  }
  let raw = m[0];
  // último separador é a vírgula decimal; pontos são milhar
  if (/,\d{1,2}$/.test(raw)) raw = raw.replace(/\./g, "").replace(",", ".");
  else raw = raw.replace(/,/g, "");
  const n = parseFloat(raw);
  if (!isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function normId(store, seed) {
  // id estável e único por loja: "kabum-<code>" / "tera-<slug>"
  const clean = String(seed || "").replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 80);
  return `${store}-${clean || "x"}`;
}

// ---------- Kabum: parse do JSON embutido (#__NEXT_DATA__) ----------
function parseKabum(html) {
  const $ = cheerio.load(html);
  let data = null;
  const raw = $("#__NEXT_DATA__").html();
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }
  if (!data) return [];

  const arr = data?.props?.pageProps?.data?.catalogServer?.data;
  if (!Array.isArray(arr)) return [];

  const results = [];
  const seen = new Set();
  for (const p of arr) {
    const price = centsFromText(null, p.price);
    if (!(price > 0)) continue; // sem preço -> ignora
    const code = String(p.code ?? "");
    const key = code || p.name || "";
    const id = normId("kabum", code || key);
    if (seen.has(id)) continue;
    seen.add(id);
    const url = `https://www.kabum.com.br/produto/${code}/${p.friendlyName || ""}`;
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

// ---------- Terabyte: parse do HTML estático (cards .product-item) ----------
function parseTerabyte(html) {
  const $ = cheerio.load(html);
  const results = [];
  const seen = new Set();
  $("div.product-item").each((_, card) => {
    const $card = $(card);
    const est = $card.attr("data-tss-estoque");
    if (est === "0") return; // esgotado -> ignora
    const priceAttr = $card.attr("data-tss-price");
    const $price = $card.find(".product-item__new-price span").first();
    const price = centsFromText($price.text(), parseFloat(priceAttr));
    if (!(price > 0)) return;
    const $name = $card.find("a.product-item__name").first();
    const name = $name.attr("title") || $name.find("h2").first().text() || "";
    const href = $name.attr("href") || $card.find("a.product-item__image").first().attr("href") || "";
    if (!name) return;
    const id = normId("tera", name);
    if (seen.has(id)) return;
    seen.add(id);
    const url = href.startsWith("http")
      ? href
      : `https://www.terabyteshop.com.br${href}`;
    const oldPrice = centsFromText(
      $card.find(".product-item__old-price del span").first().text(),
      null
    );
    results.push({
      id,
      name,
      brand: String($card.attr("data-tss-brand") || ""),
      priceCents: price,
      prevCents: oldPrice,
      store: "Terabyte",
      stock: true,
      trend: 0,
      permalink: url
    });
  });
  return results;
}

// ---------- Principal: busca nas lojas ----------
// query: termo de busca (obrigatório para scraping real)
export async function scrapeStores(query) {
  const term = String(query || "").trim();
  if (!term) return [];

  const slug = term.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const out = [];
  const seen = new Set();

  const jobs = [];
  if (slug) {
    jobs.push({
      store: "Kabum",
      run: async () => parseKabum(await getHtml(`https://www.kabum.com.br/busca/${slug}`))
    });
  }
  jobs.push({
    store: "Terabyte",
    run: async () => parseTerabyte(await getHtml(`https://www.terabyteshop.com.br/busca?str=${encodeURIComponent(term)}`))
  });

  const settled = await Promise.allSettled(jobs.map((j) => j.run()));
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
