// ============================================================
// FOXYN - camada de dados (armazenamento puro JS em arquivo JSON)
// Sem módulos nativos -> deploy simples em qualquer host (Render free).
// Em produção com múltiplas instâncias/precisando de robustez,
// substitua por Postgres (pg). Mantemos aqui para portabilidade total.
// ============================================================
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const dataDir = path.join(process.cwd(), "data");
const file = path.join(dataDir, "foxyn-data.json");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Estrutura inicial
function blank() {
  return {
    users: [],
    subscriptions: [], // { id,user_id,plan,status,price_cents,period,gateway,gateway_ref,next_charge_at,created_at }
    pc_profiles: [],    // { id,user_id,cpu_id,gpu_id,ram_gb,storage,resolution,games,updated_at }
    monitored: [],      // { id,user_id,product_id,target_cents,created_at }
    benchmarks: [],     // { id,user_id,game,simulated,result,created_at }
    products: [],       // { id,name,brand,price_cents,prev_cents,store,stock,trend }
    price_history: [],  // { id,product_id,price_cents,recorded_at }
    events: [],         // { id,user_id,event,payload,created_at }
    seq: 0
  };
}

function load() {
  try {
    const raw = fs.readFileSync(file, "utf8");
    const data = JSON.parse(raw);
    return { ...blank(), ...data };
  } catch {
    return blank();
  }
}

function save(data) {
  const dir = path.dirname(file);
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

// Controle de corrida simples (síncrono por natureza no Node single-thread)
let current = load();

const db = {
  get data() {
    return current;
  },
  persist() {
    save(current);
  },

  // ---------- Usuários ----------
  createUser({ username, email, passHash }) {
    current.seq += 1;
    const u = {
      id: current.seq, username, email, pass_hash: passHash,
      plan: "free", is_admin: 0, created_at: Date.now()
    };
    current.users.push(u);
    this.persist();
    return u;
  },
  findUserByUsername(username) {
    return current.users.find((u) => u.username === username) || null;
  },
  findUserByEmail(email) {
    return current.users.find((u) => u.email === email) || null;
  },
  findUserById(id) {
    return current.users.find((u) => u.id === id) || null;
  },
  setUserPlan(id, plan) {
    const u = this.findUserById(id);
    if (u) { u.plan = plan; this.persist(); }
  },
  setAdmin(id) {
    const u = this.findUserById(id);
    if (u) { u.is_admin = 1; this.persist(); }
  },

  // ---------- Assinatura ----------
  upsertSubscription({ userId, plan, status, priceCents, gateway = "simulado", gatewayRef = null }) {
    let sub = current.subscriptions.find((s) => s.user_id === userId);
    if (sub) {
      Object.assign(sub, {
        plan, status, price_cents: priceCents, gateway, gateway_ref: gatewayRef,
        next_charge_at: Date.now() + 30 * 86400000
      });
    } else {
      current.seq += 1;
      sub = {
        id: current.seq, user_id: userId, plan, status, price_cents: priceCents,
        period: "monthly", gateway, gateway_ref: gatewayRef,
        next_charge_at: Date.now() + 30 * 86400000, created_at: Date.now()
      };
      current.subscriptions.push(sub);
    }
    this.persist();
    return { ...sub };
  },
  getSubscription(userId) {
    const found = current.subscriptions.find((s) => s.user_id === userId);
    if (found) return { ...found };
    return this.upsertSubscription({ userId, plan: "free", status: "active", priceCents: 0 });
  },
  cancelSubscription(userId) {
    const sub = current.subscriptions.find((s) => s.user_id === userId);
    if (sub) { sub.status = "canceled"; this.persist(); }
  },

  // ---------- Perfil do PC ----------
  savePcProfile(userId, p) {
    let prof = current.pc_profiles.find((x) => x.user_id === userId);
    if (!prof) {
      current.seq += 1;
      prof = { id: current.seq, user_id: userId };
      current.pc_profiles.push(prof);
    }
    Object.assign(prof, {
      cpu_id: p.cpuId ?? null, gpu_id: p.gpuId ?? null, ram_gb: p.ramGB ?? null,
      storage: p.storage ?? null, resolution: p.resolution ?? null,
      games: p.games ? JSON.stringify(p.games) : null, updated_at: Date.now()
    });
    this.persist();
  },
  getPcProfile(userId) {
    const r = current.pc_profiles.find((x) => x.user_id === userId) || null;
    if (!r) return null;
    return { ...r, games: r.games ? JSON.parse(r.games) : [] };
  },

  // ---------- Monitoramento ----------
  listMonitored(userId) {
    return current.monitored.filter((m) => m.user_id === userId);
  },
  addMonitored(userId, productId, targetCents) {
    current.seq += 1;
    const m = { id: current.seq, user_id: userId, product_id: productId, target_cents: targetCents ?? null, created_at: Date.now() };
    current.monitored.push(m);
    this.persist();
    return { ...m };
  },
  removeMonitored(userId, productId) {
    const idx = current.monitored.findIndex((m) => m.user_id === userId && m.product_id === productId);
    if (idx >= 0) { current.monitored.splice(idx, 1); this.persist(); }
  },

  // ---------- Benchmark ----------
  addBenchmark(userId, game, simulated, result) {
    current.seq += 1;
    const b = {
      id: current.seq, user_id: userId, game, simulated: simulated ? 1 : 0,
      result: JSON.stringify(result), created_at: Date.now()
    };
    current.benchmarks.push(b);
    this.persist();
    return { ...b };
  },
  countBenchmarksThisMonth(userId) {
    const monthStart = Date.now() - 30 * 86400000;
    return current.benchmarks.filter((b) => b.user_id === userId && b.created_at >= monthStart).length;
  },
  listBenchmarks(userId) {
    return current.benchmarks
      .filter((b) => b.user_id === userId)
      .sort((a, b) => b.created_at - a.created_at)
      .map((b) => {
        let parsed = null;
        try { parsed = b.result ? JSON.parse(b.result) : null; } catch { parsed = null; }
        return { ...b, result: parsed };
      });
  },

  // ---------- Produtos / Radar ----------
  upsertProduct(p) {
    let prod = current.products.find((x) => x.id === p.id);
    if (prod) {
      Object.assign(prod, {
        name: p.name, brand: p.brand, price_cents: p.priceCents, prev_cents: p.prevCents,
        store: p.store, stock: p.stock ? 1 : 0, trend: p.trend
      });
    } else {
      current.products.push({
        id: p.id, name: p.name, brand: p.brand, price_cents: p.priceCents,
        prev_cents: p.prevCents, store: p.store, stock: p.stock ? 1 : 0, trend: p.trend
      });
    }
    this.persist();
  },
  listProducts() {
    return current.products;
  },
  getProduct(id) {
    return current.products.find((p) => p.id === id) || null;
  },
  addPricePoint(productId, cents) {
    this.addPricePointAt(productId, cents, Date.now());
  },
  // interno: usado pelo seed para registrar histórico com datas passadas
  addPricePointAt(productId, cents, at) {
    current.seq += 1;
    current.price_history.push({ id: current.seq, product_id: productId, price_cents: cents, recorded_at: at });
    this.persist();
  },
  getPriceHistory(productId) {
    return current.price_history
      .filter((p) => p.product_id === productId)
      .sort((a, b) => a.recorded_at - b.recorded_at);
  },

  // ---------- Eventos ----------
  addEvent(userId, event, payload) {
    current.seq += 1;
    current.events.push({ id: current.seq, user_id: userId ?? null, event, payload: payload ? JSON.stringify(payload) : null, created_at: Date.now() });
  },

  // ---------- Métricas (admin) ----------
  metrics() {
    const users = current.users.length;
    const free = current.users.filter((u) => u.plan === "free").length;
    const essential = current.users.filter((u) => u.plan === "essential").length;
    const ultimate = current.users.filter((u) => u.plan === "ultimate").length;
    const monitored = current.monitored.length;
    return {
      users, free, essential, ultimate, monitored,
      conversion: users ? Math.round(((essential + ultimate) / users) * 100) : 0
    };
  }
};

export default db;
