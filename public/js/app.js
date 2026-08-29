// ============================================================
// FOXYN - app compartilhado (layout, sidebar, sessão via backend)
// ============================================================

// ---------- Toast ----------
function foxToast(msg, type = "info") {
  let wrap = document.querySelector(".fox-toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "fox-toast-wrap";
    document.body.appendChild(wrap);
  }
  const t = document.createElement("div");
  t.className = "fox-toast fox-toast--" + type;
  t.innerHTML = '<span class="fox-toast-msg"></span>';
  t.querySelector(".fox-toast-msg").textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transition = "opacity 0.3s";
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

// ---------- Conquistas (Ultimate) ----------
// Chame após qualquer ação que possa desbloquear conquista.
// Espera uma resposta com .newUnlocks (array de conquistas).
function foxCheckUnlocks(resp) {
  const fresh = resp && Array.isArray(resp.newUnlocks) ? resp.newUnlocks : [];
  if (fresh.length) foxCelebrate(fresh);
  return resp;
}

function foxCelebrate(unlocks) {
  let overlay = document.querySelector(".fox-ach-overlay");
  if (overlay) overlay.remove();
  overlay = document.createElement("div");
  overlay.className = "fox-ach-overlay";
  overlay.innerHTML = `
    <div class="fox-ach-modal">
      <button class="fox-ach-close" type="button" aria-label="Fechar">✕</button>
      <div class="fox-ach-badge">🦊 Conquista desbloqueada!</div>
      <div class="fox-ach-list">${unlocks
        .map(
          (a) => `
        <div class="fox-ach-item">
          <span class="fox-ach-icon">${a.icon || "🏅"}</span>
          <div>
            <div class="fox-ach-title">${escapeHtml(a.title || "Conquista")}</div>
            <div class="fox-ach-desc">${escapeHtml(a.desc || "")}</div>
          </div>
        </div>`
        )
        .join("")}
      </div>
      <a class="fox-btn fox-btn--primary" href="conquistas.html">Ver todas as conquistas</a>
    </div>`;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.classList.contains("fox-ach-close")) overlay.remove();
  });
  document.body.appendChild(overlay);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const ICONS = {
  dashboard: '<svg class="fox-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  pc: '<svg class="fox-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 21h8m-4-5v5"/></svg>',
  benchmark: '<svg class="fox-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9m6 10V5m6 14v-7m4 7V3"/><path d="M2 21h20"/></svg>',
  radar: '<svg class="fox-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21a9 9 0 1 0-9-9"/><path d="M12 17a5 5 0 1 0-5-5"/><path d="M12 13a1 1 0 1 0-1-1"/><path d="m12 12 6-6"/></svg>',
  alerts: '<svg class="fox-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>',
  ai: '<svg class="fox-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z"/></svg>',
  achievements: '<svg class="fox-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="5"/><path d="m8 12-2 9 6-3 6 3-2-9"/><path d="m10 8 1.3 1.3L14 6.8"/></svg>',
  plan: '<svg class="fox-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 7 3 11h12l3-11-5 4-4-7-4 7-5-4Z"/><path d="M6 21h12"/></svg>',
  admin: '<svg class="fox-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/></svg>'
};

const NAV = [
  { section: "Principal" },
  { href: "dashboard.html", icon: "dashboard", label: "Dashboard" },
  { href: "meu-pc.html", icon: "pc", label: "Meu PC" },
  { href: "benchmark.html", icon: "benchmark", label: "Benchmark" },
  { section: "Oportunidades" },
  { href: "radar-precos.html", icon: "radar", label: "Radar de Preços" },
  { href: "alertas.html", icon: "alerts", label: "Alertas" },
  { section: "FOXYN" },
  { href: "foxyn-ai.html", icon: "ai", label: "Foxyn AI" },
  { href: "conquistas.html", icon: "achievements", label: "Conquistas" },
  { href: "planos.html", icon: "plan", label: "Meu Plano" }
];

const FOXYN = {
  isAdmin() {
    const u = API.user();
    return !!(u && u.isAdmin);
  },
  planLabel(plan) {
    const u = API.user();
    if (this.isAdmin()) return "Administrador";
    return plan === "ultimate" ? "Plano Ultimate"
      : plan === "essential" ? "Plano Essential"
      : "Plano Gratuito";
  }
};

function renderSidebar(page) {
  let nav = "";
  for (const n of NAV) {
    if (n.section) nav += `<div class="fox-nav-section">${n.section}</div>`;
    else {
      const active = page && n.href.includes(page) ? " active" : "";
      nav += `<a href="${n.href}" class="fox-nav-item${active}"><span class="fox-nav-icon">${ICONS[n.icon]}</span><span>${n.label}</span></a>`;
    }
  }
  const pageLabel = (NAV.find((n) => n.href && n.href.includes(page)) || {}).label || (page === "admin" ? "Painel Admin" : "FOXYN");

  document.body.insertAdjacentHTML("afterbegin", `
    <nav id="foxSidebar" class="fox-sidebar">
      <a href="dashboard.html" class="fox-brand"><span class="fox-logo-mark"><img src="assets/foxyn-mark.svg" alt="" /></span><span class="fox-brand-wordmark">FOX<span class="mark">YN</span></span></a>
      <div class="fox-nav">${nav}</div>
      <div class="fox-sidebar-footer">
        <div class="fox-userbox">
          <span id="foxUserAvatar" class="fox-avatar">?</span>
          <div class="fox-user-info">
            <div id="foxUserName" class="fox-user-name">Visitante</div>
            <div id="foxUserPlan" class="fox-user-plan">—</div>
          </div>
        </div>
        <button id="foxInstallBtn" class="fox-btn fox-btn--secondary fox-btn--block fox-install-btn hidden">📲 Instalar app</button>
      </div>
    </nav>
    <div id="foxOverlay" class="fox-overlay"></div>`);

  const main = document.querySelector(".fox-main");
  if (main) {
    main.insertAdjacentHTML("afterbegin", `
      <div class="fox-topbar">
        <div class="fox-topbar-context">
          <button id="foxSidebarToggle" class="fox-sidebar-toggle" aria-label="Abrir menu">☰</button>
          <span class="fox-mobile-brand">FOX<span class="mark">YN</span></span>
          <span class="fox-topbar-brand">FOXYN <span class="fox-topbar-divider"></span> <strong>${pageLabel}</strong></span>
        </div>
        <div class="fox-topbar-tools"><span class="fox-topbar-status">Sistema online</span></div>
      </div>`);
  }

  const toggleBtn = document.getElementById("foxSidebarToggle");
  const sidebar = document.getElementById("foxSidebar");
  const overlay = document.getElementById("foxOverlay");
  if (toggleBtn && sidebar)
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("open");
      overlay.classList.toggle("show", sidebar.classList.contains("open"));
    });
  if (overlay && sidebar)
    overlay.addEventListener("click", () => {
      sidebar.classList.remove("open");
      overlay.classList.remove("show");
    });
}

function renderUser(u) {
  const nameEl = document.getElementById("foxUserName");
  const avatarEl = document.getElementById("foxUserAvatar");
  const planEl = document.getElementById("foxUserPlan");
  if (nameEl) nameEl.textContent = u ? u.username : "Visitante";
  if (avatarEl) avatarEl.textContent = u ? u.username[0].toUpperCase() : "?";
  if (planEl) planEl.textContent = u ? FOXYN.planLabel(u.plan) : "—";

  // Link admin (visível só para admins)
  const nav = document.querySelector("#foxSidebar .fox-nav");
  const existing = document.querySelector("#adminNavLink");
  if (u && u.isAdmin && nav && !existing) {
    const a = document.createElement("a");
    a.href = "admin.html";
    a.id = "adminNavLink";
    a.className = "fox-nav-item";
    a.innerHTML = `<span class="fox-nav-icon">${ICONS.admin}</span><span>Painel Admin</span>`;
    nav.appendChild(a);
  }
}

// ---------- PWA: service worker + instalação ----------
let deferredPrompt = null;

function setupPWA() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  const installBtn = document.getElementById("foxInstallBtn");
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.classList.remove("hidden");
  });

  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice.catch(() => null);
      if (choice && choice.outcome === "accepted") {
        foxToast("App instalado! 🦊", "success");
        installBtn.classList.add("hidden");
      }
      deferredPrompt = null;
    });

    // Oculta se já estiver instalado (modo standalone)
    if (window.matchMedia("(display-mode: standalone)").matches) {
      installBtn.classList.add("hidden");
    }
  }
}

async function initApp(page) {
  renderSidebar(page);
  setupPWA();
  const u = API.user();
  renderUser(u);
  if (API.isAuthed()) {
    try {
      const me = await API.get("/auth/me");
      API.saveUser(me.user);
      renderUser(me.user);
    } catch {
      /* sessão inválida já tratada no cliente */
    }
  }
}
