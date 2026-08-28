// ============================================================
// FOXYN - ações do usuário (perfil, assinatura, benchmark, limites)
// ============================================================
import { Router } from "express";
import db from "../db.js";
import { authRequired } from "../auth-middleware.js";
import { PLANS, planOf, assertLimit } from "../plans.js";
import { evaluateAndUnlock } from "../achievements.js";

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
  const newUnlocks = evaluateAndUnlock(db, req.user);
  return res.json({ ok: true, newUnlocks });
});

// Executar benchmark (limite aplicado no servidor)
// Agora vem um resultado REAL medido no navegador (WebGL sintético).
router.post("/benchmark", authRequired, (req, res) => {
  const { game, fpsAvg, fpsMin, fpsMax, score, durationSec, resolution } = req.body || {};

  const lim = assertLimit(db, req.user, "benchmark_monthly");
  if (!lim.ok) return res.status(429).json({ error: "limite", detail: lim });

  // Validação: só aceita números finitos e positivos (nunca fabrica valores)
  const validFps = (v) => typeof v === "number" && isFinite(v) && v > 0;
  if (!validFps(fpsAvg)) {
    return res.status(422).json({ error: "Resultado de benchmark inválido (fps médio ausente)." });
  }

  const result = {
    game: game || "FOXYN WebGL",
    simulated: false,
    real: true,
    fpsAvg: Math.round(fpsAvg * 10) / 10,
    fpsMin: validFps(fpsMin) ? Math.round(fpsMin) : null,
    fpsMax: validFps(fpsMax) ? Math.round(fpsMax) : null,
    score: typeof score === "number" && isFinite(score) ? Math.round(score) : null,
    durationSec: validFps(durationSec) ? Math.round(durationSec) : null,
    resolution: resolution || null,
    note: "Medido em tempo real via WebGL no navegador."
  };

  db.addBenchmark(req.user.id, result.game, false, result);
  db.addEvent(req.user.id, "benchmark_real", { game: result.game, fpsAvg: result.fpsAvg, score: result.score });
  const newUnlocks = evaluateAndUnlock(db, req.user);
  return res.status(201).json({ ok: true, result, usage: lim.used + 1, limit: lim.limit, newUnlocks });
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
