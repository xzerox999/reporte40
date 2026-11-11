/**
 * =====================================================================
 * SISTEMA REPORTE 40 — BACKEND GOOGLE APPS SCRIPT
 * Desarrollado para Red de Servicios de Salud Cusco Sur
 * Hecho por xzerox99
 * =====================================================================
 * 
 * INSTRUCCIONES DE DESPLIEGUE:
 * 1. Abre tu Google Spreadsheet creado para el sistema.
 * 2. Ve al menú superior: Extensiones > Apps Script.
 * 3. Borra el código que haya y pega TODO este archivo.
 * 4. Haz clic en "Implementar" > "Nueva implementación".
 * 5. Tipo: "Aplicación web".
 * 6. Descripción: "API Reporte 40 v1.0".
 * 7. Ejecutar como: "Yo (tu cuenta de correo)".
 * 8. Quién tiene acceso: "Cualquier persona" (Anyone).
 * 9. Haz clic en "Implementar", autoriza los permisos y COPIA la URL generada.
 * 10. Pega esa URL en tu archivo js/config.js (const API_URL = "tu_url").
 */

// Configuración de nombres de hojas por defecto
const DEFAULT_CONFIG = {
  SHEET_USERS: "USUARIOS",
  SHEET_ATD_ATC: "DATA_ATD_ATC",
  SHEET_APP: "DATA_APP",
  SHEET_DIARIO: "DATA_DIARIO",
  SHEET_LOGS: "LOG_DESCARGAS",
  SHEET_CONFIG: "CONFIG",
  ADMIN_DEFAULT_DNI: "46638223"
};

/**
 * Función de inicialización automática: crea las hojas si no existen
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Hoja USUARIOS
  let wsUsers = ss.getSheetByName(DEFAULT_CONFIG.SHEET_USERS);
  if (!wsUsers) {
    wsUsers = ss.insertSheet(DEFAULT_CONFIG.SHEET_USERS);
    wsUsers.appendRow([
      "dni", "nombre", "password_hash", "rol", 
      "establecimiento", "microred", "colegio", 
      "fecha_creacion", "ultimo_acceso"
    ]);
    // Crear admin por defecto: pass comatose -> 00c803d2bb6e38f04a41882a17ec10ef40855fba37fcbea08d29777c3e2cc6ea
    wsUsers.appendRow([
      "46638223", "ADMINISTRADOR DEL SISTEMA", 
      "00c803d2bb6e38f04a41882a17ec10ef40855fba37fcbea08d29777c3e2cc6ea", 
      "admin", "SEDE RED CUSCO SUR", "RED CUSCO SUR", "ADMINISTRACIÓN",
      new Date().toISOString(), ""
    ]);
  }

  // 2. Hoja LOG_DESCARGAS
  let wsLogs = ss.getSheetByName(DEFAULT_CONFIG.SHEET_LOGS);
  if (!wsLogs) {
    wsLogs = ss.insertSheet(DEFAULT_CONFIG.SHEET_LOGS);
    wsLogs.appendRow([
      "id", "timestamp", "dni", "personal", "establecimiento", "meses", "tipo_reporte", "ip"
    ]);
  }

  // 3. Hoja CONFIG
  let wsConf = ss.getSheetByName(DEFAULT_CONFIG.SHEET_CONFIG);
  if (!wsConf) {
    wsConf = ss.insertSheet(DEFAULT_CONFIG.SHEET_CONFIG);
    wsConf.appendRow(["clave", "valor", "descripcion"]);
    wsConf.appendRow(["hoja_atd_atc", "DATA_ATD_ATC", "Nombre de la hoja de atenciones"]);
    wsConf.appendRow(["hoja_app", "DATA_APP", "Nombre de la hoja de APP"]);
    wsConf.appendRow(["hoja_usuarios", "USUARIOS", "Nombre de la hoja de usuarios"]);
    wsConf.appendRow(["hoja_logs", "LOG_DESCARGAS", "Nombre de la hoja de logs"]);
  }

  return "Configuración completada exitosamente.";
}

/**
 * Obtener nombre dinámico de una hoja desde CONFIG
 */
function getSheetName(key, defaultVal) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const confSheet = ss.getSheetByName(DEFAULT_CONFIG.SHEET_CONFIG);
    if (!confSheet) return defaultVal;
    
    const data = confSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key && data[i][1]) {
        return String(data[i][1]).trim();
      }
    }
  } catch (e) {
    // Si falla, usar default
  }
  return defaultVal;
}

/**
 * Router para GET (soporta JSONP y peticiones directas para evitar CORS)
 */
function doGet(e) {
  return handleRequest(e, e.parameter);
}

/**
 * Router para POST (JSON en payload)
 */
function doPost(e) {
  let params = {};
  try {
    if (e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      params = e.parameter;
    }
  } catch (err) {
    params = e.parameter || {};
  }
  return handleRequest(e, params);
}

/**
 * Controlador principal
 */
function handleRequest(e, params) {
  const action = params.action;
  const callback = (e && e.parameter && e.parameter.callback) || null;
  let responseData = { success: false, message: "Acción no reconocida" };

  try {
    switch (action) {
      case "ping":
        responseData = { success: true, message: "API Reporte 40 activa", timestamp: new Date() };
        break;

      case "login":
        responseData = apiLogin(params.dni, params.password);
        break;

      case "changePassword":
        responseData = apiChangePassword(params.dni, params.oldPassword, params.newPassword);
        break;

      case "getData":
        responseData = apiGetData(params.dni);
        break;

      case "logDownload":
        responseData = apiLogDownload(params);
        break;

      case "adminGetUsers":
        responseData = apiAdminGetUsers(params.adminDni);
        break;

      case "adminResetPassword":
        responseData = apiAdminResetPassword(params.adminDni, params.targetDni, params.newPassword);
        break;

      case "adminGetLogs":
        responseData = apiAdminGetLogs(params.adminDni);
        break;

      case "adminExportAll":
        responseData = apiAdminExportAll(params.adminDni);
        break;

      case "getIpressControl":
        responseData = apiGetIpressControl();
        break;

      case "adminSaveIpressControl":
        responseData = apiAdminSaveIpressControl(params.adminDni, params.ipressStatus);
        break;

      case "adminSyncUsers":
        responseData = apiAdminSyncUsers(params.adminDni, params.users);
        break;

      case "getEnabledYears":
        responseData = apiGetEnabledYears();
        break;

      case "adminSaveEnabledYears":
        responseData = apiAdminSaveEnabledYears(params.adminDni, params.years);
        break;

      default:
        responseData = { success: false, message: "Acción inválida: " + action };
    }
  } catch (error) {
    responseData = { success: false, message: "Error interno: " + error.toString() };
  }

  // Respuesta compatible con JSON y JSONP (para evitar cualquier bloqueo de navegador)
  const jsonOutput = JSON.stringify(responseData);
  if (callback) {
    return ContentService.createTextOutput(callback + "(" + jsonOutput + ")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } else {
    return ContentService.createTextOutput(jsonOutput)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Hash SHA-256 en Google Apps Script
 */
function computeSHA256(text) {
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text).trim(), Utilities.Charset.UTF_8);
  let hashStr = "";
  for (let i = 0; i < rawHash.length; i++) {
    let byteVal = rawHash[i];
    if (byteVal < 0) byteVal += 256;
    let byteHex = byteVal.toString(16);
    if (byteHex.length === 1) byteHex = "0" + byteHex;
    hashStr += byteHex;
  }
  return hashStr;
}

/**
 * Comparador flexible de DNI / Carnet de Extranjería
 * Maneja ceros a la izquierda (ej. 02442082 vs 2442082, 004704812 vs 4704812)
 */
function matchesDni(a, b) {
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
}

/**
 * 1. Login de Usuario o Admin
 */
function apiLogin(dni, password) {
  if (!dni || !password) {
    return { success: false, message: "DNI y contraseña requeridos" };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = getSheetName("hoja_usuarios", DEFAULT_CONFIG.SHEET_USERS);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { success: false, message: "Hoja de usuarios no encontrada" };

  const cleanDni = String(dni).trim();
  const inputHash = computeSHA256(password);
  const rawPass = String(password).trim();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const rowDni = String(data[i][0]).trim();
    if (matchesDni(rowDni, cleanDni)) {
      const storedHash = String(data[i][2]).trim();

      // Verificar si coincide con el hash guardado, o con la clave por defecto (su DNI con o sin ceros)
      const isDefaultPass = matchesDni(rawPass, rowDni) || matchesDni(rawPass, cleanDni);
      const isHashMatch = (storedHash === inputHash) ||
                          (storedHash === computeSHA256(cleanDni)) ||
                          (storedHash === computeSHA256(rowDni)) ||
                          (storedHash === computeSHA256(cleanDni.replace(/^0+/, ""))) ||
                          (storedHash === computeSHA256(cleanDni.padStart(8, "0")));

      if (isHashMatch || isDefaultPass) {
        // Actualizar último acceso
        sheet.getRange(i + 1, 9).setValue(new Date().toISOString());

        return {
          success: true,
          user: {
            dni: rowDni,
            nombre: data[i][1],
            rol: data[i][3] || "usuario",
            establecimiento: data[i][4] || "",
            microred: data[i][5] || "",
            colegio: data[i][6] || ""
          },
          ipress_control: getIpressControlMap(),
          anios_habilitados: getEnabledYears()
        };
      } else {
        return { success: false, message: "Contraseña incorrecta" };
      }
    }
  }

  return { success: false, message: "Usuario (DNI) no encontrado" };
}

/**
 * 2. Cambiar contraseña
 */
function apiChangePassword(dni, oldPassword, newPassword) {
  if (!dni || !oldPassword || !newPassword) {
    return { success: false, message: "Todos los campos son obligatorios" };
  }
  if (newPassword.length < 4) {
    return { success: false, message: "La nueva contraseña debe tener al menos 4 caracteres" };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = getSheetName("hoja_usuarios", DEFAULT_CONFIG.SHEET_USERS);
  const sheet = ss.getSheetByName(sheetName);
  const cleanDni = String(dni).trim();
  const oldHash = computeSHA256(oldPassword);
  const newHash = computeSHA256(newPassword);
  const rawOld = String(oldPassword).trim();

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const rowDni = String(data[i][0]).trim();
    if (matchesDni(rowDni, cleanDni)) {
      const storedHash = String(data[i][2]).trim();
      const isDefaultOld = matchesDni(rawOld, rowDni) || matchesDni(rawOld, cleanDni);
      if (storedHash === oldHash || isDefaultOld) {
        sheet.getRange(i + 1, 3).setValue(newHash);
        return { success: true, message: "Contraseña cambiada exitosamente" };
      } else {
        return { success: false, message: "La contraseña actual es incorrecta" };
      }
    }
  }
  return { success: false, message: "Usuario no encontrado" };
}

/**
 * 3. Obtener datos de producción por DNI (Consolidado + Detalle por Establecimiento)
 */
function apiGetData(dni) {
  if (!dni) return { success: false, message: "DNI requerido" };
  const cleanDni = String(dni).trim();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SET", "OCT", "NOV"];

  // Hoja ATD / ATC
  const atdSheetName = getSheetName("hoja_atd_atc", DEFAULT_CONFIG.SHEET_ATD_ATC);
  const atdSheet = ss.getSheetByName(atdSheetName);
  let atdData = null;

  if (atdSheet) {
    const rows = atdSheet.getDataRange().getValues();
    const porEstab = {};
    const consMeses = {};
    for (let m = 0; m < MESES.length; m++) {
      consMeses[MESES[m]] = { atc: 0, atd: 0 };
    }
    let totalAtcSum = 0;
    let totalAtdSum = 0;
    let estabPrincipal = "";
    let maxProd = -1;
    let personalNombre = "";

    for (let i = 1; i < rows.length; i++) {
      if (matchesDni(rows[i][1], cleanDni)) {
        const r = rows[i];
        const estab = String(r[0]).trim();
        personalNombre = String(r[2]).trim();

        const mesesObj = {};
        for (let mIdx = 0; mIdx < MESES.length; mIdx++) {
          const mKey = MESES[mIdx];
          const atcVal = Number(r[3 + (mIdx * 2)]) || 0;
          const atdVal = Number(r[4 + (mIdx * 2)]) || 0;
          mesesObj[mKey] = { atc: atcVal, atd: atdVal };
          consMeses[mKey].atc += atcVal;
          consMeses[mKey].atd += atdVal;
        }

        const rowTotalAtc = Number(r[25]) || 0;
        const rowTotalAtd = Number(r[26]) || 0;
        totalAtcSum += rowTotalAtc;
        totalAtdSum += rowTotalAtd;

        if (rowTotalAtc > maxProd) {
          maxProd = rowTotalAtc;
          estabPrincipal = estab;
        }

        porEstab[estab] = {
          meses: mesesObj,
          total_atc: rowTotalAtc,
          total_atd: rowTotalAtd
        };
      }
    }

    if (Object.keys(porEstab).length > 0) {
      atdData = {
        dni: cleanDni,
        personal: personalNombre,
        establecimiento_principal: estabPrincipal,
        establecimientos: Object.keys(porEstab),
        consolidado: {
          meses: consMeses,
          total_atc: totalAtcSum,
          total_atd: totalAtdSum
        },
        por_establecimiento: porEstab
      };
    }
  }

  // Hoja APP
  const appSheetName = getSheetName("hoja_app", DEFAULT_CONFIG.SHEET_APP);
  const appSheet = ss.getSheetByName(appSheetName);
  let appData = null;

  if (appSheet) {
    const rows = appSheet.getDataRange().getValues();
    const porEstabApp = {};
    const consAppMeses = {};
    for (let m = 0; m < MESES.length; m++) {
      consAppMeses[MESES[m]] = 0;
    }
    let totalAppSum = 0;
    let personalNombreApp = "";

    for (let i = 1; i < rows.length; i++) {
      if (matchesDni(rows[i][2], cleanDni)) {
        const r = rows[i];
        const microred = String(r[0]).trim();
        const estab = String(r[1]).trim();
        personalNombreApp = String(r[3]).trim();

        const mesesAppObj = {};
        for (let mIdx = 0; mIdx < MESES.length; mIdx++) {
          const mKey = MESES[mIdx];
          const appVal = Number(r[4 + mIdx]) || 0;
          mesesAppObj[mKey] = appVal;
          consAppMeses[mKey] += appVal;
        }

        const rowTotalApp = Number(r[15]) || 0;
        totalAppSum += rowTotalApp;

        porEstabApp[estab] = {
          microred: microred,
          meses: mesesAppObj,
          total: rowTotalApp
        };
      }
    }

    if (Object.keys(porEstabApp).length > 0) {
      appData = {
        dni: cleanDni,
        personal: personalNombreApp,
        consolidado: {
          meses: consAppMeses,
          total: totalAppSum
        },
        por_establecimiento: porEstabApp
      };
    }
  }

  // 3. Obtener Datos Diarios (si la hoja DATA_DIARIO existe)
  let diarioData = {};
  const diarioSheetName = getSheetName("hoja_diario", DEFAULT_CONFIG.SHEET_DIARIO);
  const diarioSheet = ss.getSheetByName(diarioSheetName);

  if (diarioSheet) {
    const dRows = diarioSheet.getDataRange().getValues();
    // dRows: [mes, dni, personal, d01_atc, d01_atd, ..., d31_atc, d31_atd, total_atc, total_atd]
    for (let i = 1; i < dRows.length; i++) {
      if (matchesDni(dRows[i][1], cleanDni)) {
        const r = dRows[i];
        const mKey = String(r[0]).trim().toUpperCase();
        const diasObj = {};
        for (let d = 1; d <= 31; d++) {
          const dStr = (d < 10 ? "0" : "") + d;
          const atcIdx = 3 + (d - 1) * 2;
          const atdIdx = atcIdx + 1;
          diasObj[dStr] = {
            atc: Number(r[atcIdx]) || 0,
            atd: Number(r[atdIdx]) || 0
          };
        }
        diarioData[mKey] = {
          mes: mKey,
          dias: diasObj,
          total_atc: Number(r[65]) || 0,
          total_atd: Number(r[66]) || 0
        };
      }
    }
  }

  return {
    success: true,
    atd_atc: atdData,
    app: appData,
    diario: Object.keys(diarioData).length > 0 ? diarioData : null,
    ipress_control: getIpressControlMap(),
    anios_habilitados: getEnabledYears()
  };
}

/**
 * 4. Registrar descarga de PDF
 */
function apiLogDownload(params) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheetName = getSheetName("hoja_logs", DEFAULT_CONFIG.SHEET_LOGS);
  let logSheet = ss.getSheetByName(logSheetName);
  if (!logSheet) {
    logSheet = ss.insertSheet(logSheetName);
    logSheet.appendRow(["id", "timestamp", "dni", "personal", "establecimiento", "meses", "tipo_reporte", "ip"]);
  }

  const logId = Utilities.getUuid().substring(0, 8);
  const nowStr = Utilities.formatDate(new Date(), "America/Lima", "yyyy-MM-dd HH:mm:ss");

  logSheet.appendRow([
    logId,
    nowStr,
    params.dni || "",
    params.personal || "",
    params.establecimiento || "",
    params.meses || "",
    params.tipo || "PDF_REPORTE40",
    params.ip || ""
  ]);

  return { success: true, message: "Descarga registrada" };
}

/**
 * 5. Admin: Listar usuarios
 */
function apiAdminGetUsers(adminDni) {
  if (!checkAdminRole(adminDni)) {
    return { success: false, message: "Acceso no autorizado para este usuario" };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = getSheetName("hoja_usuarios", DEFAULT_CONFIG.SHEET_USERS);
  const sheet = ss.getSheetByName(sheetName);
  const rows = sheet.getDataRange().getValues();

  const users = [];
  for (let i = 1; i < rows.length; i++) {
    users.push({
      dni: String(rows[i][0]),
      nombre: rows[i][1],
      rol: rows[i][3],
      establecimiento: rows[i][4],
      microred: rows[i][5],
      colegio: rows[i][6],
      ultimo_acceso: rows[i][8]
    });
  }

  return { success: true, users: users };
}

/**
 * 6. Admin: Resetear contraseña de un personal
 */
function apiAdminResetPassword(adminDni, targetDni, newPassword) {
  if (!checkAdminRole(adminDni)) {
    return { success: false, message: "Acceso no autorizado" };
  }

  const cleanTarget = String(targetDni).trim();
  const cleanPass = newPassword ? String(newPassword).trim() : cleanTarget; // Si no pone clave, se resetea a su DNI
  const newHash = computeSHA256(cleanPass);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = getSheetName("hoja_usuarios", DEFAULT_CONFIG.SHEET_USERS);
  const sheet = ss.getSheetByName(sheetName);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === cleanTarget) {
      sheet.getRange(i + 1, 3).setValue(newHash);
      return { 
        success: true, 
        message: "Contraseña restablecida exitosamente para el DNI " + cleanTarget + " (Nueva contraseña: " + cleanPass + ")" 
      };
    }
  }

  return { success: false, message: "Usuario no encontrado" };
}

/**
 * 7. Admin: Ver logs de descargas
 */
function apiAdminGetLogs(adminDni) {
  if (!checkAdminRole(adminDni)) {
    return { success: false, message: "Acceso denegado" };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheetName = getSheetName("hoja_logs", DEFAULT_CONFIG.SHEET_LOGS);
  const logSheet = ss.getSheetByName(logSheetName);
  if (!logSheet) return { success: true, logs: [] };

  const rows = logSheet.getDataRange().getValues();
  const logs = [];

  // Recorrer del más reciente al más antiguo (máximo 500 registros)
  for (let i = rows.length - 1; i >= 1; i--) {
    logs.push({
      id: rows[i][0],
      timestamp: rows[i][1],
      dni: rows[i][2],
      personal: rows[i][3],
      establecimiento: rows[i][4],
      meses: rows[i][5],
      tipo: rows[i][6]
    });
    if (logs.length >= 500) break;
  }

  return { success: true, logs: logs };
}

/**
 * 8. Admin: Exportar toda la base de datos
 */
function apiAdminExportAll(adminDni) {
  if (!checkAdminRole(adminDni)) {
    return { success: false, message: "Acceso denegado" };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const atdSheet = ss.getSheetByName(getSheetName("hoja_atd_atc", DEFAULT_CONFIG.SHEET_ATD_ATC));
  const appSheet = ss.getSheetByName(getSheetName("hoja_app", DEFAULT_CONFIG.SHEET_APP));
  const userSheet = ss.getSheetByName(getSheetName("hoja_usuarios", DEFAULT_CONFIG.SHEET_USERS));
  const logSheet = ss.getSheetByName(getSheetName("hoja_logs", DEFAULT_CONFIG.SHEET_LOGS));

  return {
    success: true,
    atd_atc: atdSheet ? atdSheet.getDataRange().getValues() : [],
    app: appSheet ? appSheet.getDataRange().getValues() : [],
    users: userSheet ? userSheet.getDataRange().getValues() : [],
    logs: logSheet ? logSheet.getDataRange().getValues() : []
  };
}

/**
 * Helper: Validar si un DNI tiene rol de administrador
 */
function checkAdminRole(dni) {
  if (!dni) return false;
  const cleanDni = String(dni).trim();
  if (cleanDni === DEFAULT_CONFIG.ADMIN_DEFAULT_DNI) return true;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = getSheetName("hoja_usuarios", DEFAULT_CONFIG.SHEET_USERS);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return false;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (matchesDni(data[i][0], cleanDni) && String(data[i][3]).toLowerCase() === "admin") {
      return true;
    }
  }
  return false;
}

/**
 * 9. Obtener mapa de control de disponibilidad por IPRESS desde la hoja CONFIG
 */
function getIpressControlMap() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const confSheet = ss.getSheetByName(DEFAULT_CONFIG.SHEET_CONFIG);
    if (!confSheet) return {};
    const data = confSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === "ipress_control" && data[i][1]) {
        const val = data[i][1];
        if (typeof val === "object") return val;
        return JSON.parse(String(val));
      }
    }
  } catch (e) {
    // Si falla lectura o parseo, devolver objeto vacío
  }
  return {};
}

/**
 * Endpoint para consultar el estado de las IPRESS
 */
function apiGetIpressControl() {
  return {
    success: true,
    ipress_control: getIpressControlMap()
  };
}

/**
 * 10. Guardar estado de IPRESS en la hoja CONFIG (solo administradores)
 */
function apiAdminSaveIpressControl(adminDni, ipressStatus) {
  if (!checkAdminRole(adminDni)) {
    return { success: false, message: "Acceso no autorizado para administrar IPRESS" };
  }
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let confSheet = ss.getSheetByName(DEFAULT_CONFIG.SHEET_CONFIG);
    if (!confSheet) {
      confSheet = ss.insertSheet(DEFAULT_CONFIG.SHEET_CONFIG);
      confSheet.appendRow(["clave", "valor", "descripcion"]);
    }
    const data = confSheet.getDataRange().getValues();
    let foundRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === "ipress_control") {
        foundRow = i + 1;
        break;
      }
    }
    const jsonStr = typeof ipressStatus === "string" ? ipressStatus : JSON.stringify(ipressStatus);
    if (foundRow > 0) {
      confSheet.getRange(foundRow, 2).setValue(jsonStr);
      confSheet.getRange(foundRow, 3).setValue("Control de disponibilidad de producción por IPRESS (JSON)");
    } else {
      confSheet.appendRow(["ipress_control", jsonStr, "Control de disponibilidad de producción por IPRESS (JSON)"]);
    }
    return { 
      success: true, 
      message: "Control de IPRESS guardado correctamente en Google Sheets (hoja CONFIG)." 
    };
  } catch (err) {
    return { success: false, message: "Error al guardar en CONFIG: " + err.toString() };
  }
}

/**
 * 11. Sincronización inteligente de usuarios (Merge):
 * Conserva intactas las contraseñas personalizadas que ya fueron cambiadas
 * y solo registra al personal nuevo con su DNI como clave inicial.
 */
function apiAdminSyncUsers(adminDni, usersList) {
  if (!checkAdminRole(adminDni)) {
    return { success: false, message: "Acceso no autorizado para sincronizar usuarios." };
  }
  if (!usersList || !Array.isArray(usersList) || usersList.length === 0) {
    return { success: false, message: "Lista de usuarios vacía o no válida." };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = getSheetName("hoja_usuarios", DEFAULT_CONFIG.SHEET_USERS);
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow([
      "dni", "nombre", "password_hash", "rol", 
      "establecimiento", "microred", "colegio", 
      "fecha_creacion", "ultimo_acceso"
    ]);
  }

  const data = sheet.getDataRange().getValues();
  // Mapa de usuarios existentes: dni normalizado -> número de fila
  const existingMap = {};
  for (let i = 1; i < data.length; i++) {
    const rowDni = String(data[i][0]).trim();
    if (rowDni) {
      existingMap[rowDni] = i + 1;
      const stripped = rowDni.replace(/^0+/, "");
      if (stripped && stripped !== rowDni) {
        existingMap[stripped] = i + 1;
      }
    }
  }

  let updatedCount = 0;
  let addedCount = 0;
  const newRows = [];

  for (let uIdx = 0; uIdx < usersList.length; uIdx++) {
    const u = usersList[uIdx];
    const uDni = String(u.dni || "").trim();
    if (!uDni) continue;

    const rowNum = existingMap[uDni] || existingMap[uDni.replace(/^0+/, "")];

    if (rowNum) {
      // Usuario ya existe: actualizar datos institucionales si aplican
      // ¡JAMÁS TOCAR LA COLUMNA 3 (password_hash)!
      if (u.nombre) sheet.getRange(rowNum, 2).setValue(u.nombre);
      if (u.establecimiento) sheet.getRange(rowNum, 5).setValue(u.establecimiento);
      if (u.microred) sheet.getRange(rowNum, 6).setValue(u.microred);
      if (u.colegio) sheet.getRange(rowNum, 7).setValue(u.colegio);
      updatedCount++;
    } else {
      // Personal nuevo en el Reporte 40: registrar con contraseña inicial = su DNI
      const defaultHash = computeSHA256(uDni);
      newRows.push([
        uDni,
        u.nombre || ("PERSONAL " + uDni),
        defaultHash,
        u.rol || (uDni === DEFAULT_CONFIG.ADMIN_DEFAULT_DNI ? "admin" : "usuario"),
        u.establecimiento || "",
        u.microred || "",
        u.colegio || "",
        new Date().toISOString(),
        ""
      ]);
      existingMap[uDni] = true;
      addedCount++;
    }
  }

  // Insertar personal nuevo en lote
  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 9).setValues(newRows);
  }

  return {
    success: true,
    message: `Sincronización completada: ${updatedCount} trabajadores actualizados (conservando sus contraseñas) y ${addedCount} nuevos trabajadores registrados con clave DNI.`,
    updated: updatedCount,
    added: addedCount
  };
}

/**
 * 12. Obtener lista de años habilitados para consulta desde la hoja CONFIG
 */
function getEnabledYears() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const confSheet = ss.getSheetByName(DEFAULT_CONFIG.SHEET_CONFIG);
    if (!confSheet) return ["2026"];
    const data = confSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === "anios_habilitados" && data[i][1]) {
        const val = data[i][1];
        if (Array.isArray(val)) return val;
        try {
          const parsed = JSON.parse(String(val));
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {
          const parts = String(val).split(",").map(function(s) { return s.trim(); }).filter(Boolean);
          if (parts.length > 0) return parts;
        }
      }
    }
  } catch (e) {}
  return ["2026"];
}

/**
 * Endpoint para consultar años habilitados
 */
function apiGetEnabledYears() {
  return {
    success: true,
    anios_habilitados: getEnabledYears()
  };
}

/**
 * 13. Guardar lista de años habilitados en la hoja CONFIG (solo administradores)
 */
function apiAdminSaveEnabledYears(adminDni, years) {
  if (!checkAdminRole(adminDni)) {
    return { success: false, message: "Acceso no autorizado para configurar periodos anuales." };
  }
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let confSheet = ss.getSheetByName(DEFAULT_CONFIG.SHEET_CONFIG);
    if (!confSheet) {
      confSheet = ss.insertSheet(DEFAULT_CONFIG.SHEET_CONFIG);
      confSheet.appendRow(["clave", "valor", "descripcion"]);
    }
    const data = confSheet.getDataRange().getValues();
    let foundRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === "anios_habilitados") {
        foundRow = i + 1;
        break;
      }
    }
    const jsonStr = Array.isArray(years) ? JSON.stringify(years) : String(years);
    if (foundRow > 0) {
      confSheet.getRange(foundRow, 2).setValue(jsonStr);
      confSheet.getRange(foundRow, 3).setValue("Años y periodos fiscales habilitados para descarga (JSON Array)");
    } else {
      confSheet.appendRow(["anios_habilitados", jsonStr, "Años y periodos fiscales habilitados para descarga (JSON Array)"]);
    }
    return { 
      success: true, 
      message: "Configuración de años y periodos guardada correctamente en Google Sheets." 
    };
  } catch (err) {
    return { success: false, message: "Error al guardar años en CONFIG: " + err.toString() };
  }
}



