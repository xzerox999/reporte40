/**
 * =====================================================================
 * GESTOR DE AUTENTICACIÓN Y SESIONES
 * Hecho por xzerox99
 * =====================================================================
 */

const Auth = {
  SESSION_KEY: "reporte40_user_session",

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

  // Guardar sesión
  setSession(user) {
    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(user));
  },

  // Cerrar sesión
  logout() {
    sessionStorage.removeItem(this.SESSION_KEY);
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

