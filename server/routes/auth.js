// ============================================================
// FOXYN - rotas de autenticação
// ============================================================
import { Router } from "express";
import bcrypt from "bcryptjs";
import db from "../db.js";
import { signToken, authRequired } from "../auth-middleware.js";

const router = Router();

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    plan: u.plan,
    isAdmin: !!u.is_admin,
    createdAt: u.created_at
  };
}

// Registro
router.post("/register", (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password) {
    return res.status(400).json({ error: "Preencha nome, e-mail e senha." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres." });
  }
  if (db.findUserByUsername(username) || db.findUserByEmail(email)) {
    return res.status(409).json({ error: "Usuário ou e-mail já cadastrados." });
  }
  const passHash = bcrypt.hashSync(password, 10);
  const user = db.createUser({
    username: String(username).trim(),
    email: String(email).trim().toLowerCase(),
    passHash
  });
  db.upsertSubscription({ userId: user.id, plan: "free", status: "active", priceCents: 0 });
  db.addEvent(user.id, "cadastro", { plan: "free" });

  const token = signToken(user);
  return res.status(201).json({ token, user: publicUser(user) });
});

// Login
router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Informe usuário e senha." });

  const user = db.findUserByUsername(String(username).trim());
  if (!user || !bcrypt.compareSync(password, user.pass_hash)) {
    return res.status(401).json({ error: "Usuário ou senha incorretos." });
  }
  db.addEvent(user.id, "login", {});
  const token = signToken(user);
  return res.json({ token, user: publicUser(user) });
});

// Sessão atual
router.get("/me", authRequired, (req, res) => {
  const sub = db.getSubscription(req.user.id);
  const profile = db.getPcProfile(req.user.id);
  return res.json({
    user: publicUser(req.user),
    subscription: {
      plan: sub.plan,
      status: sub.status,
      priceCents: sub.price_cents,
      period: sub.period,
      gateway: sub.gateway,
      nextChargeAt: sub.next_charge_at
    },
    pcProfile: profile
  });
});

export default router;
