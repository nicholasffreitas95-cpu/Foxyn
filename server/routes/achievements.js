// ============================================================
// FOXYN - Conquistas (Ultimate) - leitura da página
// ============================================================
import { Router } from "express";
import db from "../db.js";
import { authRequired } from "../auth-middleware.js";
import { achievementsView } from "../achievements.js";

const router = Router();

router.get("/achievements", authRequired, (req, res) => {
  return res.json(achievementsView(db, req.user));
});

export default router;
