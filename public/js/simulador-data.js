// FOXYN Simulador - base de dados local (sem backend)
// Estimativa é sintética, não benchmark real; mantém UX fiel ao design system
const SIM_DATA = {
  gpus: [
    { id: "rtx4090", label: "RTX 4090 24GB", tier: 10 },
    { id: "rtx4080", label: "RTX 4080 16GB", tier: 9.2 },
    { id: "rtx4070ti", label: "RTX 4070 Ti 12GB", tier: 8.4 },
    { id: "rtx4070", label: "RTX 4070 12GB", tier: 7.9 },
    { id: "rtx4060ti", label: "RTX 4060 Ti 8GB", tier: 7.1 },
    { id: "rtx4060", label: "RTX 4060 8GB", tier: 6.5 },
    { id: "rtx3060ti", label: "RTX 3060 Ti 8GB", tier: 6.0 },
    { id: "rtx3060", label: "RTX 3060 12GB", tier: 5.6 },
    { id: "rx7900xtx", label: "RX 7900 XTX 24GB", tier: 9.4 },
    { id: "rx7800xt", label: "RX 7800 XT 16GB", tier: 8.0 },
    { id: "rx7600", label: "RX 7600 8GB", tier: 5.8 },
    { id: "rx6600", label: "RX 6600 8GB", tier: 5.0 },
    { id: "arcA770", label: "Arc A770 16GB", tier: 5.4 },
    { id: "gtx1660s", label: "GTX 1660 Super 6GB", tier: 3.8 }
  ],
  cpus: [
    { id: "r7_7800x3d", label: "Ryzen 7 7800X3D", factor: 1.08 },
    { id: "r5_7600", label: "Ryzen 5 7600", factor: 1.02 },
    { id: "r5_5600", label: "Ryzen 5 5600", factor: 1.0 },
    { id: "r5_5500", label: "Ryzen 5 5500", factor: 0.96 },
    { id: "i7_14700", label: "Core i7-14700", factor: 1.07 },
    { id: "i5_14400", label: "Core i5-14400", factor: 1.01 },
    { id: "i5_12400", label: "Core i5-12400", factor: 0.98 },
    { id: "i3_12100", label: "Core i3-12100", factor: 0.90 }
  ],
  games: [
    { id: "cyberpunk", label: "Cyberpunk 2077", demand: 0.62, base: 72 },
    { id: "warzone", label: "Call of Duty: Warzone", demand: 0.95, base: 110 },
    { id: "fortnite", label: "Fortnite", demand: 1.35, base: 165 },
    { id: "valorant", label: "Valorant", demand: 1.85, base: 280 },
    { id: "rdr2", label: "Red Dead Redemption 2", demand: 0.68, base: 78 },
    { id: "lol", label: "League of Legends", demand: 1.9, base: 320 },
    { id: "cs2", label: "Counter-Strike 2", demand: 1.4, base: 210 },
    { id: "hogwarts", label: "Hogwarts Legacy", demand: 0.70, base: 82 },
    { id: "elden", label: "Elden Ring", demand: 0.88, base: 95 },
    { id: "gta5", label: "GTA V", demand: 1.1, base: 135 }
  ],
  ram: [
    { id: 8, label: "8 GB", factor: 0.88 },
    { id: 16, label: "16 GB", factor: 1.0 },
    { id: 32, label: "32 GB", factor: 1.04 },
    { id: 64, label: "64 GB", factor: 1.05 }
  ],
  resolutions: [
    { id: "1080p", label: "1080p", factor: 1.0 },
    { id: "1440p", label: "1440p", factor: 0.68 },
    { id: "4k", label: "4K", factor: 0.42 }
  ]
};

function estimateFPS({ gpuId, cpuId, ramGB, resolution, gameId }) {
  const gpu = SIM_DATA.gpus.find(g => g.id === gpuId) || SIM_DATA.gpus[5];
  const cpu = SIM_DATA.cpus.find(c => c.id === cpuId) || SIM_DATA.cpus[2];
  const game = SIM_DATA.games.find(g => g.id === gameId) || SIM_DATA.games[0];
  const ram = SIM_DATA.ram.find(r => r.id === ramGB) || SIM_DATA.ram[1];
  const res = SIM_DATA.resolutions.find(r => r.id === resolution) || SIM_DATA.resolutions[0];
  // fórmula sintética estável
  const raw = gpu.tier * 18 * game.demand * cpu.factor * ram.factor * res.factor * (game.base / 100);
  const fps = Math.round(raw);
  const min = Math.round(fps * 0.72);
  const max = Math.round(fps * 1.18);
  let verdict = "FRACO", cls = "bad";
  if (fps >= 120) { verdict = "EXCELENTE"; cls = "good"; }
  else if (fps >= 75) { verdict = "ÓTIMO"; cls = "good"; }
  else if (fps >= 55) { verdict = "BOM"; cls = "warn"; }
  else if (fps >= 35) { verdict = "JOGÁVEL"; cls = "warn"; }
  const settings = fps >= 90 ? "Ultra" : fps >= 65 ? "Alto" : fps >= 40 ? "Médio" : "Baixo";
  return { fps, min, max, verdict, cls, settings };
}
