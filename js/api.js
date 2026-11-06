/**
 * =====================================================================
 * CLIENTE API — CONEXIÓN CON GOOGLE APPS SCRIPT / DEMO FALLBACK
 * Hecho por xzerox99
 * =====================================================================
 */

const Api = {
  // Caché de datos demo
  _demoData: null,

  async loadDemoData() {
    if (!this._demoData) {
      // 0. Si hay datos actualizados subidos por el administrador en localStorage
      const override = localStorage.getItem("DEMO_DATA_OVERRIDE");
      if (override) {
        try {
          this._demoData = JSON.parse(override);
          return this._demoData;
        } catch (e) {
          console.warn("Error leyendo DEMO_DATA_OVERRIDE:", e);
        }
      }
      // 1. Si está cargado mediante data/demo_data.js (funciona con doble clic directo file://)
      if (window.DEMO_DATA) {
        this._demoData = window.DEMO_DATA;
        return this._demoData;
      }
      // 2. Si se ejecuta sobre servidor HTTP / GitHub Pages
      try {
        const resp = await fetch("data/demo_data.json");
        this._demoData = await resp.json();
      } catch (err) {
        console.warn("No se pudo cargar demo_data.json:", err);
      }
    }
    return this._demoData;
  },

  // Método universal para llamar a Apps Script
  async callAppsScript(action, params = {}) {
    const isLive = CONFIG.API_URL && CONFIG.API_URL.trim().length > 10;

    if (isLive) {
      try {
        const payload = { action, ...params };
        const response = await fetch(CONFIG.API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload)
        });
        return await response.json();
      } catch (error) {
        console.warn("Fallo al conectar con Google Apps Script, usando fallback local:", error);
      }
    }

    // Modo local / Fallback con los datos extraídos del Excel
    return await this.handleLocalMock(action, params);
  },

  // Comparador flexible de DNI / Carnet de Extranjería con ceros a la izquierda
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

  findInMapByDni(inputDni, map) {
    if (!map || !inputDni) return null;
    const raw = String(inputDni).trim();
    if (map[raw]) return { key: raw, data: map[raw] };

    if (raw.length < 8) {
      const pad8 = raw.padStart(8, "0");
      if (map[pad8]) return { key: pad8, data: map[pad8] };
    }

    const stripped = raw.replace(/^0+/, "");
    if (map[stripped]) return { key: stripped, data: map[stripped] };

    for (const k of Object.keys(map)) {
      if (this.matchesDni(k, raw)) {
        return { key: k, data: map[k] };
      }
    }
    return null;
  },

  // Manejo de peticiones cuando se usa el modo offline/demo
  async handleLocalMock(action, params) {
    const data = await this.loadDemoData();
    if (!data) {
      return { success: false, message: "No se encontraron datos disponibles." };
    }

    const dni = String(params.dni || "").trim();

    switch (action) {
      case "login": {
        const inputHash = await Auth.hashPassword(params.password);
        const rawPass = String(params.password || "").trim();
        
        // 1. Chequeo Admin
        if (dni === CONFIG.ADMIN_DEFAULT_DNI) {
          if (inputHash === data.admin.password_hash) {
            return {
              success: true,
              user: {
                dni: CONFIG.ADMIN_DEFAULT_DNI,
                nombre: "ADMINISTRADOR DEL SISTEMA",
                rol: "admin",
                establecimiento: "SEDE RED CUSCO SUR",
                microred: "RED CUSCO SUR",
                colegio: "DIRECCIÓN EJECUTIVA"
              }
            };
          } else {
            return { success: false, message: "Contraseña de administrador incorrecta." };
          }
        }

        // 2. Chequeo Usuario Personal con soporte para ceros iniciales
        const userMatch = this.findInMapByDni(dni, data.usuarios);
        if (!userMatch) {
          return { success: false, message: "DNI no encontrado en el padrón de personal." };
        }

        const user = userMatch.data;
        const canonicalDni = user.dni || userMatch.key;

        // En local, verificar si hay contraseña modificada guardada en localStorage
        const customPassKey = "custom_pass_" + canonicalDni;
        const customPassKeyRaw = "custom_pass_" + dni;
        const savedCustomHash = localStorage.getItem(customPassKey) || localStorage.getItem(customPassKeyRaw);

        // Si nunca cambió clave, su clave inicial es su DNI (aceptando con o sin ceros)
        const isDefaultPassword = this.matchesDni(rawPass, dni) || this.matchesDni(rawPass, canonicalDni);
        const expectedHash = savedCustomHash || (await Auth.hashPassword(canonicalDni));

        if (inputHash === expectedHash || isDefaultPassword) {
          return {
            success: true,
            user: {
              dni: canonicalDni,
              nombre: user.nombre,
              rol: "usuario",
              establecimiento: user.establecimiento,
              microred: user.microred || "",
              colegio: user.colegio || ""
            }
          };
        } else {
          return { success: false, message: "Contraseña incorrecta." };
        }
      }

      case "changePassword": {
        const userMatch = this.findInMapByDni(dni, data.usuarios);
        const canonicalDni = userMatch ? (userMatch.data.dni || userMatch.key) : dni;
        const customPassKey = "custom_pass_" + canonicalDni;
        const savedCustomHash = localStorage.getItem(customPassKey);
        const expectedHash = savedCustomHash || (await Auth.hashPassword(canonicalDni));
        const oldHash = await Auth.hashPassword(params.oldPassword);
        const isDefaultOld = this.matchesDni(params.oldPassword, dni) || this.matchesDni(params.oldPassword, canonicalDni);

        if (oldHash !== expectedHash && !isDefaultOld) {
          return { success: false, message: "La contraseña actual no es correcta." };
        }

        const newHash = await Auth.hashPassword(params.newPassword);
        localStorage.setItem(customPassKey, newHash);
        localStorage.setItem("custom_pass_" + dni, newHash);
        return { success: true, message: "Contraseña actualizada exitosamente." };
      }

      case "getData": {
        const atdMatch = this.findInMapByDni(dni, data.atd_atc);
        const appMatch = this.findInMapByDni(dni, data.app);
        return {
          success: true,
          atd_atc: atdMatch ? atdMatch.data : null,
          app: appMatch ? appMatch.data : null
        };
      }

      case "logDownload": {
        const localLogsKey = "reporte40_download_logs";
        let logs = [];
        try {
          logs = JSON.parse(localStorage.getItem(localLogsKey)) || [];
        } catch (e) {
          logs = [];
        }
        logs.unshift({
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleString(),
          dni: params.dni || "",
          personal: params.personal || "",
          establecimiento: params.establecimiento || "",
          meses: params.meses || "",
          tipo: params.tipo || "PDF_REPORTE40"
        });
        localStorage.setItem(localLogsKey, JSON.stringify(logs.slice(0, 500)));
        return { success: true, message: "Descarga registrada localmente." };
      }

      case "adminGetUsers": {
        const list = Object.values(data.usuarios).map(u => ({
          dni: u.dni,
          nombre: u.nombre,
          rol: u.dni === CONFIG.ADMIN_DEFAULT_DNI ? "admin" : "usuario",
          establecimiento: u.establecimiento,
          microred: u.microred,
          colegio: u.colegio,
          ultimo_acceso: ""
        }));
        return { success: true, users: list };
      }

      case "adminResetPassword": {
        const targetDni = String(params.targetDni || "").trim();
        const customPassKey = "custom_pass_" + targetDni;
        const newPass = params.newPassword ? String(params.newPassword).trim() : targetDni;
        const newHash = await Auth.hashPassword(newPass);
        localStorage.setItem(customPassKey, newHash);
        return {
          success: true,
          message: `Contraseña restablecida exitosamente para el DNI ${targetDni}. Nueva contraseña: ${newPass}`
        };
      }

      case "adminGetLogs": {
        const localLogsKey = "reporte40_download_logs";
        let logs = [];
        try {
          logs = JSON.parse(localStorage.getItem(localLogsKey)) || [];
        } catch (e) {
          logs = [];
        }
        return { success: true, logs };
      }

      case "adminExportAll": {
        return {
          success: true,
          users: Object.values(data.usuarios),
          usuarios: Object.values(data.usuarios),
          atd_atc: Object.values(data.atd_atc),
          app: Object.values(data.app)
        };
      }

      default:
        return { success: false, message: "Acción desconocida" };
    }
  }
};

