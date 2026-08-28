// ============================================================
// FOXYN - Sistema de Conquistas (Ultimate)
// Catálogo + motor de desbloqueio. Só usuários do plano ULTIMATE
// conseguem desbloquear conquistas (feature exclusiva do plano).
// O catálogo é visível a todos para engajar e incentivar o upgrade.
// ============================================================

export const ACHIEVEMENTS = [
  {
    key: "primeiro_benchmark",
    icon: "🚀",
    title: "Primeiro Benchmark",
    desc: "Realize seu primeiro benchmark WebGL.",
    how: "Rode um benchmark na aba Benchmark.",
    trigger: "benchmark",
    target: 1
  },
  {
    key: "benchmark_cinco",
    icon: "🔥",
    title: "Maratonista Iniciante",
    desc: "Realize 5 benchmarks no total.",
    how: "Acumule 5 benchmarks.",
    trigger: "benchmark",
    target: 5
  },
  {
    key: "benchmark_dez",
    icon: "⚡",
    title: "Corredor de Risco",
    desc: "Realize 10 benchmarks no total.",
    how: "Acumule 10 benchmarks.",
    trigger: "benchmark",
    target: 10
  },
  {
    key: "benchmark_fps80",
    icon: "🏆",
    title: "Mestre dos FPS",
    desc: "Alcance Score 80+ no benchmark WebGL.",
    how: "Faça um benchmark com score >= 80.",
    trigger: "benchmark_score",
    target: 80
  },
  {
    key: "primeiro_monitor",
    icon: "🔔",
    title: "Primeiro Alerta",
    desc: "Monitore seu primeiro produto no Radar.",
    how: "Clique em 'Monitorar' num produto.",
    trigger: "monitor",
    target: 1
  },
  {
    key: "monitor_dez",
    icon: "🛰️",
    title: "Radar Blindado",
    desc: "Monitore 10 produtos diferentes.",
    how: "Acumule 10 monitoramentos ativos.",
    trigger: "monitor",
    target: 10
  },
  {
    key: "primeira_busca",
    icon: "🔍",
    title: "Caçador de Ofertas",
    desc: "Faça sua primeira busca no Radar de Preços.",
    how: "Pesquise um produto no Radar.",
    trigger: "search",
    target: 1
  },
  {
    key: "busca_vinte",
    icon: "💎",
    title: "Varejista",
    desc: "Faça 20 buscas de preço no Radar.",
    how: "Acumule 20 buscas.",
    trigger: "search",
    target: 20
  },
  {
    key: "perfil_completo",
    icon: "🖥️",
    title: "Montador de PC",
    desc: "Preencha o perfil completo do seu PC (CPU + GPU + RAM).",
    how: "Salve CPU, GPU e memória em Meu PC.",
    trigger: "profile",
    target: 1
  },
  {
    key: "ultra_fps",
    icon: "🦊",
    title: "Lenda da FOXYN",
    desc: "Alcance Score 95+ no benchmark WebGL.",
    how: "Faça um benchmark com score >= 95.",
    trigger: "benchmark_score_high",
    target: 95
  }
];

const BY_KEY = new Map(ACHIEVEMENTS.map((a) => [a.key, a]));

export function getAchievement(key) {
  return BY_KEY.get(key) || null;
}

// Estatísticas do usuário usado nas avaliações de triggers
function stats(db, user) {
  const id = user.id;
  const benchmarks = db.listBenchmarks(id);
  const monitored = db.listMonitored(id).length;
  // Buscas contabilizadas via eventos (produto_pesquisado)
  const searches = db.countEvents(id, "produto_pesquisado");
  const bestScore = benchmarks.reduce((m, b) => {
    const s = b.result && b.result.score;
    return typeof s === "number" && s > m ? s : m;
  }, 0);
  const pc = db.getPcProfile(id) || {};
  return {
    benchmarkTotal: benchmarks.length,
    bestScore,
    monitoredCount: monitored,
    searchTotal: searches,
    profileComplete: !!(pc.cpu_id && pc.gpu_id && pc.ram_gb)
  };
}

// Verifica se o trigger da conquista foi satisfeito.
function met(a, s, unlockedSet) {
  switch (a.trigger) {
    case "benchmark":
      return s.benchmarkTotal >= a.target;
    case "benchmark_score":
      return s.bestScore >= a.target;
    case "benchmark_score_high":
      return s.bestScore >= a.target;
    case "monitor":
      return s.monitoredCount >= a.target;
    case "search":
      return s.searchTotal >= a.target;
    case "profile":
      return s.profileComplete;
    default:
      return false;
  }
}

// Reavalia todas as conquistas e desbloqueia as novas.
// Retorna a lista de conquistas recém-desbloqueadas (para celebrar no front).
export function evaluateAndUnlock(db, user) {
  if (!user || user.plan !== "ultimate") return [];
  const s = stats(db, user);
  const unlocked = new Set(db.getUserAchievements(user.id));
  const fresh = [];

  for (const a of ACHIEVEMENTS) {
    if (unlocked.has(a.key)) continue;
    if (met(a, s, unlocked)) {
      db.unlockAchievement(user.id, a.key);
      unlocked.add(a.key);
      fresh.push({ ...a, unlockedAt: Date.now() });
    }
  }
  return fresh;
}

// Para a página de Conquistas: catálogo completo + estado/progresso do usuário.
export function achievementsView(db, user) {
  const s = stats(db, user);
  const unlocked = new Set(db.getUserAchievements(user.id));
  const isUltimate = user.plan === "ultimate";

  const list = ACHIEVEMENTS.map((a) => {
    const progress = triggerProgress(a, s);
    return {
      ...a,
      unlocked: unlocked.has(a.key),
      // Só mostra progresso se for Ultimate (feature exclusiva); senão tranca.
      progress: isUltimate ? progress.cur : -1,
      target: a.target,
      isUltimateOnly: true
    };
  });

  return {
    ultimate: isUltimate,
    count: list.filter((a) => a.unlocked).length,
    total: list.length,
    achievements: list
  };
}

function triggerProgress(a, s) {
  switch (a.trigger) {
    case "benchmark":
      return { cur: Math.min(s.benchmarkTotal, a.target) };
    case "benchmark_score":
    case "benchmark_score_high":
      return { cur: Math.min(s.bestScore, a.target) };
    case "monitor":
      return { cur: Math.min(s.monitoredCount, a.target) };
    case "search":
      return { cur: Math.min(s.searchTotal, a.target) };
    case "profile":
      return { cur: s.profileComplete ? 1 : 0 };
    default:
      return { cur: 0 };
  }
}
