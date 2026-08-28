// ============================================================
// FOXYN - Radar de Preços
// Usa API externa real se PRICE_API_URL estiver configurada;
// caso contrário, serve dados locais de demonstração (honesto).
// ============================================================
import { Router } from "express";
import db from "../db.js";
import { authRequired } from "../auth-middleware.js";
import { assertLimit } from "../plans.js";

const router = Router();

async function fetchExternal(query) {
  const base = process.env.PRICE_API_URL;
  const key = process.env.PRICE_API_KEY;
  if (!base) return null;
  const url = new URL(base);
  if (query) url.searchParams.set("q", query);
  if (key) url.searchParams.set("key", key);
  const r = await fetch(url.toString());
  if (!r.ok) return null;
  return r.json();
}

// Lista de ofertas (Radar)
router.get("/products", authRequired, async (req, res) => {
  const { q } = req.query;

  // Limite de pesquisas (plano  grátis) - aplicado só ao pesquisar
  if (q) {
    const lim = assertLimit(db, req.user, "price_search");
    if (!lim.ok) return res.status(429).json({ error: "limite", detail: lim });
    db.addEvent(req.user.id, "produto_pesquisado", { q });
  }

  // 1) Tenta API externa real
  const external = await fetchExternal(q).catch(() => null);
  if (external && Array.isArray(external)) {
    external.forEach((p) => {
      db.upsertProduct({
        id: String(p.id), name: p.name, brand: p.brand,
        priceCents: p.priceCents, prevCents: p.prevCents || p.priceCents,
        store: p.store || "Loja", stock: p.stock !== false, trend: p.trend || 0
      });
    });
    return res.json({ source: "external", products: external });
  }

  // 2) Fallback local (demonstração)
  let products = db.listProducts();
  if (q) {
    const lq = q.toLowerCase();
    products = products.filter((p) => (p.name || "").toLowerCase().includes(lq));
  }
  return res.json({ source: "local", products });
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
  if (existing) return res.json({ ok: true, monitored: true });

  const lim = assertLimit(db, req.user, "monitored");
  if (!lim.ok) return res.status(429).json({ error: "limite", detail: lim });

  db.addMonitored(req.user.id, req.params.id, targetCents || null);
  db.addEvent(req.user.id, "produto_monitorado", { productId: req.params.id });
  return res.status(201).json({ ok: true, monitored: true });
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
