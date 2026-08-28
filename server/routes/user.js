// ============================================================
// FOXYN - ações do usuário (perfil, assinatura, benchmark, limites)
// ============================================================
import { Router } from "express";
import db from "../db.js";
import { authRequired } from "../auth-middleware.js";
import { PLANS, planOf, assertLimit } from "../plans.js";

const router = Router();

// Uso / limites do plano (o frontend apenas EXIBE)
router.get("/limits", authRequired, (req, res) => {
  const bm = assertLimit(db, req.user, "benchmark_monthly");
  const mon = assertLimit(db, req.user, "monitored");
  res.json({
    plan: planOf(req.user),
    benchmark: { used: bm.used, limit: bm.limit },
    monitored: { used: mon.used, limit: mon.limit }
  });
});

// Salvar perfil do PC (página "Meu PC")
router.post("/pc-profile", authRequired, (req, res) => {
  const { cpuId, gpuId, ramGB, storage, resolution, games } = req.body || {};
  db.savePcProfile(req.user.id, { cpuId, gpuId, ramGB, storage, resolution, games: games || [] });
  db.addEvent(req.user.id, "pc_perfil_atualizado", {});
  return res.json({ ok: true });
});

// Executar benchmark (limite aplicado no servidor)
router.post("/benchmark", authRequired, (req, res) => {
  const { game } = req.body || {};
  const lim = assertLimit(db, req.user, "benchmark_monthly");
  if (!lim.ok) return res.status(429).json({ error: "limite", detail: lim });

  // Sem agente local, nenhuma medição real é possível.
  // Retornamos o marcador para o frontend não apresentar NÚMEROS como reais.
  // Em produção, um agente local enviaria a telemetria real aqui.
  const simulated = {
    game: game || "desconhecido",
    simulated: true,
    message: "Real measurement requires the FOXYN local agent (not available here). Numbers not shown."
  };
  db.addBenchmark(req.user.id, game || "desconhecido", true, simulated);
  db.addEvent(req.user.id, "benchmark_simulado", { game });
  return res.status(201).json({ ok: true, result: simulated, usage: lim.used + 1, limit: lim.limit });
});

// Histórico de benchmarks
router.get("/benchmarks", authRequired, (req, res) => {
  return res.json(db.listBenchmarks(req.user.id));
});

// Assinatura - checkout (gateway-ready)
// Se PAYMENT_WEBHOOK_SECRET estiver configurado, exige aquisição real via gateway.
// Sem ele, roda em modo simulado (dev) - honesto: NENHUM valor é cobrado.
router.post("/subscription/change", authRequired, (req, res) => {
  const target = req.body && req.body.plan;
  if (!PLANS[target]) return res.status(400).json({ error: "Plano inválido." });
  if (req.user.is_admin) return res.status(400).json({ error: "Admin não altera plano." });

  const gateway = process.env.PAYMENT_WEBHOOK_SECRET ? process.env.PAYMENT_GATEWAY || "stripe" : "simulado";

  if (gateway !== "simulado") {
    // Em produção: aqui você criaria uma sessão de checkout no gateway
    // (ex.: Stripe Checkout ou Mercado Pago) e retornaria a URL/ID.
    return res.status(502).json({
      error: "gateway-required",
      message: "Configure um gateway real (Stripe/Pix/Mercado Pago) para cobrar.",
      upgradeTo: target
    });
  }

  // Modo simulado (desenvolvimento)
  db.setUserPlan(req.user.id, target);
  db.upsertSubscription({
    userId: req.user.id,
    plan: target,
    status: "active",
    priceCents: PLANS[target].priceCents,
    gateway: "simulado"
  });
  db.addEvent(req.user.id, "assinatura_criada", { plan: target, method: "simulado" });
  return res.json({ ok: true, plan: target, note: "Modo simulado: nenhum valor cobrado." });
});

router.post("/subscription/cancel", authRequired, (req, res) => {
  db.setUserPlan(req.user.id, "free");
  db.cancelSubscription(req.user.id);
  db.addEvent(req.user.id, "cancelamento", {});
  return res.json({ ok: true, plan: "free" });
});

// Métricas admin
router.get("/admin/metrics", authRequired, (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: "Acesso restrito." });
  return res.json(db.metrics());
});

export default router;
