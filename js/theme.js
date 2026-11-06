/**
 * =====================================================================
 * GESTOR DE TEMA: CLARO / OSCURO
 * Hecho por xzerox99
 * =====================================================================
 */

(function () {
  const THEME_STORAGE_KEY = "reporte40_theme_preference";

  // Determinar tema inicial
  function getPreferredTheme() {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved) return saved;
    // Si el sistema operativo prefiere oscuro
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  }

  // Aplicar tema en el elemento <html>
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    updateThemeToggleButtons(theme);
  }

  // Actualizar icono y texto en los botones
  function updateThemeToggleButtons(theme) {
    const buttons = document.querySelectorAll(".theme-toggle-btn");
    buttons.forEach((btn) => {
      if (theme === "dark") {
        btn.innerHTML = '<i class="bi bi-sun-fill text-warning"></i> <span>Claro</span>';
        btn.setAttribute("title", "Cambiar a modo claro");
      } else {
        btn.innerHTML = '<i class="bi bi-moon-stars-fill text-primary"></i> <span>Oscuro</span>';
        btn.setAttribute("title", "Cambiar a modo oscuro");
      }
    });
  }

  // Alternar entre temas
  window.toggleTheme = function () {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
  };

  // Inicialización inmediata para evitar parpadeo
  const initialTheme = getPreferredTheme();
  applyTheme(initialTheme);

  // Escuchar cuando el DOM cargue para vincular botones
  document.addEventListener("DOMContentLoaded", () => {
    updateThemeToggleButtons(document.documentElement.getAttribute("data-theme") || "light");
    const buttons = document.querySelectorAll(".theme-toggle-btn");
    buttons.forEach((btn) => {
      btn.addEventListener("click", window.toggleTheme);
    });
  });
})();

