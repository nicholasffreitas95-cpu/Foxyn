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

const NAV = [
  { section: "Principal" },
  { href: "dashboard.html", icon: "◎", label: "Dashboard" },
  { href: "meu-pc.html", icon: "🖥️", label: "Meu PC" },
  { href: "benchmark.html", icon: "📊", label: "Benchmark" },
  { section: "Oportunidades" },
  { href: "radar-precos.html", icon: "📡", label: "Radar de Preços" },
  { href: "alertas.html", icon: "🔔", label: "Alertas" },
  { section: "Foxyn" },
  { href: "foxyn-ai.html", icon: "🦊", label: "Foxyn AI" },
  { href: "conquistas.html", icon: "🏅", label: "Conquistas" },
  { href: "planos.html", icon: "💎", label: "Meu Plano" }
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
      nav += `<a href="${n.href}" class="fox-nav-item${active}"><span class="fox-nav-icon">${n.icon}</span> ${n.label}</a>`;
    }
  }

  document.body.insertAdjacentHTML("afterbegin", `
    <nav id="foxSidebar" class="fox-sidebar">
      <a href="dashboard.html" class="fox-brand"><span class="fox-logo-mark">🦊</span><span>FOX<span class="mark">YN</span></span></a>
      <div class="fox-nav">${nav}</div>
      <div class="fox-sidebar-footer">
        <div class="fox-userbox">
          <span id="foxUserAvatar" class="fox-avatar">?</span>
          <div class="fox-user-info">
            <div id="foxUserName" class="fox-user-name">Visitante</div>
            <div id="foxUserPlan" class="fox-user-plan">—</div>
          </div>
        </div>
      </div>
    </nav>
    <div id="foxOverlay" class="fox-overlay"></div>`);

  const main = document.querySelector(".fox-main");
  if (main) {
    main.insertAdjacentHTML("afterbegin", `
      <div class="fox-topbar">
        <button id="foxSidebarToggle" class="fox-sidebar-toggle" aria-label="Abrir menu">☰</button>
        <span class="fox-mobile-brand">FOX<span class="mark">YN</span></span>
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
    a.innerHTML = '<span class="fox-nav-icon">🛠️</span> Painel Admin';
    nav.appendChild(a);
  }
}

async function initApp(page) {
  renderSidebar(page);
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
