// ============================================================
// FOXYN - camada de banco de dados
// Local: SQLite (better-sqlite3). Produção: use PostgreSQL com
// DATABASE_URL para persistência real no host (ex.: Render).
// ============================================================
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

// ---- Configuração do caminho do SQLite (local) ----
const dataDir = path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = process.env.DATABASE_URL
  ? null
  : path.join(dataDir, "foxyn.db");

// Se DATABASE_URL estiver definida usamos SQLite apenas em memória como
// fallback de demonstração — em produção você substitui db.js pelo driver
// Postgres (pg). Mantemos SQLite para dev simples.
const db = new Database(dbPath || ":memory:");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ============================================================
// SCHEMA
// ============================================================
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  pass_hash     TEXT NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'free',
  is_admin      INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users(id),
  plan           TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'active',
  price_cents    INTEGER NOT NULL DEFAULT 0,
  period         TEXT NOT NULL DEFAULT 'monthly',
  gateway        TEXT NOT NULL DEFAULT 'simulado',
  gateway_ref    TEXT,
  next_charge_at INTEGER,
  created_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pc_profiles (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL UNIQUE REFERENCES users(id),
  cpu_id     TEXT,
  gpu_id     TEXT,
  ram_gb     INTEGER,
  storage    TEXT,
  resolution TEXT,
  games      TEXT,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS monitored_products (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  product_id    TEXT NOT NULL,
  target_cents  INTEGER,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS benchmarks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  game       TEXT NOT NULL,
  simulated  INTEGER NOT NULL DEFAULT 1,
  result     TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  brand         TEXT,
  price_cents   INTEGER,
  prev_cents    INTEGER,
  store         TEXT,
  stock         INTEGER DEFAULT 1,
  trend         REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS price_history (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL REFERENCES products(id),
  price_cents INTEGER NOT NULL,
  recorded_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER,
  event      TEXT NOT NULL,
  payload    TEXT,
  created_at INTEGER NOT NULL
);
`);

// ============================================================
// HELPERS
// ============================================================
const u = (r) => (r === undefined ? null : r);

export default {
  db,

  // --- Usuários ---
  createUser({ username, email, passHash }) {
    const info = db
      .prepare("INSERT INTO users (username,email,pass_hash,created_at) VALUES (?,?,?,?)")
      .run(username, email, passHash, Date.now());
    return db.prepare("SELECT * FROM users WHERE id=?").get(info.lastInsertRowid);
  },
  findUserByUsername(username) {
    return db.prepare("SELECT * FROM users WHERE username=?").get(username) || null;
  },
  findUserByEmail(email) {
    return db.prepare("SELECT * FROM users WHERE email=?").get(email) || null;
  },
  findUserById(id) {
    return db.prepare("SELECT * FROM users WHERE id=?").get(id) || null;
  },
  setUserPlan(id, plan) {
    db.prepare("UPDATE users SET plan=? WHERE id=?").run(plan, id);
  },

  // --- Assinatura ---
  upsertSubscription({ userId, plan, status, priceCents, gateway = "simulado", gatewayRef = null }) {
    const existing = db.prepare("SELECT id FROM subscriptions WHERE user_id=?").get(userId);
    if (existing) {
      db.prepare(
        "UPDATE subscriptions SET plan=?,status=?,price_cents=?,gateway=?,gateway_ref=?,next_charge_at=? WHERE user_id=?"
      ).run(plan, status, priceCents, gateway, gatewayRef, Date.now() + 30 * 86400000, userId);
      return this.getSubscription(userId);
    }
    const info = db
      .prepare("INSERT INTO subscriptions (user_id,plan,status,price_cents,period,gateway,gateway_ref,next_charge_at,created_at) VALUES (?,?,?,?,'monthly',?,?,?,?)")
      .run(userId, plan, status, priceCents, gateway, gatewayRef, Date.now() + 30 * 86400000, Date.now());
    return this.getSubscription(info.lastInsertRowid);
  },
  getSubscription(userId) {
    return (
      db.prepare("SELECT * FROM subscriptions WHERE user_id=?").get(userId) ||
      this.upsertSubscription({ userId, plan: "free", status: "active", priceCents: 0 })
    );
  },
  cancelSubscription(userId) {
    db.prepare("UPDATE subscriptions SET status='canceled' WHERE user_id=?").run(userId);
  },

  // --- Perfil do PC ---
  savePcProfile(userId, p) {
    db.prepare(
      `INSERT INTO pc_profiles (user_id,cpu_id,gpu_id,ram_gb,storage,resolution,games,updated_at)
       VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(user_id) DO UPDATE SET
         cpu_id=excluded.cpu_id, gpu_id=excluded.gpu_id, ram_gb=excluded.ram_gb,
         storage=excluded.storage, resolution=excluded.resolution, games=excluded.games,
         updated_at=excluded.updated_at`
    ).run(userId, p.cpuId, p.gpuId, p.ramGB, p.storage, p.resolution, p.games ? JSON.stringify(p.games) : null, Date.now());
  },
  getPcProfile(userId) {
    const r = db.prepare("SELECT * FROM pc_profiles WHERE user_id=?").get(userId);
    if (!r) return null;
    return { ...r, games: r.games ? JSON.parse(r.games) : [] };
  },

  // --- Monitoramento ---
  listMonitored(userId) {
    return db.prepare("SELECT * FROM monitored_products WHERE user_id=?").all(userId);
  },
  addMonitored(userId, productId, targetCents) {
    const info = db
      .prepare("INSERT INTO monitored_products (user_id,product_id,target_cents,created_at) VALUES (?,?,?,?)")
      .run(userId, productId, targetCents, Date.now());
    return db.prepare("SELECT * FROM monitored_products WHERE id=?").get(info.lastInsertRowid);
  },
  removeMonitored(userId, productId) {
    db.prepare("DELETE FROM monitored_products WHERE user_id=? AND product_id=?").run(userId, productId);
  },

  // --- Benchmark ---
  addBenchmark(userId, game, simulated, result) {
    const info = db
      .prepare("INSERT INTO benchmarks (user_id,game,simulated,result,created_at) VALUES (?,?,?,?,?)")
      .run(userId, game, simulated ? 1 : 0, JSON.stringify(result), Date.now());
    return db.prepare("SELECT * FROM benchmarks WHERE id=?").get(info.lastInsertRowid);
  },
  countBenchmarksThisMonth(userId) {
    const monthStart = Date.now() - 30 * 86400000;
    return db
      .prepare("SELECT COUNT(*) AS c FROM benchmarks WHERE user_id=? AND created_at>=?")
      .get(userId, monthStart).c;
  },
  listBenchmarks(userId) {
    return db.prepare("SELECT * FROM benchmarks WHERE user_id=? ORDER BY created_at DESC").all(userId);
  },

  // --- Produtos / Radar ---
  upsertProduct(p) {
    db.prepare(
      `INSERT INTO products (id,name,brand,price_cents,prev_cents,store,stock,trend)
       VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name,brand=excluded.brand,
         price_cents=excluded.price_cents,prev_cents=excluded.prev_cents,
         store=excluded.store,stock=excluded.stock,trend=excluded.trend`
    ).run(p.id, p.name, p.brand, p.priceCents, p.prevCents, p.store, p.stock ? 1 : 0, p.trend);
  },
  listProducts() {
    return db.prepare("SELECT * FROM products").all();
  },
  getProduct(id) {
    return db.prepare("SELECT * FROM products WHERE id=?").get(id) || null;
  },
  addPricePoint(productId, cents) {
    db.prepare("INSERT INTO price_history (product_id,price_cents,recorded_at) VALUES (?,?,?)").run(productId, cents, Date.now());
  },
  getPriceHistory(productId) {
    return db.prepare("SELECT price_cents,recorded_at FROM price_history WHERE product_id=? ORDER BY recorded_at ASC").all(productId);
  },

  // --- Eventos (analytics) ---
  addEvent(userId, event, payload) {
    db.prepare("INSERT INTO events (user_id,event,payload,created_at) VALUES (?,?,?,?)").run(
      userId, event, payload ? JSON.stringify(payload) : null, Date.now()
    );
  },

  // --- Métricas (admin) ---
  metrics() {
    const users = db.prepare("SELECT COUNT(*) c FROM users").get().c;
    const free = db.prepare("SELECT COUNT(*) c FROM users WHERE plan='free'").get().c;
    const essential = db.prepare("SELECT COUNT(*) c FROM users WHERE plan='essential'").get().c;
    const ultimate = db.prepare("SELECT COUNT(*) c FROM users WHERE plan='ultimate'").get().c;
    const monitored = db.prepare("SELECT COUNT(*) c FROM monitored_products").get().c;
    return { users, free, essential, ultimate, monitored, conversion: users ? Math.round(((essential + ultimate) / users) * 100) : 0 };
  }
};
