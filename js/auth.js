/**
 * =====================================================================
 * GESTOR DE AUTENTICACIÓN Y SESIONES
 * Hecho por xzerox99
 * =====================================================================
 */

const Auth = {
  SESSION_KEY: "reporte40_user_session",
  TOKEN_KEY: "reporte40_session_token",

  // Hash SHA-256 usando Web Crypto API nativo del navegador
  async hashPassword(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(String(text).trim());
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  },

  // Obtener usuario actual en sesión
  getCurrentUser() {
    try {
      const data = sessionStorage.getItem(this.SESSION_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  // Obtener token de sesión emitido por el servidor
  getToken() {
    try {
      return sessionStorage.getItem(this.TOKEN_KEY) || "";
    } catch (e) {
      return "";
    }
  },

  // Guardar sesión y token opcional
  setSession(user, token = null) {
    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(user));
    if (token) {
      sessionStorage.setItem(this.TOKEN_KEY, String(token));
    }
  },

  // Cerrar sesión
  logout() {
    sessionStorage.removeItem(this.SESSION_KEY);
    sessionStorage.removeItem(this.TOKEN_KEY);
    window.location.href = "index.html";
  },

  // Verificar si está autenticado
  isLoggedIn() {
    return this.getCurrentUser() !== null;
  },

  // Verificar si es administrador
  isAdmin() {
    const user = this.getCurrentUser();
    return user && (user.rol === "admin" || user.dni === CONFIG.ADMIN_DEFAULT_DNI);
  },

  // Guardias de navegación
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = "index.html";
      return false;
    }
    return true;
  },

  requireAdmin() {
    if (!this.isLoggedIn()) {
      window.location.href = "index.html";
      return false;
    }
    if (!this.isAdmin()) {
      alert("Acceso denegado: Se requiere rol de Administrador.");
      window.location.href = "dashboard.html";
      return false;
    }
    return true;
  }
};

