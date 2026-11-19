/**
 * =====================================================================
 * UTILIDADES COMPARTIDAS DEL FRONTEND — SISTEMA REPORTE 40
 * Seguridad (XSS), normalización de DNI/IPRESS y animaciones numéricas.
 * Hecho por xzerox99
 * =====================================================================
 */

const Utils = {
  /**
   * Escapa caracteres HTML peligrosos antes de insertar texto en innerHTML.
   */
  escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },

  /**
   * Compara dos DNIs/CE manejando ceros a la izquierda.
   */
  matchesDni(a, b) {
    if (!a || !b) return false;
    const sA = String(a).trim();
    const sB = String(b).trim();
    if (sA === sB) return true;

    const stripA = sA.replace(/^0+/, "");
    const stripB = sB.replace(/^0+/, "");
    if (stripA === stripB && stripA !== "") return true;

    if (sA.length <= 8 && sB.length <= 8) {
      if (sA.padStart(8, "0") === sB.padStart(8, "0")) return true;
    }
    return false;
  },

  /**
   * Normaliza un mapa de control de IPRESS a claves en MAYÚSCULAS.
   */
  normalizeIpressMap(raw) {
    const res = {};
    if (!raw || typeof raw !== "object") return res;
    for (const [k, v] of Object.entries(raw)) {
      if (k) {
        res[k.trim().toUpperCase()] = !(v === false || v === "false" || v === 0 || v === "0");
      }
    }
    return res;
  },

  /**
   * Verifica si una IPRESS está habilitada en el mapa normalizado.
   */
  isIpressActive(estabName, controlMap) {
    if (!estabName || !controlMap || Object.keys(controlMap).length === 0) return true;
    const clean = String(estabName).trim().toUpperCase();
    if (Object.prototype.hasOwnProperty.call(controlMap, clean)) {
      return controlMap[clean] !== false;
    }
    for (const [k, v] of Object.entries(controlMap)) {
      if (k.trim().toUpperCase() === clean) {
        return v !== false && v !== "false" && v !== 0 && v !== "0";
      }
    }
    return true;
  },

  /**
   * Animación suave tipo Count-Up para KPIs numéricos (respeta prefers-reduced-motion).
   */
  _counterFrames: new WeakMap(),
  animateCounter(el, targetValue, duration = 500) {
    if (!el) return;
    const target = Math.max(0, Math.round(Number(targetValue) || 0));
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const startVal = Number(el.dataset.currentVal || 0);

    if (reduced || (startVal === target && el.textContent !== "-")) {
      el.dataset.currentVal = String(target);
      el.textContent = target.toLocaleString();
      return;
    }

    if (this._counterFrames.has(el)) {
      cancelAnimationFrame(this._counterFrames.get(el));
    }

    const startTime = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(startVal + (target - startVal) * eased).toLocaleString();
      if (p < 1) {
        this._counterFrames.set(el, requestAnimationFrame(step));
      } else {
        el.dataset.currentVal = String(target);
        el.textContent = target.toLocaleString();
        this._counterFrames.delete(el);
      }
    };
    this._counterFrames.set(el, requestAnimationFrame(step));
  },

  /**
   * Saludo institucional según la hora del día.
   */
  getGreeting() {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return "¡Buenos días!";
    if (h >= 12 && h < 19) return "¡Buenas tardes!";
    return "¡Buenas noches!";
  },

  /**
   * Obtiene iniciales de un nombre completo (ej. "GAMARRA PURE MONICA" -> "MG").
   */
  getInitials(fullName) {
    const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "PS";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  },

  /**
   * Exporta un gráfico Chart.js a PNG con fondo sólido acorde al tema actual.
   */
  downloadChartPng(chartInstance, filename = "grafico_reporte40.png") {
    if (!chartInstance || !chartInstance.canvas) {
      this.showToast("No hay datos suficientes en el gráfico para exportar.", "warning");
      return;
    }
    const srcCanvas = chartInstance.canvas;
    const tmp = document.createElement("canvas");
    tmp.width = srcCanvas.width;
    tmp.height = srcCanvas.height;
    const ctx = tmp.getContext("2d");
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    ctx.fillStyle = isDark ? "#151c2c" : "#ffffff";
    ctx.fillRect(0, 0, tmp.width, tmp.height);
    ctx.drawImage(srcCanvas, 0, 0);

    const a = document.createElement("a");
    a.href = tmp.toDataURL("image/png", 1.0);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    this.showToast("Imagen del gráfico descargada en formato PNG.", "success");
  },

  /**
   * Notificación flotante moderna (Toast) en reemplazo de alert().
   */
  showToast(message, type = "info", duration = 3800) {
    let container = document.getElementById("r40ToastContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "r40ToastContainer";
      container.className = "r40-toast-container";
      container.setAttribute("aria-live", "polite");
      document.body.appendChild(container);
    }

    const iconMap = {
      success: "bi-check-circle-fill",
      warning: "bi-exclamation-triangle-fill",
      danger: "bi-exclamation-octagon-fill",
      info: "bi-info-circle-fill"
    };
    const safeType = iconMap[type] ? type : "info";

    const toast = document.createElement("div");
    toast.className = `r40-toast r40-toast-${safeType}`;
    toast.setAttribute("role", "status");
    toast.innerHTML = `
      <i class="bi ${iconMap[safeType]} r40-toast-icon" aria-hidden="true"></i>
      <div class="r40-toast-msg">${this.escapeHtml(message)}</div>
      <button type="button" class="r40-toast-close" aria-label="Cerrar notificación">&times;</button>
      <div class="r40-toast-bar" style="animation-duration: ${duration}ms;"></div>
    `;

    const dismiss = () => {
      if (toast.dataset.closing) return;
      toast.dataset.closing = "1";
      toast.classList.add("r40-toast-hide");
      setTimeout(() => toast.remove(), 260);
    };

    toast.querySelector(".r40-toast-close").addEventListener("click", dismiss);
    container.appendChild(toast);
    setTimeout(dismiss, duration);
  },

  /**
   * Modal estilizado de confirmación (Promise<boolean>) en reemplazo de confirm().
   */
  showConfirmModal({
    title = "Confirmar acción",
    message = "¿Deseas continuar?",
    confirmText = "Confirmar",
    cancelText = "Cancelar",
    variant = "primary"
  } = {}) {
    return new Promise((resolve) => {
      if (typeof bootstrap === "undefined") {
        resolve(window.confirm(message));
        return;
      }
      const id = "r40DynamicConfirmModal";
      const prev = document.getElementById(id);
      if (prev) prev.remove();

      const iconCls = variant === "danger"
        ? "bi-exclamation-triangle-fill text-danger"
        : (variant === "warning" ? "bi-shield-exclamation text-warning" : "bi-question-circle-fill text-primary");
      const btnCls = variant === "danger"
        ? "btn btn-danger"
        : (variant === "warning" ? "btn btn-warning text-dark fw-bold" : "btn-primary-custom");

      const el = document.createElement("div");
      el.className = "modal fade";
      el.id = id;
      el.tabIndex = -1;
      el.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title h6 fw-bold text-main d-flex align-items-center gap-2">
                <i class="bi ${iconCls}"></i> <span>${this.escapeHtml(title)}</span>
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body small text-muted">${this.escapeHtml(message)}</div>
            <div class="modal-footer">
              <button type="button" class="btn btn-sm btn-secondary-custom" data-bs-dismiss="modal">${this.escapeHtml(cancelText)}</button>
              <button type="button" class="btn btn-sm ${btnCls}" id="r40ConfirmOkBtn">${this.escapeHtml(confirmText)}</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(el);
      let settled = false;
      const modal = new bootstrap.Modal(el);
      el.querySelector("#r40ConfirmOkBtn").addEventListener("click", () => {
        settled = true;
        modal.hide();
        resolve(true);
      });
      el.addEventListener("hidden.bs.modal", () => {
        el.remove();
        if (!settled) resolve(false);
      });
      modal.show();
    });
  },

  /**
   * Modal estilizado de entrada (Promise<string|null>) en reemplazo de prompt().
   */
  showPromptModal({
    title = "Ingresar dato",
    message = "",
    placeholder = "",
    confirmText = "Aceptar",
    cancelText = "Cancelar"
  } = {}) {
    return new Promise((resolve) => {
      if (typeof bootstrap === "undefined") {
        resolve(window.prompt(message));
        return;
      }
      const id = "r40DynamicPromptModal";
      const prev = document.getElementById(id);
      if (prev) prev.remove();

      const el = document.createElement("div");
      el.className = "modal fade";
      el.id = id;
      el.tabIndex = -1;
      el.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <form id="r40PromptForm">
              <div class="modal-header">
                <h5 class="modal-title h6 fw-bold text-main">
                  <i class="bi bi-pencil-square text-primary me-2"></i>${this.escapeHtml(title)}
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
              </div>
              <div class="modal-body">
                ${message ? `<p class="small text-muted mb-2">${this.escapeHtml(message)}</p>` : ""}
                <input type="text" class="form-control" id="r40PromptInput" placeholder="${this.escapeHtml(placeholder)}" required>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-sm btn-secondary-custom" data-bs-dismiss="modal">${this.escapeHtml(cancelText)}</button>
                <button type="submit" class="btn btn-sm btn-primary-custom">${this.escapeHtml(confirmText)}</button>
              </div>
            </form>
          </div>
        </div>
      `;
      document.body.appendChild(el);
      let settled = false;
      const modal = new bootstrap.Modal(el);
      const input = el.querySelector("#r40PromptInput");
      el.addEventListener("shown.bs.modal", () => input.focus());
      el.querySelector("#r40PromptForm").addEventListener("submit", (e) => {
        e.preventDefault();
        settled = true;
        const val = input.value;
        modal.hide();
        resolve(val);
      });
      el.addEventListener("hidden.bs.modal", () => {
        el.remove();
        if (!settled) resolve(null);
      });
      modal.show();
    });
  }
};
