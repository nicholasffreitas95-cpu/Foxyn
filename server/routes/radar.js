// ============================================================
// FOXYN - Radar de Preços
// Fontes reais, em ordem de preferência:
//   1) PRICE_SOURCE=lojas -> scraping direto de Kabum + Terabyte
//      (preços reais, sem chave) - implementado em price-scraper.js.
//   2) PRICE_SOURCE=mercadolivre -> API pública e gratuita do Mercado
//      Livre (api.mercadolibre.com), SEM chave.
//   3) PRICE_API_URL (genérico/trocar) -> qualquer endpoint JSON.
// Falhou a fonte real? Serve dados locais de demonstração (honesto,
// com a origem sinalizada na resposta).
// ============================================================
import { Router } from "express";
import db from "../db.js";
import { authRequired } from "../auth-middleware.js";
import { assertLimit } from "../plans.js";
import { scrapeStores } from "../price-scraper.js";
import { evaluateAndUnlock } from "../achievements.js";

const router = Router();

// ---------- Normalização: converte qualquer fonte para o formato FOXYN ----------
function normalize(item) {
  const price = Number(item.priceCents ?? item.price_cents ?? null);
  if (!(price > 0)) return null;
  const prev = Number(item.prevCents ?? item.prev_cents ?? null);
  const trend = prev > 0 ? ((price - prev) / prev) * 100 : (item.trend ?? 0);
  return {
    id: String(item.id ?? item.url_key ?? (item.name ? "local-" + item.name : "item")),
    name: item.name ?? item.title ?? "Produto",
    brand: item.brand ?? item.seller?.nickname ?? item.brand_name ?? "",
    desc: item.desc ?? null,
    priceCents: Math.round(price),
    prevCents: prev > 0 ? Math.round(prev) : null,
    store: item.store ?? item.seller?.nickname ?? "Mercado Livre",
    stock: item.stock !== undefined ? !!item.stock : !(item.available_quantity === 0),
    trend: Math.round(isFinite(trend) ? trend : 0),
    permalink: item.permalink ?? item.url ?? null
  };
}

// ---------- Fonte 1: Mercado Livre (pública, gratuita, sem chave) ----------
async function fetchMercadoLivre(query) {
  const search = async (text) => {
    const url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(text)}&limit=24`;
    const r = await fetch(url, {
      headers: {
        "User-Agent": "FOXYN/1.0 (radar de precos; contato admin@foxyn.app)"
      }
    });
    if (!r.ok) throw new Error("ML http " + r.status);
    const json = await r.json();
    const results = Array.isArray(json.results) ? json.results : [];
    return results
      .map((it) =>
        normalize({
          id: it.id,
          name: it.title,
          priceCents: Math.round(Number(it.price) * 100),
          prevCents: it.original_price ? Math.round(Number(it.original_price) * 100) : null,
          store: "Mercado Livre",
          stock: it.available_quantity != null ? it.available_quantity > 0 : true,
          seller: it.seller || {},
          permalink: it.permalink
        })
      )
      .filter(Boolean);
  };

  // Nova busca explícita -> uma busca
  if (query) return await search(query);

  // Carga inicial sem busca -> busca um catálogo de hardware (GPU/CPU/RAM/SSD)
  const defaultQueries = ["placa de video", "processador intel", "memoria ram ddr5", "ssd nvme"];
  const seen = new Map();
  for (const q of defaultQueries) {
    try {
      const items = await search(q);
      for (const it of items) if (!seen.has(it.id)) seen.set(it.id, it);
    } catch { /* ignora falha individual */ }
  }
  return Array.from(seen.values()).slice(0, 24);
}

// ---------- Fonte 2: PRICE_API_URL (genérico) ----------
async function fetchExternal(query) {
  const base = process.env.PRICE_API_URL;
  const key = process.env.PRICE_API_KEY;
  if (!base) return null;
  const url = new URL(base);
  if (query) url.searchParams.set("q", query);
  if (key) url.searchParams.set("key", key);
  const r = await fetch(url.toString());
  if (!r.ok) return null;
  const json = await r.json();
  return (Array.isArray(json) ? json : json.products ?? json.results ?? [])
    .map(normalize)
    .filter(Boolean);
}

// Lista de ofertas (Radar)
router.get("/products", authRequired, async (req, res) => {
  const { q } = req.query;

  // Limite de pesquisas (plano  grátis) - aplicado só ao pesquisar
  let newUnlocks = [];
  if (q) {
    const lim = assertLimit(db, req.user, "price_search");
    if (!lim.ok) return res.status(429).json({ error: "limite", detail: lim });
    db.addEvent(req.user.id, "produto_pesquisado", { q });
    // Busca é uma ação -> reavalia conquistas (Ultimate)
    newUnlocks = evaluateAndUnlock(db, req.user);
  }

  const source = process.env.PRICE_SOURCE || "lojas";

  try {
    // 1) Tenta a fonte real configurada
    let products = null;
    if (source === "lojas") {
      products = await scrapeStores(q);
      products = products.filter(Boolean);
      if (products.length) {
        products.forEach((p) => {
          const prev = db.getProduct(p.id);
          db.upsertProduct({
            id: p.id, name: p.name, brand: p.brand, priceCents: p.priceCents,
            prevCents: p.prevCents || p.priceCents, store: p.store,
            stock: p.stock, trend: p.trend
          });
          if (!prev || prev.price_cents !== p.priceCents) db.addPricePoint(p.id, p.priceCents);
        });
        return res.json({ source: "lojas", products, newUnlocks });
      }
    } else if (source === "mercadolivre") {
      products = await fetchMercadoLivre(q);
      products = products.filter(Boolean);
      if (products.length) {
        products.forEach((p) => {
          const prev = db.getProduct(p.id);
          db.upsertProduct({
            id: p.id, name: p.name, brand: p.brand, priceCents: p.priceCents,
            prevCents: p.prevCents || p.priceCents, store: p.store,
            stock: p.stock, trend: p.trend
          });
          if (!prev || prev.price_cents !== p.priceCents) db.addPricePoint(p.id, p.priceCents);
        });
        return res.json({ source: "mercadolivre", products, newUnlocks });
      }
    } else if (source === "generic") {
      const ext = await fetchExternal(q);
      if (ext && ext.length) {
        ext.forEach((p) => {
          db.upsertProduct({
            id: p.id, name: p.name, brand: p.brand, priceCents: p.priceCents,
            prevCents: p.prevCents || p.priceCents, store: p.store,
            stock: p.stock, trend: p.trend
          });
        });
        return res.json({ source: "generic", products: ext, newUnlocks });
      }
    }
    // fonte real indisponível -> segue pro fallback local
  } catch {
    // qualquer erro vira fallback local honesto
  }

  // 2) Fallback local (demonstração)
  let products = db.listProducts();
  if (q) {
    const lq = q.toLowerCase();
    products = products.filter((p) => (p.name || "").toLowerCase().includes(lq));
  }
  return res.json({ source: "local", products, newUnlocks });
});

// Histórico de preços (gráficos)
router.get("/products/:id/history", authRequired, (req, res) => {
  const rows = db.getPriceHistory(req.params.id);
  return res.json({ source: "local", history: rows });
});

// Monitorar / desmonitorar
router.post("/products/:id/monitor", authRequired, (req, res) => {
  const { targetCents } = req.body || {};
  const existing = db.listMonitored(req.user.id).find((m) => m.product_id === req.params.id);
  if (existing) return res.json({ ok: true, monitored: true, newUnlocks: [] });

  const lim = assertLimit(db, req.user, "monitored");
  if (!lim.ok) return res.status(429).json({ error: "limite", detail: lim });

  db.addMonitored(req.user.id, req.params.id, targetCents || null);
  db.addEvent(req.user.id, "produto_monitorado", { productId: req.params.id });
  const newUnlocks = evaluateAndUnlock(db, req.user);
  return res.status(201).json({ ok: true, monitored: true, newUnlocks });
});

router.delete("/products/:id/monitor", authRequired, (req, res) => {
  db.removeMonitored(req.user.id, req.params.id);
  return res.json({ ok: true, monitored: false });
});

// Meus monitoramentos
router.get("/monitored", authRequired, (req, res) => {
  const ids = db.listMonitored(req.user.id);
  const items = ids
    .map((m) => ({ ...m, product: db.getProduct(m.product_id) }))
    .filter((m) => m.product);
  return res.json(items);
});

export default router;
