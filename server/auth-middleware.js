// ============================================================
// FOXYN - middleware de autenticação (JWT)
// ============================================================
import jwt from "jsonwebtoken";
import db from "./db.js";

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, plan: user.plan },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Não autenticado." });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    const user = db.findUserById(payload.sub);
    if (!user) return res.status(401).json({ error: "Sessão inválida." });
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: "Sessão expirada ou inválida." });
  }
}

export function adminRequired(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: "Acesso restrito a administradores." });
  }
  return next();
}
