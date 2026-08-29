// ============================================================
// FOXYN - aplicação servidor (Express)
// Serve o frontend estático e a API.
// Pronto para deploy em Render.com (Node 18+).
// ============================================================
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Inicializa .env (se existir)
import { seedIfEmpty } from "./auto-seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

// ---------- Rotas ----------
import authRoutes from "./routes/auth.js";
import radarRoutes from "./routes/radar.js";
import userRoutes from "./routes/user.js";
import achievementsRoutes from "./routes/achievements.js";

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Middlewares ----------
app.disable("x-powered-by");
app.use(
  cors({
    origin: process.env.PUBLIC_URL ? [process.env.PUBLIC_URL] : true,
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));

// Headers de segurança
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (req.path.startsWith("/api")) {
    res.setHeader("Cache-Control", "no-store");
  }
  next();
});

// ---------- API ----------
app.use("/api/auth", authRoutes);
app.use("/api", userRoutes);
app.use("/api", radarRoutes);
app.use("/api", achievementsRoutes);

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "foxyn" }));

// ---------- Frontend estático ----------
const publicDir = path.join(__dirname, "..", "public");
const agentDir = path.join(__dirname, "..", "agent");

// Expõe agente de monitoramento para download direto (/agent/monitor.py)
app.use("/agent", express.static(agentDir, { etag: true, maxAge: "1h" }));

// Service worker: sempre no-cache para permitir atualizações do PWA
app.get("/sw.js", (_req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.sendFile(path.join(publicDir, "sw.js"));
});

app.use(express.static(publicDir, { etag: true, maxAge: "1h" }));

// SPA fallback (serve index.html para rotas não encontradas) - evita mascarar 404 de assets
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  // se parece arquivo com extensão (ex: .js, .css, .png, .jpg, .svg) não faz fallback, deixa 404 real
  if (req.path.includes(".") && !req.path.endsWith(".html")) return res.status(404).send("Not found");
  const index = path.join(publicDir, "index.html");
  if (fs.existsSync(index)) return res.sendFile(index);
  return next();
});

// ---------- Erros ----------
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Erro interno do servidor." });
});

// ---------- Boot ----------
seedIfEmpty();
app.listen(PORT, () => {
  console.log(`🦊 FOXYN rodando em http://localhost:${PORT}`);
});
