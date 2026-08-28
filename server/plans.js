// ============================================================
// FOXYN - planos e limites (SOMENTE no servidor)
// O frontend NUNCA decide limites; o backend valida em cada rota.
// ============================================================

export const PLANS = {
  free: {
    label: "FREE",
    tagline: "EXPERIMENTE",
    priceCents: 0,
    limits: {
      benchmark_monthly: 3,
      monitored: 2,
      price_search: 10
    }
  },
  essential: {
    label: "ESSENTIAL",
    tagline: "OTIMIZE",
    priceCents: 1990,
    limits: {
      benchmark_monthly: null, // ilimitado
      monitored: 20,
      price_search: null
    }
  },
  ultimate: {
    label: "ULTIMATE",
    tagline: "DECIDA MELHOR",
    priceCents: 3990,
    limits: {
      benchmark_monthly: null,
      monitored: 100,
      price_search: null
    }
  }
};

export function planOf(user) {
  const p = PLANS[user.plan] || PLANS.free;
  return { id: user.plan, ...p };
}

// Verifica uso de um recurso limitado. Retorna:
// { ok:true, used, limit }  ou  { ok:false, reason:'limit', ... }
export function assertLimit(db, user, feature) {
  const limits = planOf(user).limits;
  const limit = limits[feature];

  if (limit === null) return { ok: true, used: 0, limit: null };

  let used = 0;
  if (feature === "benchmark_monthly") {
    used = db.countBenchmarksThisMonth(user.id);
  } else if (feature === "monitored") {
    used = db.listMonitored(user.id).length;
  } else if (feature === "price_search") {
    used = 0; // contador mensal de pesquisas (incrementado via events)
  }

  if (used >= limit) return { ok: false, reason: "limit", used, limit, upgradeTo: user.plan === "free" ? "essential" : "ultimate" };
  return { ok: true, used, limit };
}
