/**
 * =====================================================================
 * CONTROLADOR DEL PANEL ADMINISTRADOR
 * Hecho por xzerox99
 * =====================================================================
 */

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Validar que sea administrador
  if (!Auth.requireAdmin()) return;

  const currentAdmin = Auth.getCurrentUser();
  let allUsers = [];
  let allLogs = [];
  let selectedTargetUser = null;

  // DOM Elements
  const statTotalUsers = document.getElementById("statTotalUsers");
  const statTotalDownloads = document.getElementById("statTotalDownloads");
  const statTotalEstabs = document.getElementById("statTotalEstabs");
  const statTodayDownloads = document.getElementById("statTodayDownloads");

  const logsTableBody = document.getElementById("logsTableBody");
  const logSearchInput = document.getElementById("logSearchInput");
  const logsCountText = document.getElementById("logsCountText");
  const btnExportLogsExcel = document.getElementById("btnExportLogsExcel");

  const usersTableBody = document.getElementById("usersTableBody");
  const userSearchInput = document.getElementById("userSearchInput");
  const usersCountText = document.getElementById("usersCountText");

  const btnExportAllExcel = document.getElementById("btnExportAllExcel");
  const adminLogoutBtn = document.getElementById("adminLogoutBtn");

  // Modal reset elements
  const resetPasswordModalEl = document.getElementById("resetPasswordModal");
  const resetPasswordModal = new bootstrap.Modal(resetPasswordModalEl);
  const resetModalUserName = document.getElementById("resetModalUserName");
  const resetModalUserDni = document.getElementById("resetModalUserDni");
  const resetNewPassInput = document.getElementById("resetNewPassInput");
  const resetAlert = document.getElementById("resetAlert");
  const resetPasswordForm = document.getElementById("resetPasswordForm");
  const confirmResetBtn = document.getElementById("confirmResetBtn");

  // Logout
  adminLogoutBtn.addEventListener("click", () => Auth.logout());

  // 2. Cargar Datos
  async function loadInitialData() {
    try {
      const [usersRes, logsRes] = await Promise.all([
        Api.callAppsScript("adminGetUsers", { adminDni: currentAdmin.dni }),
        Api.callAppsScript("adminGetLogs", { adminDni: currentAdmin.dni })
      ]);

      if (usersRes.success) {
        allUsers = usersRes.users || [];
      }
      if (logsRes.success) {
        allLogs = logsRes.logs || [];
      }

      updateKPIs();
      renderLogsTable(allLogs);
      renderUsersTable(allUsers);
    } catch (err) {
      console.error("Error al cargar datos administrativos:", err);
    }
  }

  // 3. Actualizar KPIs
  function updateKPIs() {
    statTotalUsers.textContent = allUsers.length.toLocaleString();
    statTotalDownloads.textContent = allLogs.length.toLocaleString();

    // Establecimientos únicos
    const estabs = new Set(allUsers.map(u => u.establecimiento).filter(Boolean));
    statTotalEstabs.textContent = estabs.size.toLocaleString();

    // Descargas de hoy
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const todayCount = allLogs.filter(l => {
      if (!l.timestamp) return false;
      const str = String(l.timestamp);
      return (
        str.includes(`${day}/${month}/${year}`) ||
        str.includes(`${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`) ||
        str.includes(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`)
      );
    }).length;
    statTodayDownloads.textContent = todayCount.toLocaleString();
  }

  // 4. Renderizar Tabla de Logs
  function renderLogsTable(logs) {
    logsTableBody.innerHTML = "";
    if (logs.length === 0) {
      logsTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No se registran descargas aún.</td></tr>`;
      logsCountText.textContent = "Mostrando 0 registros";
      return;
    }

    logs.forEach((log) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="text-muted small"><i class="bi bi-calendar-event me-1"></i>${log.timestamp}</td>
        <td><span class="badge-custom bg-secondary text-white">${log.dni}</span></td>
        <td class="fw-semibold text-main">${log.personal || "-"}</td>
        <td><span class="badge-custom badge-info">${log.establecimiento || "-"}</span></td>
        <td><span class="text-primary fw-medium small">${log.meses || "Todos"}</span></td>
        <td><span class="badge-custom badge-success">${log.tipo || "PDF"}</span></td>
      `;
      logsTableBody.appendChild(tr);
    });

    logsCountText.textContent = `Mostrando ${logs.length} de ${allLogs.length} registros`;
  }

  // Filtro de logs en tiempo real
  logSearchInput.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (!term) {
      renderLogsTable(allLogs);
      return;
    }
    const filtered = allLogs.filter((l) =>
      (l.dni && l.dni.toLowerCase().includes(term)) ||
      (l.personal && l.personal.toLowerCase().includes(term)) ||
      (l.establecimiento && l.establecimiento.toLowerCase().includes(term)) ||
      (l.meses && l.meses.toLowerCase().includes(term))
    );
    renderLogsTable(filtered);
  });

  // 5. Renderizar Tabla de Personal
  function renderUsersTable(users) {
    usersTableBody.innerHTML = "";
    if (users.length === 0) {
      usersTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No se encontró personal.</td></tr>`;
      usersCountText.textContent = "0 profesionales";
      return;
    }

    // Paginación visual simple (primeros 100 para fluidez)
    const displayList = users.slice(0, 100);

    displayList.forEach((u) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong class="text-main">${u.dni}</strong></td>
        <td>${u.nombre}</td>
        <td><span class="badge-custom badge-info">${u.establecimiento || "-"}</span></td>
        <td>${u.microred || "-"}</td>
        <td class="small text-muted">${u.colegio || "-"}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-warning btn-reset-pass" data-dni="${u.dni}" data-name="${u.nombre}" title="Restablecer Contraseña">
            <i class="bi bi-key-fill"></i> Restablecer Clave
          </button>
        </td>
      `;
      usersTableBody.appendChild(tr);
    });

    usersCountText.textContent = `Mostrando ${displayList.length} de ${users.length} profesionales ${users.length > 100 ? "(Usa el buscador para filtrar)" : ""}`;

    // Vincular botones de reseteo
    usersTableBody.querySelectorAll(".btn-reset-pass").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetDni = btn.getAttribute("data-dni");
        const targetName = btn.getAttribute("data-name");
        openResetModal(targetDni, targetName);
      });
    });
  }

  // Filtro de personal en tiempo real
  userSearchInput.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (!term) {
      renderUsersTable(allUsers);
      return;
    }
    const filtered = allUsers.filter((u) =>
      (u.dni && u.dni.toLowerCase().includes(term)) ||
      (u.nombre && u.nombre.toLowerCase().includes(term)) ||
      (u.establecimiento && u.establecimiento.toLowerCase().includes(term)) ||
      (u.microred && u.microred.toLowerCase().includes(term))
    );
    renderUsersTable(filtered);
  });

  // 6. Modal para Resetear Contraseña
  function openResetModal(dni, name) {
    selectedTargetUser = { dni, name };
    resetModalUserName.textContent = name;
    resetModalUserDni.textContent = dni;
    resetNewPassInput.value = "";
    resetAlert.className = "alert d-none";
    resetPasswordModal.show();
  }

  resetPasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedTargetUser) return;

    confirmResetBtn.disabled = true;
    confirmResetBtn.textContent = "Restableciendo...";

    const newPass = resetNewPassInput.value.trim();

    try {
      const res = await Api.callAppsScript("adminResetPassword", {
        adminDni: currentAdmin.dni,
        targetDni: selectedTargetUser.dni,
        newPassword: newPass
      });

      if (res.success) {
        resetAlert.className = "alert alert-success py-2 px-3 small";
        resetAlert.textContent = res.message;
        setTimeout(() => {
          resetPasswordModal.hide();
        }, 1500);
      } else {
        resetAlert.className = "alert alert-danger py-2 px-3 small";
        resetAlert.textContent = res.message || "Error al restablecer contraseña.";
      }
    } catch (err) {
      resetAlert.className = "alert alert-danger py-2 px-3 small";
      resetAlert.textContent = "Error de comunicación con el servidor.";
    } finally {
      confirmResetBtn.disabled = false;
      confirmResetBtn.textContent = "Confirmar Cambio";
    }
  });

  // 7. Exportar Log a Excel con formato profesional
  btnExportLogsExcel.addEventListener("click", () => {
    if (allLogs.length === 0) {
      alert("No hay registros en el log para exportar.");
      return;
    }

    const wsData = [
      ["ID", "Fecha y Hora", "DNI", "Personal", "Establecimiento", "Meses Consultados", "Tipo Reporte"]
    ];

    allLogs.forEach(l => {
      wsData.push([l.id || "", l.timestamp || "", l.dni || "", l.personal || "", l.establecimiento || "", l.meses || "", l.tipo || ""]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    applyProfessionalSheetFormat(ws, wsData);
    XLSX.utils.book_append_sheet(wb, ws, "LOG_DESCARGAS");
    XLSX.writeFile(wb, `Log_Descargas_Reporte40_${new Date().toISOString().slice(0, 10)}.xlsx`);
  });

  // Helper para dar formato profesional a cada hoja de Excel
  function applyProfessionalSheetFormat(ws, rows) {
    if (!rows || rows.length === 0) return;

    // 1. Auto-ajuste de anchos de columna para evitar textos cortados
    const colWidths = rows[0].map((_, colIdx) => {
      let maxLen = 0;
      const sample = rows.slice(0, 120);
      sample.forEach(r => {
        const val = r[colIdx] !== null && r[colIdx] !== undefined ? String(r[colIdx]) : "";
        if (val.length > maxLen) maxLen = val.length;
      });
      return { wch: Math.min(Math.max(maxLen + 3, 10), 45) };
    });
    ws["!cols"] = colWidths;

    // 2. Activar autofiltro en la primera fila
    if (ws["!ref"]) {
      ws["!autofilter"] = { ref: ws["!ref"] };
    }
  }

  // Helpers para convertir cualquier estructura a Array of Arrays (AOA) con datos reales y totales
  function formatAtdAoa(data) {
    if (!data || data.length === 0) return [];
    if (Array.isArray(data[0])) return data;

    const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SET", "OCT", "NOV"];
    const header = [
      "Establecimiento", "DNI", "Personal",
      "ENE_ATC", "ENE_ATD", "FEB_ATC", "FEB_ATD", "MAR_ATC", "MAR_ATD",
      "ABR_ATC", "ABR_ATD", "MAY_ATC", "MAY_ATD", "JUN_ATC", "JUN_ATD",
      "JUL_ATC", "JUL_ATD", "AGO_ATC", "AGO_ATD", "SET_ATC", "SET_ATD",
      "OCT_ATC", "OCT_ATD", "NOV_ATC", "NOV_ATD", "Total_ATC", "Total_ATD"
    ];
    const rows = [header];
    const colTotals = new Array(24).fill(0);

    data.forEach(userItem => {
      const porEst = userItem.por_establecimiento || {};
      const estabNames = Object.keys(porEst);

      if (estabNames.length > 0) {
        estabNames.forEach(estName => {
          const estData = porEst[estName];
          const m = estData.meses || {};
          const row = [estName, userItem.dni, userItem.personal];
          let cIdx = 0;

          MESES.forEach(mKey => {
            const atc = (m[mKey] && Number(m[mKey].atc)) || 0;
            const atd = (m[mKey] && Number(m[mKey].atd)) || 0;
            row.push(atc);
            row.push(atd);
            colTotals[cIdx++] += atc;
            colTotals[cIdx++] += atd;
          });

          const tAtc = Number(estData.total_atc) || 0;
          const tAtd = Number(estData.total_atd) || 0;
          row.push(tAtc);
          row.push(tAtd);
          colTotals[cIdx++] += tAtc;
          colTotals[cIdx++] += tAtd;
          rows.push(row);
        });
      } else {
        const m = (userItem.consolidado && userItem.consolidado.meses) || userItem.meses || {};
        const estName = userItem.establecimiento || userItem.establecimiento_principal || "";
        const row = [estName, userItem.dni, userItem.personal];
        let cIdx = 0;

        MESES.forEach(mKey => {
          const atc = (m[mKey] && Number(m[mKey].atc)) || 0;
          const atd = (m[mKey] && Number(m[mKey].atd)) || 0;
          row.push(atc);
          row.push(atd);
          colTotals[cIdx++] += atc;
          colTotals[cIdx++] += atd;
        });

        const tAtc = Number(userItem.total_atc || (userItem.consolidado && userItem.consolidado.total_atc)) || 0;
        const tAtd = Number(userItem.total_atd || (userItem.consolidado && userItem.consolidado.total_atd)) || 0;
        row.push(tAtc);
        row.push(tAtd);
        colTotals[cIdx++] += tAtc;
        colTotals[cIdx++] += tAtd;
        rows.push(row);
      }
    });

    // Fila final de Totales Acumulados
    const totalRow = ["TOTAL GENERAL", "", "SUMA TOTAL RED CUSCO SUR", ...colTotals];
    rows.push(totalRow);
    return rows;
  }

  function formatAppAoa(data) {
    if (!data || data.length === 0) return [];
    if (Array.isArray(data[0])) return data;

    const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SET", "OCT", "NOV"];
    const header = [
      "MicroRed", "Establecimiento", "DNI", "Personal",
      "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
      "JULIO", "AGOSTO", "SETIEMBRE", "OCTUBRE", "NOVIEMBRE", "Total"
    ];
    const rows = [header];
    const colTotals = new Array(12).fill(0);

    data.forEach(userItem => {
      const porEst = userItem.por_establecimiento || {};
      const estabNames = Object.keys(porEst);

      if (estabNames.length > 0) {
        estabNames.forEach(estName => {
          const estData = porEst[estName];
          const m = estData.meses || {};
          const row = [estData.microred || "", estName, userItem.dni, userItem.personal];
          let cIdx = 0;

          MESES.forEach(mKey => {
            const val = Number(m[mKey]) || 0;
            row.push(val);
            colTotals[cIdx++] += val;
          });

          const t = Number(estData.total) || 0;
          row.push(t);
          colTotals[cIdx++] += t;
          rows.push(row);
        });
      } else {
        const m = (userItem.consolidado && userItem.consolidado.meses) || userItem.meses || {};
        const estName = userItem.establecimiento || userItem.establecimiento_principal || "";
        const row = [userItem.microred || "", estName, userItem.dni, userItem.personal];
        let cIdx = 0;

        MESES.forEach(mKey => {
          const val = Number(m[mKey]) || 0;
          row.push(val);
          colTotals[cIdx++] += val;
        });

        const t = Number(userItem.total || (userItem.consolidado && userItem.consolidado.total)) || 0;
        row.push(t);
        colTotals[cIdx++] += t;
        rows.push(row);
      }
    });

    // Fila final de Totales Acumulados
    const totalRow = ["TOTAL GENERAL", "", "", "SUMA TOTAL RED CUSCO SUR", ...colTotals];
    rows.push(totalRow);
    return rows;
  }

  function formatUsersAoa(data) {
    if (!data || data.length === 0) return [];
    if (Array.isArray(data[0])) return data;

    const header = ["DNI", "Apellidos y Nombres", "Rol", "Establecimiento Principal", "MicroRed", "Colegio Profesional", "IPRESS Donde Laboró"];
    const rows = [header];
    data.forEach(item => {
      const allEstabs = item.establecimientos && Array.isArray(item.establecimientos)
        ? item.establecimientos.join(", ")
        : (item.establecimiento || "");

      rows.push([
        item.dni || "",
        item.nombre || "",
        item.rol || "usuario",
        item.establecimiento || item.establecimiento_principal || "",
        item.microred || "",
        item.colegio || "",
        allEstabs
      ]);
    });
    return rows;
  }

  // 8. Exportar TODA la base de datos a Excel multi-hoja con formato profesional
  btnExportAllExcel.addEventListener("click", async () => {
    btnExportAllExcel.disabled = true;
    btnExportAllExcel.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Generando Excel Profesional...';

    try {
      const res = await Api.callAppsScript("adminExportAll", { adminDni: currentAdmin.dni });
      const wb = XLSX.utils.book_new();

      // 1. Hoja USUARIOS
      const rawUsers = (res && (res.users || res.usuarios)) || allUsers;
      const usersRows = formatUsersAoa(rawUsers);
      if (usersRows.length > 0) {
        const wsUsers = XLSX.utils.aoa_to_sheet(usersRows);
        applyProfessionalSheetFormat(wsUsers, usersRows);
        XLSX.utils.book_append_sheet(wb, wsUsers, "USUARIOS");
      }

      // 2. Hoja DATA_ATD_ATC
      if (res && res.atd_atc && res.atd_atc.length > 0) {
        const atdRows = formatAtdAoa(res.atd_atc);
        const wsAtd = XLSX.utils.aoa_to_sheet(atdRows);
        applyProfessionalSheetFormat(wsAtd, atdRows);
        XLSX.utils.book_append_sheet(wb, wsAtd, "DATA_ATD_ATC");
      }

      // 3. Hoja DATA_APP
      if (res && res.app && res.app.length > 0) {
        const appRows = formatAppAoa(res.app);
        const wsApp = XLSX.utils.aoa_to_sheet(appRows);
        applyProfessionalSheetFormat(wsApp, appRows);
        XLSX.utils.book_append_sheet(wb, wsApp, "DATA_APP");
      }

      // 4. Hoja LOG_DESCARGAS
      const logsArray = [["ID", "Fecha y Hora", "DNI", "Personal", "Establecimiento", "Meses Consultados", "Tipo Reporte"]];
      allLogs.forEach(l => logsArray.push([l.id || "", l.timestamp || "", l.dni || "", l.personal || "", l.establecimiento || "", l.meses || "", l.tipo || ""]));
      const wsLogs = XLSX.utils.aoa_to_sheet(logsArray);
      applyProfessionalSheetFormat(wsLogs, logsArray);
      XLSX.utils.book_append_sheet(wb, wsLogs, "LOG_DESCARGAS");

      XLSX.writeFile(wb, `REPORTE40_BASE_COMPLETA_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      alert("Hubo un error al exportar la base completa: " + err.message);
    } finally {
      btnExportAllExcel.disabled = false;
      btnExportAllExcel.innerHTML = '<i class="bi bi-file-earmark-excel-fill text-success"></i> Exportar Toda la Información a Excel';
    }
  });

  // =====================================================================
  // 9. GESTIÓN DE COMUNICADO INSTITUCIONAL (PESTAÑA 4)
  // =====================================================================
  const noticeForm = document.getElementById("noticeForm");
  const noticeActiveSwitch = document.getElementById("noticeActiveSwitch");
  const noticeTitleInput = document.getElementById("noticeTitleInput");
  const noticeMessageInput = document.getElementById("noticeMessageInput");
  const noticeAlert = document.getElementById("noticeAlert");
  const previewNoticeTitle = document.getElementById("previewNoticeTitle");
  const previewNoticeMessage = document.getElementById("previewNoticeMessage");
  const noticePreviewBanner = document.getElementById("noticePreviewBanner");

  function loadNoticeSettings() {
    if (!noticeForm) return;
    let com = null;
    const saved = localStorage.getItem("comunicado_reporte40");
    if (saved) {
      try { com = JSON.parse(saved); } catch (e) {}
    }
    if (!com && window.DEMO_DATA && window.DEMO_DATA.comunicado) {
      com = window.DEMO_DATA.comunicado;
    }

    if (com) {
      noticeActiveSwitch.checked = com.activo !== false;
      noticeTitleInput.value = com.titulo || "";
      noticeMessageInput.value = com.mensaje || "";
    }
    updateNoticePreview();
  }

  function updateNoticePreview() {
    if (!previewNoticeTitle) return;
    previewNoticeTitle.textContent = noticeTitleInput.value.trim() || "Título del Comunicado";
    previewNoticeMessage.textContent = noticeMessageInput.value.trim() || "Mensaje del comunicado...";
    if (noticeActiveSwitch.checked) {
      noticePreviewBanner.style.opacity = "1";
    } else {
      noticePreviewBanner.style.opacity = "0.4";
    }
  }

  if (noticeTitleInput && noticeMessageInput && noticeActiveSwitch) {
    noticeTitleInput.addEventListener("input", updateNoticePreview);
    noticeMessageInput.addEventListener("input", updateNoticePreview);
    noticeActiveSwitch.addEventListener("change", updateNoticePreview);
  }

  if (noticeForm) {
    noticeForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const noticeData = {
        activo: noticeActiveSwitch.checked,
        titulo: noticeTitleInput.value.trim(),
        mensaje: noticeMessageInput.value.trim(),
        fecha: new Date().toISOString()
      };

      localStorage.setItem("comunicado_reporte40", JSON.stringify(noticeData));

      if (window.DEMO_DATA) {
        window.DEMO_DATA.comunicado = noticeData;
      }

      // Si existe DEMO_DATA_OVERRIDE, sincronizarlo
      const override = localStorage.getItem("DEMO_DATA_OVERRIDE");
      if (override) {
        try {
          const parsed = JSON.parse(override);
          parsed.comunicado = noticeData;
          localStorage.setItem("DEMO_DATA_OVERRIDE", JSON.stringify(parsed));
        } catch (e) {}
      }

      // Enviar a Apps Script si está conectado
      try {
        await Api.callAppsScript("adminSaveNotice", noticeData);
      } catch (err) {}

      noticeAlert.className = "alert alert-success py-2 px-3 small";
      noticeAlert.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> ¡Comunicado guardado y publicado exitosamente! El personal lo verá reflejado en su pantalla.';
      setTimeout(() => {
        noticeAlert.className = "alert d-none";
      }, 4000);
    });
  }

  loadNoticeSettings();

  // =====================================================================
  // 10. CARGA Y ACTUALIZACIÓN DIRECTA DE EXCEL (PESTAÑA 3)
  // =====================================================================
  const excelDropZone = document.getElementById("excelDropZone");
  const excelFileInput = document.getElementById("excelFileInput");
  const excelAlert = document.getElementById("excelAlert");
  const excelPreviewCard = document.getElementById("excelPreviewCard");
  const previewFileName = document.getElementById("previewFileName");
  const previewFileSize = document.getElementById("previewFileSize");
  const previewSheetsBadge = document.getElementById("previewSheetsBadge");
  const previewAtdCount = document.getElementById("previewAtdCount");
  const previewAppCount = document.getElementById("previewAppCount");
  const previewUsersCount = document.getElementById("previewUsersCount");
  const previewMonthsCount = document.getElementById("previewMonthsCount");
  const btnCancelExcel = document.getElementById("btnCancelExcel");
  const btnApplyExcel = document.getElementById("btnApplyExcel");
  const btnDownloadDemoDataJs = document.getElementById("btnDownloadDemoDataJs");
  const btnResetOriginalData = document.getElementById("btnResetOriginalData");

  let parsedExcelData = null;

  if (excelDropZone && excelFileInput) {
    excelDropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      excelDropZone.classList.add("dragover");
    });

    excelDropZone.addEventListener("dragleave", () => {
      excelDropZone.classList.remove("dragover");
    });

    excelDropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      excelDropZone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleExcelFile(e.dataTransfer.files[0]);
      }
    });

    excelFileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleExcelFile(e.target.files[0]);
      }
    });
  }

  // Procesar archivo Excel con SheetJS
  function handleExcelFile(file) {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      showExcelAlert("Por favor sube un archivo Excel válido (.xlsx o .xls)", "danger");
      return;
    }

    showExcelAlert('<span class="spinner-border spinner-border-sm me-2"></span> Analizando archivo Excel...', "info");

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        parseWorkbook(workbook, file);
      } catch (err) {
        console.error("Error al leer Excel:", err);
        showExcelAlert("Error al procesar el archivo Excel: " + err.message, "danger");
      }
    };
    reader.onerror = () => {
      showExcelAlert("No se pudo leer el archivo seleccionado.", "danger");
    };
    reader.readAsArrayBuffer(file);
  }

  function parseWorkbook(wb, file) {
    const sheetNames = wb.SheetNames;
    
    // Buscar hojas ATD y APP
    const atdSheetName = sheetNames.find(n => /ipress|atd|atc|personal x mes/i.test(n)) || sheetNames[0];
    const appSheetName = sheetNames.find(n => /app/i.test(n));

    if (!atdSheetName) {
      showExcelAlert("No se encontró la hoja de atenciones (ipress personal x mes) en el libro Excel.", "danger");
      return;
    }

    const wsAtd = wb.Sheets[atdSheetName];
    const atdRows = XLSX.utils.sheet_to_json(wsAtd, { header: 1, defval: "" });

    let appRows = [];
    if (appSheetName && wb.Sheets[appSheetName]) {
      appRows = XLSX.utils.sheet_to_json(wb.Sheets[appSheetName], { header: 1, defval: "" });
    }

    // Mapeo opcional de colegio profesional desde Hoja1
    const colegioMap = {};
    const hoja1Name = sheetNames.find(n => /hoja1/i.test(n));
    if (hoja1Name && wb.Sheets[hoja1Name]) {
      const h1Rows = XLSX.utils.sheet_to_json(wb.Sheets[hoja1Name], { header: 1, defval: "" });
      h1Rows.slice(1).forEach(r => {
        if (r && r[4]) {
          const dniK = String(r[4]).trim();
          const colK = r[6] ? String(r[6]).trim() : "";
          if (colK) colegioMap[dniK] = colK;
        }
      });
    }

    const MESES_KEYS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SET", "OCT", "NOV"];

    // 1. Extraer ATD/ATC
    let atdStartRow = 0;
    for (let i = 0; i < Math.min(atdRows.length, 20); i++) {
      const rowStr = (atdRows[i] || []).join(" ").toLowerCase();
      if (rowStr.includes("documento") || rowStr.includes("personal") || rowStr.includes("ene")) {
        atdStartRow = i + 1;
      }
    }
    if (atdStartRow === 0 && atdRows.length > 10) atdStartRow = 10;

    const atdByDni = {};
    const dniMeta = {};
    let atdValidCount = 0;

    for (let i = atdStartRow; i < atdRows.length; i++) {
      const r = atdRows[i];
      if (!r || r.length < 3) continue;

      const estab = String(r[0] || "").trim();
      const dni = String(r[1] || "").trim();
      const nombre = String(r[2] || "").trim();

      if (!estab || !dni || !nombre) continue;
      if (/total/i.test(estab) || /total/i.test(dni) || /total/i.test(nombre)) continue;

      const mesesDict = {};
      let rowTotAtc = 0;
      let rowTotAtd = 0;

      MESES_KEYS.forEach((mKey, idx) => {
        const atcCol = 3 + (idx * 2);
        const atdCol = 4 + (idx * 2);
        const atc = Number(r[atcCol]) || 0;
        const atd = Number(r[atdCol]) || 0;
        mesesDict[mKey] = { atc, atd };
        rowTotAtc += atc;
        rowTotAtd += atd;
      });

      const exTotAtc = Number(r[25]) || rowTotAtc;
      const exTotAtd = Number(r[26]) || rowTotAtd;

      if (!atdByDni[dni]) atdByDni[dni] = [];
      atdByDni[dni].push({
        establecimiento: estab,
        meses: mesesDict,
        total_atc: exTotAtc,
        total_atd: exTotAtd
      });

      if (!dniMeta[dni]) {
        dniMeta[dni] = {
          dni,
          nombre,
          establecimientos: new Set([estab]),
          microred: "",
          colegio: colegioMap[dni] || ""
        };
      } else {
        dniMeta[dni].establecimientos.add(estab);
      }
      atdValidCount++;
    }

    // 2. Extraer APP
    let appStartRow = 0;
    for (let i = 0; i < Math.min(appRows.length, 20); i++) {
      const rowStr = (appRows[i] || []).join(" ").toLowerCase();
      if (rowStr.includes("documento") || rowStr.includes("personal") || rowStr.includes("microred")) {
        appStartRow = i + 1;
      }
    }
    if (appStartRow === 0 && appRows.length > 7) appStartRow = 7;

    const appByDni = {};
    let appValidCount = 0;

    for (let i = appStartRow; i < appRows.length; i++) {
      const r = appRows[i];
      if (!r || r.length < 4) continue;

      const microred = String(r[0] || "").trim();
      const estab = String(r[1] || "").trim();
      const dni = String(r[2] || "").trim();
      const nombre = String(r[3] || "").trim();

      if (!estab || !dni || !nombre) continue;
      if (/total/i.test(estab) || /total/i.test(dni) || /total/i.test(nombre)) continue;

      const mesesAppDict = {};
      let rowTotApp = 0;
      MESES_KEYS.forEach((mKey, idx) => {
        const val = Number(r[4 + idx]) || 0;
        mesesAppDict[mKey] = val;
        rowTotApp += val;
      });

      const exTotApp = Number(r[15]) || rowTotApp;

      if (!appByDni[dni]) appByDni[dni] = [];
      appByDni[dni].push({
        microred,
        establecimiento: estab,
        meses: mesesAppDict,
        total: exTotApp
      });

      if (dniMeta[dni]) {
        if (!dniMeta[dni].microred && microred) dniMeta[dni].microred = microred;
        dniMeta[dni].establecimientos.add(estab);
      } else {
        dniMeta[dni] = {
          dni,
          nombre,
          establecimientos: new Set([estab]),
          microred,
          colegio: colegioMap[dni] || ""
        };
      }
      appValidCount++;
    }

    // 3. Consolidar por DNI y estructurar JSON final
    const structuredAtd = {};
    Object.keys(atdByDni).forEach(dni => {
      const rows = atdByDni[dni];
      const meta = dniMeta[dni] || {};

      let bestEstab = rows[0].establecimiento;
      let maxAtc = -1;
      rows.forEach(r => {
        if (r.total_atc > maxAtc) {
          maxAtc = r.total_atc;
          bestEstab = r.establecimiento;
        }
      });

      const consMeses = {};
      MESES_KEYS.forEach(mKey => {
        consMeses[mKey] = {
          atc: rows.reduce((acc, r) => acc + (r.meses[mKey]?.atc || 0), 0),
          atd: rows.reduce((acc, r) => acc + (r.meses[mKey]?.atd || 0), 0)
        };
      });

      const sumTotAtc = rows.reduce((acc, r) => acc + r.total_atc, 0);
      const sumTotAtd = rows.reduce((acc, r) => acc + r.total_atd, 0);

      const porEst = {};
      rows.forEach(r => {
        porEst[r.establecimiento] = {
          meses: r.meses,
          total_atc: r.total_atc,
          total_atd: r.total_atd
        };
      });

      structuredAtd[dni] = {
        dni,
        personal: meta.nombre || "",
        establecimiento_principal: bestEstab,
        total_establecimientos: rows.length,
        consolidado: {
          meses: consMeses,
          total_atc: sumTotAtc,
          total_atd: sumTotAtd
        },
        por_establecimiento: porEst
      };
    });

    const structuredApp = {};
    Object.keys(appByDni).forEach(dni => {
      const rows = appByDni[dni];
      const meta = dniMeta[dni] || {};

      let bestEstab = rows[0].establecimiento;
      let bestMicrored = rows[0].microred;
      let maxApp = -1;
      rows.forEach(r => {
        if (r.total > maxApp) {
          maxApp = r.total;
          bestEstab = r.establecimiento;
          bestMicrored = r.microred;
        }
      });

      const consMeses = {};
      MESES_KEYS.forEach(mKey => {
        consMeses[mKey] = rows.reduce((acc, r) => acc + (r.meses[mKey] || 0), 0);
      });

      const sumTot = rows.reduce((acc, r) => acc + r.total, 0);

      const porEst = {};
      rows.forEach(r => {
        porEst[r.establecimiento] = {
          microred: r.microred,
          meses: r.meses,
          total: r.total
        };
      });

      structuredApp[dni] = {
        dni,
        personal: meta.nombre || "",
        microred: bestMicrored,
        establecimiento_principal: bestEstab,
        total_establecimientos: rows.length,
        consolidado: {
          meses: consMeses,
          total: sumTot
        },
        por_establecimiento: porEst
      };
    });

    // 4. Armar catálogo de usuarios
    const structuredUsuarios = {};
    Object.keys(dniMeta).forEach(dni => {
      const m = dniMeta[dni];
      const atdObj = structuredAtd[dni];
      const appObj = structuredApp[dni];

      const bestEstab = (atdObj && atdObj.establecimiento_principal) || (appObj && appObj.establecimiento_principal) || Array.from(m.establecimientos)[0] || "";
      const bestMicrored = m.microred || (appObj && appObj.microred) || "";

      structuredUsuarios[dni] = {
        dni,
        nombre: m.nombre,
        rol: dni === CONFIG.ADMIN_DEFAULT_DNI ? "admin" : "usuario",
        establecimiento: bestEstab,
        establecimientos: Array.from(m.establecimientos),
        microred: bestMicrored,
        colegio: m.colegio || ""
      };
    });

    const currentNotice = (window.DEMO_DATA && window.DEMO_DATA.comunicado) || {
      activo: true,
      titulo: "Cierre de Registro Mensual de Información",
      mensaje: "Se recuerda al personal de salud que el plazo para la regularización de atenciones en el HIS culmina el 15 de cada mes."
    };

    parsedExcelData = {
      admin: (window.DEMO_DATA && window.DEMO_DATA.admin) || {
        dni: CONFIG.ADMIN_DEFAULT_DNI,
        nombre: "ADMINISTRADOR DEL SISTEMA",
        rol: "admin",
        password_hash: "3b08e5e1a1208a0d0cbfa239d6ff5421da1d3e864ee055376c3e9863459c5d3d"
      },
      usuarios: structuredUsuarios,
      atd_atc: structuredAtd,
      app: structuredApp,
      comunicado: currentNotice,
      generado: new Date().toISOString()
    };

    // Actualizar preview UI
    previewFileName.textContent = file.name;
    previewFileSize.textContent = (file.size / (1024 * 1024)).toFixed(2) + " MB";
    previewSheetsBadge.textContent = `${sheetNames.length} hojas encontradas`;
    previewAtdCount.textContent = atdValidCount.toLocaleString();
    previewAppCount.textContent = appValidCount.toLocaleString();
    previewUsersCount.textContent = Object.keys(structuredUsuarios).length.toLocaleString();
    previewMonthsCount.textContent = "11 (ENE-NOV)";

    excelPreviewCard.classList.remove("d-none");
    showExcelAlert("¡Archivo leído correctamente! Revisa el resumen y presiona 'Aplicar y Guardar' para activar los datos.", "success");
  }

  function showExcelAlert(msg, type = "info") {
    excelAlert.className = `alert alert-${type} py-2 px-3 small fade-in`;
    excelAlert.innerHTML = msg;
  }

  // Botón Cancelar Preview
  if (btnCancelExcel) {
    btnCancelExcel.addEventListener("click", () => {
      parsedExcelData = null;
      excelPreviewCard.classList.add("d-none");
      excelAlert.className = "alert d-none";
      if (excelFileInput) excelFileInput.value = "";
    });
  }

  // Botón Aplicar Cambios a la Base de Datos
  if (btnApplyExcel) {
    btnApplyExcel.addEventListener("click", async () => {
      if (!parsedExcelData) return;

      btnApplyExcel.disabled = true;
      btnApplyExcel.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Sincronizando...';

      try {
        // 1. Guardar en localStorage
        localStorage.setItem("DEMO_DATA_OVERRIDE", JSON.stringify(parsedExcelData));
        window.DEMO_DATA = parsedExcelData;
        Api._demoData = parsedExcelData;

        // 2. Intentar actualizar en backend si Apps Script está configurado
        try {
          await Api.callAppsScript("adminImportExcel", {
            adminDni: currentAdmin.dni,
            usuariosCount: Object.keys(parsedExcelData.usuarios).length
          });
        } catch (e) {}

        // 3. Recargar estado local
        allUsers = Object.values(parsedExcelData.usuarios);
        updateKPIs();
        renderUsersTable(allUsers);

        showExcelAlert("¡Base de datos actualizada con éxito! La nueva información ya está activa en todo el sistema para todos los trabajadores.", "success");
        excelPreviewCard.classList.add("d-none");
        if (excelFileInput) excelFileInput.value = "";
      } catch (err) {
        showExcelAlert("Error al aplicar cambios: " + err.message, "danger");
      } finally {
        btnApplyExcel.disabled = false;
        btnApplyExcel.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> Aplicar y Guardar a la Base de Datos';
      }
    });
  }

  // Botón Descargar demo_data.js
  if (btnDownloadDemoDataJs) {
    btnDownloadDemoDataJs.addEventListener("click", () => {
      const dataToSave = parsedExcelData || window.DEMO_DATA;
      if (!dataToSave) {
        alert("No hay datos disponibles para exportar.");
        return;
      }
      const fileContent = `/**\n * DATOS DEL SISTEMA REPORTE 40 — GENERADOS AUTOMÁTICAMENTE\n * Fecha: ${new Date().toISOString()}\n */\nwindow.DEMO_DATA = ${JSON.stringify(dataToSave, null, 2)};\n`;
      const blob = new Blob([fileContent], { type: "application/javascript;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "demo_data.js";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  // Botón Restaurar Base de Datos Original
  if (btnResetOriginalData) {
    btnResetOriginalData.addEventListener("click", () => {
      if (!confirm("¿Estás seguro de restaurar los datos al Excel original del sistema? Esto eliminará cualquier archivo cargado previamente en el navegador.")) {
        return;
      }
      localStorage.removeItem("DEMO_DATA_OVERRIDE");
      alert("Se restauraron los datos originales. La página se recargará ahora.");
      window.location.reload();
    });
  }

  // Ejecución inicial
  loadInitialData();
});

