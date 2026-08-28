// ============================================================
// FOXYN - semeadura inicial (produtos de demonstração + admin)
// Rode manualmente: npm run seed
// Também é chamado automaticamente no boot quando o banco está vazio.
// ============================================================
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import db from "./db.js";

dotenv.config();

const products = [
  { id: "rtx4060", name: "RTX 4060 8GB", brand: "NVIDIA", priceCents: 184900, prevCents: 199900, store: "Kabum", stock: true, trend: -7.5 },
  { id: "rx7800xt", name: "RX 7800 XT 16GB", brand: "AMD", priceCents: 289900, prevCents: 329900, store: "Terabyte", stock: true, trend: -12.1 },
  { id: "r5-7600", name: "Ryzen 5 7600", brand: "AMD", priceCents: 109900, prevCents: 119900, store: "Kabum", stock: true, trend: -8.3 },
  { id: "i5-13400f", name: "Core i5-13400F", brand: "Intel", priceCents: 99900, prevCents: 109900, store: "Pichau", stock: true, trend: -9.1 },
  { id: "rtx4070super", name: "RTX 4070 Super 12GB", brand: "NVIDIA", priceCents: 379900, prevCents: 359900, store: "Terabyte", stock: false, trend: 5.6 },
  { id: "ddr5-32", name: "DDR5 32GB 6000MT/s", brand: "Kingston", priceCents: 64900, prevCents: 78000, store: "Kabum", stock: true, trend: -16.8 },
  { id: "ssd-1tb", name: "SSD NVMe 1TB Gen4", brand: "Samsung", priceCents: 54900, prevCents: 59900, store: "Terabyte", stock: true, trend: -8.3 },
  { id: "rx7600", name: "RX 7600 8GB", brand: "AMD", priceCents: 159900, prevCents: 169900, store: "Pichau", stock: true, trend: -5.9 }
];

const history = {
  rtx4060: [219000, 212000, 205000, 199900, 194000, 184900],
  rx7800xt: [349000, 341000, 332000, 329900, 315000, 289900],
  "r5-7600": [125000, 123000, 120000, 119900, 115000, 109900],
  "i5-13400f": [115000, 112000, 109900, 107000, 104000, 99900],
  rtx4070super: [349000, 350000, 352000, 355000, 359900, 379900],
  "ddr5-32": [82000, 80000, 78000, 74000, 69000, 64900],
  "ssd-1tb": [62000, 61000, 59900, 58000, 57000, 54900],
  rx7600: [179000, 175000, 172000, 169900, 165000, 159900]
};

export function runSeed(force = false) {
  const current = Date.now();
  const day = 86400000;

  // Guarda: só semeia produtos se o catálogo estiver vazio (a menos que force=true)
  const existing = db.listProducts();
  if (!force && existing.length) {
    console.log("Seed: catálogo já populado, pulando produtos.");
  } else {
    for (const p of products) {
      db.upsertProduct(p);
      const hist = history[p.id] || [p.priceCents];
      hist.forEach((cents, i) => {
        db.db
          .prepare("INSERT INTO price_history (product_id, price_cents, recorded_at) VALUES (?,?,?)")
          .run(p.id, cents, current - (hist.length - i) * 3 * day);
      });
    }
    console.log(`Seed: ${products.length} produtos + histórico inseridos.`);
  }

  // Admin (cria apenas se não existir)
  const adminUser = process.env.FOXYN_ADMIN_USER || "Adm1982";
  const adminPass = process.env.FOXYN_ADMIN_PASS || "198215057040";
  if (!db.findUserByUsername(adminUser)) {
    const passHash = bcrypt.hashSync(adminPass, 10);
    db.createUser({ username: adminUser, email: "admin@foxyn.app", passHash });
    db.db.prepare("UPDATE users SET plan='ultimate', is_admin=1 WHERE username=?").run(adminUser);
    const u = db.findUserByUsername(adminUser);
    db.upsertSubscription({ userId: u.id, plan: "ultimate", status: "active", priceCents: 3990 });
    console.log(`Admin padrão criado: ${adminUser}`);
  } else {
    console.log("Admin já existe. (Defina FOXYN_ADMIN_USER/FOXYN_ADMIN_PASS no .env para alterar)");
  }
}
