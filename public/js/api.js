// ============================================================
// FOXYN - cliente de API (JWT) para a interface
// Nenhum segredo vive aqui; tudo passa pelo servidor (/api).
// ============================================================
const API = {
  TOKEN_KEY: "foxyn_token",

  token() {
    return localStorage.getItem(this.TOKEN_KEY);
  },
  setToken(t) {
    if (t) localStorage.setItem(this.TOKEN_KEY, t);
    else localStorage.removeItem(this.TOKEN_KEY);
  },
  logout() {
    this.setToken(null);
  },
  isAuthed() {
    return !!this.token();
  },
  user() {
    try {
      return JSON.parse(localStorage.getItem("foxyn_user") || "null");
    } catch {
      return null;
    }
  },
  saveUser(u) {
    if (u) localStorage.setItem("foxyn_user", JSON.stringify(u));
    else localStorage.removeItem("foxyn_user");
  },

  async req(method, path, body) {
    const headers = { "Content-Type": "application/json" };
    if (this.token()) headers["Authorization"] = "Bearer " + this.token();
    const res = await fetch("/api" + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* resposta sem corpo */
    }
    if (res.status === 401) {
      this.logout();
      const msg = (data && data.error) || "Sessão expirada. Entre novamente.";
      if (typeof window !== "undefined" && window.FOXYN) FOXYN.toast(msg, "error");
      setTimeout(() => (window.location.href = "index.html"), 1200);
      throw new Error(msg);
    }
    if (!res.ok) {
      const err = new Error((data && data.error) || "Erro de requisição.");
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  },

  get(path) {
    return this.req("GET", path);
  },
  post(path, body) {
    return this.req("POST", path, body);
  },
  del(path) {
    return this.req("DELETE", path);
  }
};

// ---------- Helpers de formatação ----------
function fmtReais(v) {
  if (v === null || v === undefined) return "—";
  return (v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
