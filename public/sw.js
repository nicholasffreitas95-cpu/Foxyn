/* ============================================================
   FOXYN - Service Worker (PWA)
   Estrategia:
   - Shell (html/css/js/icones) -> cache-first (funciona offline)
   - /api/* -> network-only (dados autenticados e dinamicos)
   ============================================================ */

const VERSION = "foxyn-v3";
const SHELL_CACHE = VERSION + "-shell";

const SHELL = [
  "/",
  "/index.html",
  "/dashboard.html",
  "/meu-pc.html",
  "/benchmark.html",
  "/radar-precos.html",
  "/alertas.html",
  "/foxyn-ai.html",
  "/conquistas.html",
  "/planos.html",
  "/admin.html",
  "/css/foxyn.css",
  "/assets/foxyn-mark.svg",
  "/assets/fox-hero.jpg",
  "/assets/fox-head.jpg",
  "/js/api.js",
  "/js/app.js",
  "/js/benchmark-webgl.js",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Nunca interferir em chamadas de API (dados dinamicos/autenticados)
  if (url.pathname.startsWith("/api") || url.pathname === "/api/health") {
    return;
  }

  // Apenas GET e mesma origem
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Navegacao de pagina -> network-first com fallback de cache (offline)
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put("/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Estaticos -> cache-first, atualiza em background
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(event.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
