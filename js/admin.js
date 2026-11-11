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
          <div class="d-flex justify-content-center gap-1">
            <button class="btn btn-sm btn-outline-primary btn-serums-user" data-dni="${u.dni}" title="Generar Reporte Personalizado SERUMS">
              <i class="bi bi-mortarboard-fill"></i> SERUMS
            </button>
            <button class="btn btn-sm btn-outline-warning btn-reset-pass" data-dni="${u.dni}" data-name="${u.nombre}" title="Restablecer Contraseña">
              <i class="bi bi-key-fill"></i> Clave
            </button>
            <button class="btn btn-sm btn-outline-info btn-simulate-user" data-dni="${u.dni}" title="Ver Dashboard como este profesional">
              <i class="bi bi-eye"></i> Simular
            </button>
          </div>
        </td>
      `;
      usersTableBody.appendChild(tr);
    });

    usersCountText.textContent = `Mostrando ${displayList.length} de ${users.length} profesionales ${users.length > 100 ? "(Usa el buscador para filtrar)" : ""}`;

    // Vincular botones de reporte SERUMS
    usersTableBody.querySelectorAll(".btn-serums-user").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetDni = btn.getAttribute("data-dni");
        openSerumsModal(targetDni);
      });
    });

    // Vincular botones de reseteo
    usersTableBody.querySelectorAll(".btn-reset-pass").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetDni = btn.getAttribute("data-dni");
        const targetName = btn.getAttribute("data-name");
        openResetModal(targetDni, targetName);
      });
    });

    // Vincular botones de simulación
    usersTableBody.querySelectorAll(".btn-simulate-user").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetDni = btn.getAttribute("data-dni");
        sessionStorage.setItem("impersonate_user_dni", targetDni);
        window.open("dashboard.html", "_blank");
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
  const previewAtdLabel = document.getElementById("previewAtdLabel");
  const previewAppCount = document.getElementById("previewAppCount");
  const previewAppLabel = document.getElementById("previewAppLabel");
  const previewUsersCount = document.getElementById("previewUsersCount");
  const previewUsersLabel = document.getElementById("previewUsersLabel");
  const previewMonthsCount = document.getElementById("previewMonthsCount");
  const previewMonthsLabel = document.getElementById("previewMonthsLabel");
  const previewDetailList = document.getElementById("previewDetailList");
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
    const fileName = (file.name || "").toLowerCase();

    const monthMap = {
      "01": "ENE", "02": "FEB", "03": "MAR", "04": "ABR",
      "05": "MAY", "06": "JUN", "07": "JUL", "08": "AGO",
      "09": "SET", "10": "OCT", "11": "NOV", "12": "DIC"
    };

    // -------------------------------------------------------------
    // CASO 1: DETECCIÓN DE SIHCE CITAS RESERVADAS (ADMISIÓN)
    // -------------------------------------------------------------
    let isCitas = fileName.includes("citas");
    let wsCitas = null;
    for (const sName of sheetNames) {
      const rowsSample = XLSX.utils.sheet_to_json(wb.Sheets[sName], { header: 1, range: 0, defval: "" }).slice(0, 5);
      const rowText = rowsSample.map(r => r.join(" ")).join(" ").toUpperCase();
      if (rowText.includes("PERSONAL QUE CITA") || (fileName.includes("citas") && rowText.includes("FECHA DE CITA"))) {
        isCitas = true;
        wsCitas = wb.Sheets[sName];
        break;
      }
    }

    if (isCitas && wsCitas) {
      const rows = XLSX.utils.sheet_to_json(wsCitas, { header: 1, defval: "" });
      if (rows.length < 2) {
        showExcelAlert("El archivo de citas no contiene filas de datos suficientes.", "danger");
        return;
      }

      let colStaff = 35;
      let colFechaCita = 10;
      let colFechaCrea = 16;
      let colEstab = 1;

      const headerRow = (rows[0] || []).map(c => String(c).trim().toUpperCase());
      headerRow.forEach((h, idx) => {
        if (h.includes("PERSONAL QUE CITA")) colStaff = idx;
        if (h.includes("FECHA DE CITA")) colFechaCita = idx;
        if (h.includes("FECHA DE CREACI")) colFechaCrea = idx;
        if (h.includes("NOMBRE EESS")) colEstab = idx;
      });

      const staffStats = {};
      let totalCitas = 0;
      const detectedMonthsSet = new Set();
      const detectedDaysSet = new Set();

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[colStaff]) continue;
        const rawDni = String(r[colStaff]).trim().replace(/\.0$/, "");
        if (!rawDni || !/^\d+$/.test(rawDni)) continue;

        let fStr = String(r[colFechaCita] || "").trim();
        if (!fStr || fStr.length < 10) fStr = String(r[colFechaCrea] || "").trim();
        if (fStr.length < 10) continue;

        let mNum = "", dNum = "";
        if (fStr[4] === "-" && fStr[7] === "-") {
          mNum = fStr.substring(5, 7);
          dNum = fStr.substring(8, 10);
        } else if (fStr.includes("/")) {
          const parts = fStr.split("/");
          dNum = parts[0].padStart(2, "0");
          mNum = parts[1].padStart(2, "0");
        } else {
          continue;
        }

        const mKey = monthMap[mNum];
        if (!mKey) continue;

        detectedMonthsSet.add(mKey);
        detectedDaysSet.add(dNum);
        totalCitas++;

        if (!staffStats[rawDni]) {
          staffStats[rawDni] = { total: 0, months: {}, estab: String(r[colEstab] || "SAN SEBASTIAN").trim() };
        }
        staffStats[rawDni].total++;
        if (!staffStats[rawDni].months[mKey]) staffStats[rawDni].months[mKey] = {};
        staffStats[rawDni].months[mKey][dNum] = (staffStats[rawDni].months[mKey][dNum] || 0) + 1;
      }

      const detectedMonths = Array.from(detectedMonthsSet);
      const totalStaff = Object.keys(staffStats).length;

      parsedExcelData = {
        isSihce: true,
        sihceType: "CITAS",
        sihceLabel: "Citas Reservadas (Admisión)",
        sihceData: staffStats,
        months: detectedMonths,
        totalItems: totalCitas,
        file: file
      };

      previewFileName.textContent = file.name;
      previewFileSize.textContent = (file.size / (1024 * 1024)).toFixed(2) + " MB";
      previewSheetsBadge.textContent = "SIHCE: Citas de Admisión";
      previewSheetsBadge.className = "badge-custom badge-info";

      previewAtdCount.textContent = totalCitas.toLocaleString();
      if (previewAtdLabel) previewAtdLabel.textContent = "Total Citas";
      previewAppCount.textContent = totalStaff.toLocaleString();
      if (previewAppLabel) previewAppLabel.textContent = "Personal Admisión";
      previewUsersCount.textContent = detectedDaysSet.size.toString();
      if (previewUsersLabel) previewUsersLabel.textContent = "Días con Citas";
      previewMonthsCount.textContent = detectedMonths.join(", ");
      if (previewMonthsLabel) previewMonthsLabel.textContent = "Mes(es) Afectado(s)";

      if (previewDetailList) {
        previewDetailList.classList.remove("d-none");
        const topStaff = Object.keys(staffStats).sort((a, b) => staffStats[b].total - staffStats[a].total).slice(0, 10);
        let listHtml = `<div class="fw-bold mb-1 text-primary"><i class="bi bi-people me-1"></i> Resumen de Producción por Personal de Admisión (${totalStaff} trabajadores):</div><div class="row g-2">`;
        topStaff.forEach(dni => {
          const uName = (window.DEMO_DATA?.usuarios?.[dni]?.nombre) || `Personal DNI ${dni}`;
          listHtml += `<div class="col-sm-6"><span class="badge bg-body text-main border me-1">${dni}</span> ${uName}: <strong class="text-primary">${staffStats[dni].total.toLocaleString()} citas</strong></div>`;
        });
        listHtml += `</div>`;
        previewDetailList.innerHTML = listHtml;
      }

      excelPreviewCard.classList.remove("d-none");
      showExcelAlert("¡Archivo de Citas SIHCE analizado! Revisa el resumen y presiona 'Aplicar y Guardar' para incorporar la producción.", "success");
      return;
    }

    // -------------------------------------------------------------
    // CASO 2: DETECCIÓN DE SIHCE TRIAJE DE ENFERMERÍA
    // -------------------------------------------------------------
    let isTriaje = fileName.includes("triaje");
    let wsTriaje = null;
    for (const sName of sheetNames) {
      if (/triaje/i.test(sName)) {
        isTriaje = true;
        wsTriaje = wb.Sheets[sName];
        break;
      }
      const rowsSample = XLSX.utils.sheet_to_json(wb.Sheets[sName], { header: 1, range: 0, defval: "" }).slice(0, 15);
      const rowText = rowsSample.map(r => r.join(" ")).join(" ").toUpperCase();
      if (rowText.includes("PERSONAL QUE REGISTR") || rowText.includes("PACIENTES TRIADOS")) {
        isTriaje = true;
        wsTriaje = wb.Sheets[sName];
        break;
      }
    }

    if (isTriaje && wsTriaje) {
      const rows = XLSX.utils.sheet_to_json(wsTriaje, { header: 1, defval: "" });
      if (rows.length < 14) {
        showExcelAlert("El archivo de triajes no contiene filas de datos suficientes.", "danger");
        return;
      }

      let colStaff = 22;
      let colFechaAten = 21;
      let estabHeader = "SAN SEBASTIAN";

      for (let r = 0; r < Math.min(rows.length, 12); r++) {
        const rowStr = (rows[r] || []).join(" ").toUpperCase();
        if (rowStr.includes("ESTABLECIMIENTO") && rows[r][1]) {
          estabHeader = String(rows[r][1]).trim();
        }
        if (rowStr.includes("PERSONAL QUE REGISTR")) {
          (rows[r] || []).forEach((c, idx) => {
            if (String(c).toUpperCase().includes("PERSONAL QUE REGISTR")) colStaff = idx;
            if (String(c).toUpperCase().includes("FECHA DE ATENCION")) colFechaAten = idx;
          });
        }
      }

      const staffStats = {};
      let totalTriajes = 0;
      const detectedMonthsSet = new Set();
      const detectedDaysSet = new Set();

      for (let i = 13; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[colStaff]) continue;
        const staffRaw = String(r[colStaff]).trim();
        const rawDni = staffRaw.replace(/\D/g, "");
        if (!rawDni || rawDni.length < 6) continue;

        const fStr = String(r[colFechaAten] || "").trim();
        if (fStr.length < 10) continue;

        let mNum = "", dNum = "";
        if (fStr.includes("/")) {
          const parts = fStr.substring(0, 10).split("/");
          dNum = parts[0].padStart(2, "0");
          mNum = parts[1].padStart(2, "0");
        } else if (fStr[4] === "-" && fStr[7] === "-") {
          mNum = fStr.substring(5, 7);
          dNum = fStr.substring(8, 10);
        } else {
          continue;
        }

        const mKey = monthMap[mNum];
        if (!mKey) continue;

        detectedMonthsSet.add(mKey);
        detectedDaysSet.add(dNum);
        totalTriajes++;

        if (!staffStats[rawDni]) {
          staffStats[rawDni] = { total: 0, months: {}, estab: estabHeader };
        }
        staffStats[rawDni].total++;
        if (!staffStats[rawDni].months[mKey]) staffStats[rawDni].months[mKey] = {};
        staffStats[rawDni].months[mKey][dNum] = (staffStats[rawDni].months[mKey][dNum] || 0) + 1;
      }

      const detectedMonths = Array.from(detectedMonthsSet);
      const totalStaff = Object.keys(staffStats).length;

      parsedExcelData = {
        isSihce: true,
        sihceType: "TRIAJES",
        sihceLabel: "Triajes de Enfermería",
        sihceData: staffStats,
        months: detectedMonths,
        totalItems: totalTriajes,
        file: file
      };

      previewFileName.textContent = file.name;
      previewFileSize.textContent = (file.size / (1024 * 1024)).toFixed(2) + " MB";
      previewSheetsBadge.textContent = "SIHCE: Triajes de Enfermería";
      previewSheetsBadge.className = "badge-custom badge-success";

      previewAtdCount.textContent = totalTriajes.toLocaleString();
      if (previewAtdLabel) previewAtdLabel.textContent = "Total Triajes";
      previewAppCount.textContent = totalStaff.toLocaleString();
      if (previewAppLabel) previewAppLabel.textContent = "Personal de Triaje";
      previewUsersCount.textContent = detectedDaysSet.size.toString();
      if (previewUsersLabel) previewUsersLabel.textContent = "Días con Triajes";
      previewMonthsCount.textContent = detectedMonths.join(", ");
      if (previewMonthsLabel) previewMonthsLabel.textContent = "Mes(es) Afectado(s)";

      if (previewDetailList) {
        previewDetailList.classList.remove("d-none");
        const topStaff = Object.keys(staffStats).sort((a, b) => staffStats[b].total - staffStats[a].total);
        let listHtml = `<div class="fw-bold mb-1 text-success"><i class="bi bi-heart-pulse me-1"></i> Resumen de Producción por Personal de Triaje (${totalStaff} trabajadores):</div><div class="row g-2">`;
        topStaff.forEach(dni => {
          const uName = (window.DEMO_DATA?.usuarios?.[dni]?.nombre) || `Personal DNI ${dni}`;
          listHtml += `<div class="col-sm-6"><span class="badge bg-body text-main border me-1">${dni}</span> ${uName}: <strong class="text-success">${staffStats[dni].total.toLocaleString()} triajes</strong></div>`;
        });
        listHtml += `</div>`;
        previewDetailList.innerHTML = listHtml;
      }

      excelPreviewCard.classList.remove("d-none");
      showExcelAlert("¡Archivo de Triajes SIHCE analizado! Revisa el resumen y presiona 'Aplicar y Guardar' para incorporar la producción.", "success");
      return;
    }

    // -------------------------------------------------------------
    // CASO 3: REPORTE 40 GENERAL (HIS)
    // -------------------------------------------------------------
    if (previewAtdLabel) previewAtdLabel.textContent = "Registros ATD/ATC";
    if (previewAppLabel) previewAppLabel.textContent = "Registros APP";
    if (previewUsersLabel) previewUsersLabel.textContent = "Personal Único";
    if (previewMonthsLabel) previewMonthsLabel.textContent = "Meses Detectados";
    if (previewDetailList) previewDetailList.classList.add("d-none");

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
        // CASO A: Archivo SIHCE (Citas o Triajes)
        if (parsedExcelData.isSihce) {
          const baseData = window.DEMO_DATA || (await Api.loadDemoData()) || {};
          if (!baseData.diario) baseData.diario = {};
          if (!baseData.atd_atc) baseData.atd_atc = {};
          if (!baseData.usuarios) baseData.usuarios = {};
          if (!baseData.sihce) baseData.sihce = { citas: {}, triajes: {} };

          const sData = parsedExcelData.sihceData;
          const sType = parsedExcelData.sihceType; // "CITAS" o "TRIAJES"

          Object.keys(sData).forEach(dni => {
            const staffObj = sData[dni];
            const estab = staffObj.estab || "SAN SEBASTIAN";

            // Asegurar que exista en usuarios
            if (!baseData.usuarios[dni]) {
              baseData.usuarios[dni] = {
                dni,
                nombre: `PERSONAL ${dni}`,
                rol: "usuario",
                establecimiento: estab,
                establecimientos: [estab],
                microred: "CUSCO",
                colegio: sType === "CITAS" ? "ADMISIÓN SIHCE" : "ENFERMERÍA / TRIAJE"
              };
            }

            // Asegurar que exista en diario
            if (!baseData.diario[dni]) baseData.diario[dni] = {};

            // Asegurar que exista en atd_atc
            if (!baseData.atd_atc[dni]) {
              baseData.atd_atc[dni] = {
                dni,
                personal: baseData.usuarios[dni]?.nombre || `PERSONAL ${dni}`,
                establecimiento_principal: estab,
                establecimientos: [estab],
                consolidado: {
                  meses: {},
                  total_atc: 0,
                  total_atd: 0
                },
                por_establecimiento: {
                  [estab]: {
                    meses: {},
                    total_atc: 0,
                    total_atd: 0
                  }
                }
              };
              CONFIG.MESES.forEach(m => {
                baseData.atd_atc[dni].consolidado.meses[m.key] = { atc: 0, atd: 0 };
                baseData.atd_atc[dni].por_establecimiento[estab].meses[m.key] = { atc: 0, atd: 0 };
              });
            }

            Object.keys(staffObj.months).forEach(mKey => {
              if (!baseData.diario[dni][mKey]) {
                baseData.diario[dni][mKey] = {
                  mes: mKey,
                  dias: {},
                  total_atc: 0,
                  total_atd: 0
                };
                for (let d = 1; d <= 31; d++) {
                  const dTag = (d < 10 ? "0" : "") + d;
                  baseData.diario[dni][mKey].dias[dTag] = { atc: 0, atd: 0, citas: 0, triajes: 0 };
                }
              }

              const mEntry = baseData.diario[dni][mKey];
              const daysObj = staffObj.months[mKey];
              let addedMonthSum = 0;

              for (let d = 1; d <= 31; d++) {
                const dTag = (d < 10 ? "0" : "") + d;
                const prevCitas = mEntry.dias[dTag]?.citas || 0;
                const prevTriajes = mEntry.dias[dTag]?.triajes || 0;
                const hisAtc = Math.max(0, (mEntry.dias[dTag]?.atc || 0) - prevCitas - prevTriajes);

                const newCitas = sType === "CITAS" ? (daysObj[dTag] || 0) : prevCitas;
                const newTriajes = sType === "TRIAJES" ? (daysObj[dTag] || 0) : prevTriajes;

                mEntry.dias[dTag] = {
                  atc: hisAtc + newCitas + newTriajes,
                  atd: mEntry.dias[dTag]?.atd || 0,
                  citas: newCitas,
                  triajes: newTriajes
                };
                addedMonthSum += (hisAtc + newCitas + newTriajes);
              }

              mEntry.total_atc = addedMonthSum;
              mEntry.total_triajes = Object.values(mEntry.dias).reduce((acc, d) => acc + (d.triajes || 0), 0);
              mEntry.total_citas = Object.values(mEntry.dias).reduce((acc, d) => acc + (d.citas || 0), 0);

              // Actualizar en atd_atc mensual
              if (baseData.atd_atc[dni]?.consolidado?.meses?.[mKey]) {
                baseData.atd_atc[dni].consolidado.meses[mKey].atc = addedMonthSum;
              }
              const estKey = baseData.atd_atc[dni].establecimiento_principal || estab;
              if (baseData.atd_atc[dni]?.por_establecimiento?.[estKey]?.meses?.[mKey]) {
                baseData.atd_atc[dni].por_establecimiento[estKey].meses[mKey].atc = addedMonthSum;
              }
            });

            // Recalcular total anual
            let annualSum = 0;
            CONFIG.MESES.forEach(m => {
              annualSum += Number(baseData.atd_atc[dni]?.consolidado?.meses?.[m.key]?.atc || 0);
            });
            baseData.atd_atc[dni].consolidado.total_atc = annualSum;
            const estKey = baseData.atd_atc[dni].establecimiento_principal || estab;
            if (baseData.atd_atc[dni]?.por_establecimiento?.[estKey]) {
              baseData.atd_atc[dni].por_establecimiento[estKey].total_atc = annualSum;
            }
          });

          localStorage.setItem("DEMO_DATA_OVERRIDE", JSON.stringify(baseData));
          window.DEMO_DATA = baseData;
          Api._demoData = baseData;

          allUsers = Object.values(baseData.usuarios);
          updateKPIs();
          renderUsersTable(allUsers);

          showExcelAlert(`¡Producción de ${parsedExcelData.sihceLabel} incorporada y reemplazada con éxito! Se sincronizaron ${parsedExcelData.totalItems.toLocaleString()} registros para ${Object.keys(sData).length} trabajadores en el mes de ${parsedExcelData.months.join(", ")}.`, "success");
          excelPreviewCard.classList.add("d-none");
          if (excelFileInput) excelFileInput.value = "";
          return;
        }

        // CASO B: Archivo Reporte 40 HIS General
        // Conservar contraseñas previas existentes en DEMO_DATA / local
        const prevUsers = (window.DEMO_DATA && window.DEMO_DATA.usuarios) || {};
        Object.keys(parsedExcelData.usuarios).forEach(dni => {
          if (prevUsers[dni] && prevUsers[dni].password_hash) {
            parsedExcelData.usuarios[dni].password_hash = prevUsers[dni].password_hash;
          }
        });

        localStorage.setItem("DEMO_DATA_OVERRIDE", JSON.stringify(parsedExcelData));
        window.DEMO_DATA = parsedExcelData;
        Api._demoData = parsedExcelData;

        // Sincronizar catálogo de usuarios en Google Sheets (Hoja USUARIOS) sin sobreescribir contraseñas
        let syncMsg = "";
        try {
          const syncRes = await Api.callAppsScript("adminSyncUsers", {
            adminDni: currentAdmin.dni,
            users: Object.values(parsedExcelData.usuarios)
          });
          if (syncRes && syncRes.success && syncRes.message) {
            syncMsg = " " + syncRes.message;
          }
        } catch (e) {
          console.warn("No se pudo sincronizar usuarios con Google Sheets:", e);
        }

        allUsers = Object.values(parsedExcelData.usuarios);
        updateKPIs();
        renderUsersTable(allUsers);

        showExcelAlert("¡Base de datos actualizada con éxito!" + (syncMsg || " La nueva información ya está activa en todo el sistema para todos los trabajadores."), "success");
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

  // =====================================================================
  // 11. CONTROL DE ESTABLECIMIENTOS (IPRESS) CON DATATABLES (PESTAÑA 5)
  // =====================================================================
  let estabsDataTable = null;
  let estabsStatusMap = {};
  let allEstabsData = [];

  function normalizeEstabsMap(raw) {
    const res = {};
    if (!raw || typeof raw !== "object") return res;
    for (const [k, v] of Object.entries(raw)) {
      if (k) {
        res[k.trim().toUpperCase()] = !(v === false || v === "false" || v === 0 || v === "0");
      }
    }
    return res;
  }

  function isEstabActiveInAdmin(name) {
    if (!name) return true;
    const clean = name.trim().toUpperCase();
    return estabsStatusMap[clean] !== false;
  }

  function loadEstabsStatus() {
    const saved = localStorage.getItem("reporte40_ipress_control");
    if (saved) {
      try {
        estabsStatusMap = normalizeEstabsMap(JSON.parse(saved));
      } catch (e) {
        estabsStatusMap = {};
      }
    } else if (window.DEMO_DATA && window.DEMO_DATA.ipress_control) {
      estabsStatusMap = normalizeEstabsMap(window.DEMO_DATA.ipress_control);
    }
  }

  function getEstabsSummary() {
    const data = window.DEMO_DATA || {};
    const usuarios = data.usuarios || {};
    const atdAtc = data.atd_atc || {};

    const estabMap = {};

    // 1. Recorrer usuarios para saber personal por IPRESS y MicroRed
    Object.values(usuarios).forEach(u => {
      const estabs = u.establecimientos || (u.establecimiento ? [u.establecimiento] : []);
      estabs.forEach(est => {
        if (!est) return;
        const key = est.trim().toUpperCase();
        if (!estabMap[key]) {
          estabMap[key] = {
            nombre: est.trim(),
            microred: u.microred || "RED CUSCO SUR",
            personalSet: new Set(),
            totalATC: 0
          };
        }
        estabMap[key].personalSet.add(u.dni);
        if (u.microred && (!estabMap[key].microred || estabMap[key].microred === "RED CUSCO SUR")) {
          estabMap[key].microred = u.microred;
        }
      });
    });

    // 2. Sumar ATC de cada IPRESS desde atd_atc
    Object.values(atdAtc).forEach(item => {
      const porEst = item.por_establecimiento || {};
      Object.keys(porEst).forEach(estName => {
        const key = estName.trim().toUpperCase();
        const tot = Number(porEst[estName].total_atc) || 0;
        if (!estabMap[key]) {
          estabMap[key] = {
            nombre: estName.trim(),
            microred: "RED CUSCO SUR",
            personalSet: new Set([item.dni]),
            totalATC: 0
          };
        }
        estabMap[key].totalATC += tot;
      });
    });

    const list = Object.values(estabMap).map(e => ({
      nombre: e.nombre,
      microred: e.microred || "RED CUSCO SUR",
      personalCount: e.personalSet.size,
      totalATC: e.totalATC,
      activo: isEstabActiveInAdmin(e.nombre)
    }));

    list.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return list;
  }

  function initEstabsControl() {
    loadEstabsStatus();
    allEstabsData = getEstabsSummary();

    const estabsTableBody = document.getElementById("estabsTableBody");
    const estabsActiveBadge = document.getElementById("estabsActiveBadge");
    const microredFilterSelect = document.getElementById("microredFilterSelect");
    const estabsControlAlert = document.getElementById("estabsControlAlert");

    if (!estabsTableBody) return;

    function updateActiveBadge() {
      const total = allEstabsData.length;
      const activeCount = allEstabsData.filter(e => isEstabActiveInAdmin(e.nombre)).length;
      if (estabsActiveBadge) {
        estabsActiveBadge.textContent = `${activeCount} de ${total} IPRESS Activas`;
        estabsActiveBadge.className = activeCount === total ? "badge-custom badge-success" : "badge-custom badge-warning";
      }
    }

    // Poblar MicroRedes únicas en el select
    const uniqueMicroredes = Array.from(new Set(allEstabsData.map(e => e.microred).filter(Boolean))).sort();
    if (microredFilterSelect && microredFilterSelect.options.length <= 1) {
      microredFilterSelect.innerHTML = '<option value="">Todas las MicroRedes</option>';
      uniqueMicroredes.forEach(mr => {
        const opt = document.createElement("option");
        opt.value = mr;
        opt.textContent = mr;
        microredFilterSelect.appendChild(opt);
      });
    }

    function renderTableAndDataTable() {
      const currentFilter = microredFilterSelect ? $(microredFilterSelect).val() : "";

      if (window.jQuery && $.fn.DataTable && $.fn.DataTable.isDataTable("#estabsTable")) {
        $("#estabsTable").DataTable().destroy();
      }

      estabsTableBody.innerHTML = "";
      allEstabsData.forEach((est, idx) => {
        const isActive = isEstabActiveInAdmin(est.nombre);
        const tr = document.createElement("tr");
        tr.setAttribute("data-estab", est.nombre);
        tr.setAttribute("data-microred", est.microred);

        tr.innerHTML = `
          <td class="text-muted small">${idx + 1}</td>
          <td><span class="badge-custom badge-info">${est.microred}</span></td>
          <td><strong class="estab-name text-main">${est.nombre}</strong></td>
          <td class="text-center fw-semibold text-main">${est.personalCount}</td>
          <td class="text-center fw-semibold text-primary">${est.totalATC.toLocaleString()}</td>
          <td class="text-center status-col">
            <span class="badge-custom ${isActive ? 'badge-success' : 'badge-danger'} status-badge">
              <i class="bi ${isActive ? 'bi-check-circle-fill' : 'bi-slash-circle-fill'} me-1"></i>
              ${isActive ? 'Activo' : 'Bloqueado'}
            </span>
          </td>
          <td class="text-center">
            <div class="form-check form-switch d-inline-block">
              <input class="form-check-input ipress-switch" type="checkbox" role="switch" data-estab="${est.nombre}" ${isActive ? 'checked' : ''} title="Activar/Desactivar IPRESS">
            </div>
          </td>
        `;
        estabsTableBody.appendChild(tr);
      });

      updateActiveBadge();

      if (window.jQuery && $.fn.DataTable) {
        estabsDataTable = $("#estabsTable").DataTable({
          responsive: true,
          pageLength: 15,
          lengthMenu: [10, 15, 25, 50, 100],
          order: [[2, "asc"]],
          language: {
            search: "Buscar IPRESS:",
            searchPlaceholder: "Nombre o MicroRed...",
            lengthMenu: "Mostrar _MENU_ por página",
            info: "Mostrando _START_ a _END_ de _TOTAL_ IPRESS",
            infoEmpty: "Mostrando 0 IPRESS",
            infoFiltered: "(filtrado de _MAX_ en total)",
            paginate: {
              first: '<i class="bi bi-chevron-double-left"></i>',
              previous: '<i class="bi bi-chevron-left"></i>',
              next: '<i class="bi bi-chevron-right"></i>',
              last: '<i class="bi bi-chevron-double-right"></i>'
            },
            emptyTable: "No hay establecimientos disponibles"
          }
        });

        if (currentFilter) {
          estabsDataTable.column(1).search(`^${currentFilter}$`, true, false).draw();
        }
      }
    }

    renderTableAndDataTable();

    // Sincronizar con el estado real guardado en Google Sheets (Hoja CONFIG)
    async function fetchCloudEstabsStatus() {
      try {
        const res = await Api.callAppsScript("getIpressControl");
        if (res && res.success && res.ipress_control && Object.keys(res.ipress_control).length > 0) {
          estabsStatusMap = normalizeEstabsMap(res.ipress_control);
          localStorage.setItem("reporte40_ipress_control", JSON.stringify(estabsStatusMap));
          if (window.DEMO_DATA) {
            window.DEMO_DATA.ipress_control = estabsStatusMap;
          }
          allEstabsData = getEstabsSummary();
          renderTableAndDataTable();
        }
      } catch (e) {
        console.warn("No se pudo cargar control IPRESS desde Google Sheets:", e);
      }
    }
    fetchCloudEstabsStatus();

    // Filtro de MicroRed sincronizado con DataTable
    if (microredFilterSelect) {
      $(microredFilterSelect).off("change").on("change", function () {
        const val = $(this).val();
        if (estabsDataTable) {
          estabsDataTable.column(1).search(val ? `^${val}$` : '', true, false).draw();
        }
      });
    }

    // Delegación de eventos para switches individuales
    $(document).off("change", ".ipress-switch").on("change", ".ipress-switch", function () {
      const estabName = $(this).attr("data-estab");
      const isChecked = $(this).is(":checked");
      estabsStatusMap[estabName.trim().toUpperCase()] = isChecked;

      const tr = $(this).closest("tr");
      const statusBadge = tr.find(".status-badge");
      if (isChecked) {
        statusBadge.removeClass("badge-danger").addClass("badge-success").html('<i class="bi bi-check-circle-fill me-1"></i> Activo');
      } else {
        statusBadge.removeClass("badge-success").addClass("badge-danger").html('<i class="bi bi-slash-circle-fill me-1"></i> Bloqueado');
      }

      saveEstabsStatus(false);
      updateActiveBadge();
    });

    // Activar MicroRed seleccionada
    $("#btnActivateMicrored").off("click").on("click", function () {
      const selectedMr = $(microredFilterSelect).val();
      if (!selectedMr) {
        alert("Por favor selecciona primero una MicroRed en el desplegable.");
        return;
      }
      allEstabsData.forEach(e => {
        if (e.microred === selectedMr) {
          estabsStatusMap[e.nombre.trim().toUpperCase()] = true;
        }
      });
      saveEstabsStatus(false);
      renderTableAndDataTable();
      showControlAlert(`¡Se activaron todas las IPRESS de la MicroRed ${selectedMr}!`, "success");
    });

    // Desactivar MicroRed seleccionada
    $("#btnDeactivateMicrored").off("click").on("click", function () {
      const selectedMr = $(microredFilterSelect).val();
      if (!selectedMr) {
        alert("Por favor selecciona primero una MicroRed en el desplegable.");
        return;
      }
      if (!confirm(`¿Bloquear la producción de todos los establecimientos de la MicroRed ${selectedMr}?`)) return;
      allEstabsData.forEach(e => {
        if (e.microred === selectedMr) {
          estabsStatusMap[e.nombre.trim().toUpperCase()] = false;
        }
      });
      saveEstabsStatus(false);
      renderTableAndDataTable();
      showControlAlert(`¡Se bloquearon todas las IPRESS de la MicroRed ${selectedMr}!`, "warning");
    });

    // Botón Activar Todas
    $("#btnActivateAllEstabs").off("click").on("click", function () {
      allEstabsData.forEach(e => {
        estabsStatusMap[e.nombre.trim().toUpperCase()] = true;
      });
      saveEstabsStatus(true);
      renderTableAndDataTable();
    });

    // Botón Desactivar Todas
    $("#btnDeactivateAllEstabs").off("click").on("click", function () {
      if (!confirm("¿Deseas bloquear la producción de TODOS los 71 establecimientos? Los usuarios verán un aviso de conciliación.")) return;
      allEstabsData.forEach(e => {
        estabsStatusMap[e.nombre.trim().toUpperCase()] = false;
      });
      saveEstabsStatus(true);
      renderTableAndDataTable();
    });

    // Botón Guardar Cambios
    $("#btnSaveEstabsStatus").off("click").on("click", function () {
      saveEstabsStatus(true);
    });

    function showControlAlert(msg, type = "success") {
      if (!estabsControlAlert) return;
      estabsControlAlert.className = `alert alert-${type} py-2 px-3 small fade-in`;
      estabsControlAlert.innerHTML = `<i class="bi bi-info-circle-fill me-1"></i> ${msg}`;
      setTimeout(() => {
        estabsControlAlert.className = "alert d-none";
      }, 4000);
    }

    async function saveEstabsStatus(showAlert = false) {
      estabsStatusMap = normalizeEstabsMap(estabsStatusMap);
      localStorage.setItem("reporte40_ipress_control", JSON.stringify(estabsStatusMap));
      if (window.DEMO_DATA) {
        window.DEMO_DATA.ipress_control = estabsStatusMap;
      }

      if (showAlert) {
        showControlAlert("Sincronizando control de IPRESS con Google Sheets...", "info");
      }

      try {
        const res = await Api.callAppsScript("adminSaveIpressControl", {
          adminDni: currentAdmin.dni,
          ipressStatus: estabsStatusMap
        });
        if (showAlert) {
          if (res && res.success) {
            showControlAlert("¡Control de IPRESS guardado y sincronizado con éxito en Google Sheets! Las restricciones aplican a todos los usuarios.", "success");
          } else {
            showControlAlert("Guardado localmente. Advertencia nube: " + (res?.message || "No se pudo sincronizar"), "warning");
          }
        }
      } catch (e) {
        if (showAlert) {
          showControlAlert("Guardado en este navegador. Nota: No se pudo conectar a Google Sheets.", "info");
        }
      }
    }
  }

  // =====================================================================
  // 12. CONTROL DE AÑOS Y PERIODOS DISPONIBLES (PESTAÑA 6)
  // =====================================================================
  let allConfiguredYears = ["2026", "2027"];
  let activeYearsSet = new Set(["2026"]);

  function loadYearsStatus() {
    try {
      const saved = localStorage.getItem("reporte40_anios_habilitados");
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr) && arr.length > 0) {
          activeYearsSet = new Set(arr.map(String));
          arr.forEach(y => {
            if (!allConfiguredYears.includes(String(y))) allConfiguredYears.push(String(y));
          });
        }
      }
    } catch (e) {}
  }

  function initYearsControl() {
    loadYearsStatus();
    const yearsTableBody = document.getElementById("yearsTableBody");
    const yearsControlAlert = document.getElementById("yearsControlAlert");
    const btnAddNewYear = document.getElementById("btnAddNewYear");
    const btnSaveYearsStatus = document.getElementById("btnSaveYearsStatus");

    if (!yearsTableBody) return;

    function renderYearsTable() {
      yearsTableBody.innerHTML = "";
      allConfiguredYears.sort().forEach((yr, idx) => {
        const isEnabled = activeYearsSet.has(yr);
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="text-muted small">${idx + 1}</td>
          <td><strong class="text-main fs-6">${yr}</strong></td>
          <td class="text-muted small">Periodo Asistencial Anual ${yr} — Sistema Reporte 40</td>
          <td class="text-center status-col">
            <span class="badge-custom ${isEnabled ? 'badge-success' : 'badge-danger'} status-badge">
              <i class="bi ${isEnabled ? 'bi-check-circle-fill' : 'bi-lock-fill'} me-1"></i>
              ${isEnabled ? 'Habilitado' : 'Bloqueado (Auditoría)'}
            </span>
          </td>
          <td class="text-center">
            <div class="form-check form-switch d-inline-block">
              <input class="form-check-input year-switch" type="checkbox" role="switch" data-year="${yr}" ${isEnabled ? 'checked' : ''} title="Habilitar/Deshabilitar Año">
            </div>
          </td>
        `;
        yearsTableBody.appendChild(tr);
      });
    }

    renderYearsTable();

    // Sincronizar con la nube
    async function fetchCloudYears() {
      try {
        const res = await Api.callAppsScript("getEnabledYears");
        if (res && res.success && Array.isArray(res.anios_habilitados) && res.anios_habilitados.length > 0) {
          activeYearsSet = new Set(res.anios_habilitados.map(String));
          res.anios_habilitados.forEach(y => {
            if (!allConfiguredYears.includes(String(y))) allConfiguredYears.push(String(y));
          });
          localStorage.setItem("reporte40_anios_habilitados", JSON.stringify(Array.from(activeYearsSet)));
          renderYearsTable();
        }
      } catch (e) {}
    }
    fetchCloudYears();

    // Toggle switch
    $(document).off("change", ".year-switch").on("change", ".year-switch", function () {
      const yr = String($(this).attr("data-year"));
      const isChecked = $(this).is(":checked");
      if (isChecked) {
        activeYearsSet.add(yr);
      } else {
        if (activeYearsSet.size === 1 && activeYearsSet.has(yr)) {
          alert("Debe haber al menos un año habilitado para que los usuarios puedan consultar el sistema.");
          $(this).prop("checked", true);
          return;
        }
        activeYearsSet.delete(yr);
      }
      renderYearsTable();
      saveYearsStatus(false);
    });

    // Agregar nuevo año
    if (btnAddNewYear) {
      btnAddNewYear.addEventListener("click", () => {
        const nextYear = prompt("Ingresa el nuevo año a configurar (ejemplo: 2027 o 2028):");
        if (!nextYear) return;
        const cleanYr = nextYear.trim();
        if (!/^\d{4}$/.test(cleanYr)) {
          alert("Por favor ingresa un año válido de 4 dígitos (ejemplo: 2027).");
          return;
        }
        if (!allConfiguredYears.includes(cleanYr)) {
          allConfiguredYears.push(cleanYr);
        }
        activeYearsSet.add(cleanYr);
        renderYearsTable();
        saveYearsStatus(true);
      });
    }

    // Botón Guardar
    if (btnSaveYearsStatus) {
      btnSaveYearsStatus.addEventListener("click", () => {
        saveYearsStatus(true);
      });
    }

    function showYearsAlert(msg, type = "success") {
      if (!yearsControlAlert) return;
      yearsControlAlert.className = `alert alert-${type} py-2 px-3 small fade-in`;
      yearsControlAlert.innerHTML = `<i class="bi bi-info-circle-fill me-1"></i> ${msg}`;
      setTimeout(() => {
        yearsControlAlert.className = "alert d-none";
      }, 4000);
    }

    async function saveYearsStatus(showAlert = false) {
      const yearsArr = Array.from(activeYearsSet);
      localStorage.setItem("reporte40_anios_habilitados", JSON.stringify(yearsArr));

      if (showAlert) {
        showYearsAlert("Sincronizando configuración de años con Google Sheets...", "info");
      }

      try {
        const res = await Api.callAppsScript("adminSaveEnabledYears", {
          adminDni: currentAdmin.dni,
          years: yearsArr
        });
        if (showAlert) {
          if (res && res.success) {
            showYearsAlert("¡Configuración de años guardada con éxito en Google Sheets! Aplica a todos los usuarios.", "success");
          } else {
            showYearsAlert("Guardado en este navegador. Advertencia nube: " + (res?.message || "Error al conectar"), "warning");
          }
        }
      } catch (e) {
        if (showAlert) {
          showYearsAlert("Guardado en este navegador. Nota: No se pudo conectar a Google Sheets.", "info");
        }
      }
    }
  }

  // =====================================================================
  // 13. GENERADOR DE REPORTE PERSONALIZADO SERUMS (MULTI-ANUAL)
  // Exclusivo Reporte 40 (HIS General). Sin Citas ni Triajes.
  // =====================================================================
  let serumsModalInstance = null;
  let currentSerumsUser = null;
  let currentSerumsAtd = null;
  let currentSerumsApp = null;
  let currentSerumsMonthsList = [];
  let currentSerumsTotals = null;

  const MONTH_DEFS = [
    { key: "ENE", label: "Enero" },
    { key: "FEB", label: "Febrero" },
    { key: "MAR", label: "Marzo" },
    { key: "ABR", label: "Abril" },
    { key: "MAY", label: "Mayo" },
    { key: "JUN", label: "Junio" },
    { key: "JUL", label: "Julio" },
    { key: "AGO", label: "Agosto" },
    { key: "SET", label: "Setiembre" },
    { key: "OCT", label: "Octubre" },
    { key: "NOV", label: "Noviembre" },
    { key: "DIC", label: "Diciembre" }
  ];

  function openSerumsModal(targetDni = null) {
    const modalEl = document.getElementById("serumsReportModal");
    if (!modalEl) return;
    if (!serumsModalInstance) {
      serumsModalInstance = new bootstrap.Modal(modalEl);
    }

    const userSelect = document.getElementById("serumsUserSelect");
    if (userSelect) {
      userSelect.innerHTML = '<option value="">-- Seleccionar personal de salud --</option>';
      const sortedUsers = [...allUsers].sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
      sortedUsers.forEach(u => {
        const opt = document.createElement("option");
        opt.value = u.dni;
        opt.textContent = `${u.nombre} (DNI: ${u.dni} — ${u.establecimiento || "Sin IPRESS"})`;
        userSelect.appendChild(opt);
      });

      if (targetDni) {
        userSelect.value = targetDni;
      }
    }

    serumsModalInstance.show();
    if (targetDni) {
      handleSerumsUserChange(targetDni);
    }
  }

  async function handleSerumsUserChange(dni) {
    const infoBox = document.getElementById("serumsUserInfoBox");
    const estabSelect = document.getElementById("serumsEstabSelect");
    const previewSection = document.getElementById("serumsPreviewSection");
    const btnDownload = document.getElementById("btnDownloadSerumsPdf");

    if (!dni) {
      currentSerumsUser = null;
      currentSerumsAtd = null;
      currentSerumsApp = null;
      if (infoBox) infoBox.classList.add("d-none");
      if (previewSection) previewSection.classList.add("d-none");
      if (btnDownload) btnDownload.disabled = true;
      if (estabSelect) estabSelect.innerHTML = '<option value="ALL">Consolidado (Todos sus establecimientos)</option>';
      return;
    }

    currentSerumsUser = allUsers.find(u => Api.matchesDni(u.dni, dni)) ||
      (window.DEMO_DATA?.usuarios?.[dni]) ||
      { dni, nombre: "Personal " + dni };

    // Llenar info box
    document.getElementById("serumsInfoName").textContent = currentSerumsUser.nombre || "-";
    document.getElementById("serumsInfoDni").textContent = currentSerumsUser.dni || dni;
    document.getElementById("serumsInfoEstab").textContent = currentSerumsUser.establecimiento || "-";
    document.getElementById("serumsInfoMicrored").textContent = currentSerumsUser.microred || "-";
    document.getElementById("serumsInfoColegio").textContent = currentSerumsUser.colegio || "No registrado";
    if (infoBox) infoBox.classList.remove("d-none");

    // Cargar dataset ATD/ATC y APP exclusivo de Reporte 40 (sin SIHCE)
    let userAtd = null;
    let userApp = null;
    try {
      const res = await Api.callAppsScript("getData", { dni });
      if (res && res.success) {
        userAtd = res.atd_atc;
        userApp = res.app;
      }
    } catch (e) {}

    if (!userAtd && window.DEMO_DATA) {
      const atdMatch = Api.findInMapByDni(dni, window.DEMO_DATA.atd_atc);
      const appMatch = Api.findInMapByDni(dni, window.DEMO_DATA.app);
      userAtd = atdMatch?.data || null;
      userApp = appMatch?.data || null;
    }

    currentSerumsAtd = userAtd;
    currentSerumsApp = userApp;

    // Llenar selector de establecimientos
    if (estabSelect) {
      estabSelect.innerHTML = '<option value="ALL">Consolidado (Todos sus establecimientos)</option>';
      const estabSet = new Set();
      if (currentSerumsUser.establecimiento) estabSet.add(currentSerumsUser.establecimiento);
      if (Array.isArray(currentSerumsUser.establecimientos)) {
        currentSerumsUser.establecimientos.forEach(e => estabSet.add(e));
      }
      if (currentSerumsAtd && currentSerumsAtd.por_establecimiento) {
        Object.keys(currentSerumsAtd.por_establecimiento).forEach(e => estabSet.add(e));
      }
      estabSet.forEach(est => {
        if (est && est.trim()) {
          const opt = document.createElement("option");
          opt.value = est;
          opt.textContent = est;
          estabSelect.appendChild(opt);
        }
      });
    }

    calculateSerumsPreview();
  }

  function calculateSerumsPreview() {
    if (!currentSerumsUser) return;

    const startM = parseInt(document.getElementById("serumsStartMonth").value, 10);
    const startY = parseInt(document.getElementById("serumsStartYear").value, 10);
    const endM = parseInt(document.getElementById("serumsEndMonth").value, 10);
    const endY = parseInt(document.getElementById("serumsEndYear").value, 10);

    const periodText = document.getElementById("serumsPeriodRangeText");
    const previewSection = document.getElementById("serumsPreviewSection");
    const btnDownload = document.getElementById("btnDownloadSerumsPdf");
    const tableBody = document.getElementById("serumsPreviewTableBody");
    const estabSelect = document.getElementById("serumsEstabSelect");
    const selectedEstab = estabSelect ? estabSelect.value : "ALL";

    const startIndex = startY * 12 + startM;
    const endIndex = endY * 12 + endM;

    if (endIndex < startIndex) {
      if (periodText) {
        periodText.textContent = "Error: El mes y año de término deben ser posteriores o iguales al inicio.";
        periodText.className = "mt-2 text-danger small fw-bold";
      }
      if (previewSection) previewSection.classList.add("d-none");
      if (btnDownload) btnDownload.disabled = true;
      return;
    }

    const totalMonths = endIndex - startIndex + 1;
    if (periodText) {
      periodText.textContent = `Periodo Seleccionado: ${MONTH_DEFS[startM].label} ${startY} a ${MONTH_DEFS[endM].label} ${endY} (${totalMonths} ${totalMonths === 1 ? 'mes' : 'meses'})`;
      periodText.className = "mt-2 text-primary small fw-bold";
    }

    const monthsList = [];
    let sumAtc = 0;
    let sumAtd = 0;
    let sumApp = 0;

    for (let step = startIndex; step <= endIndex; step++) {
      const curYear = Math.floor(step / 12);
      const mIdx = step % 12;
      const mDef = MONTH_DEFS[mIdx];

      let atc = 0;
      let atd = 0;
      let app = 0;

      // Lectura exclusiva de Reporte 40 (HIS General)
      if (currentSerumsAtd) {
        let yearAtd = currentSerumsAtd;
        let yearApp = currentSerumsApp;

        // Soporte para estructura multianual si existe
        if (currentSerumsAtd.anios && currentSerumsAtd.anios[curYear]) {
          yearAtd = currentSerumsAtd.anios[curYear];
        }
        if (currentSerumsApp && currentSerumsApp.anios && currentSerumsApp.anios[curYear]) {
          yearApp = currentSerumsApp.anios[curYear];
        }

        if (selectedEstab === "ALL") {
          atc = Number(yearAtd?.consolidado?.meses?.[mDef.key]?.atc) || 0;
          atd = Number(yearAtd?.consolidado?.meses?.[mDef.key]?.atd) || 0;
          app = Number(yearApp?.consolidado?.meses?.[mDef.key]) || 0;
        } else {
          atc = Number(yearAtd?.por_establecimiento?.[selectedEstab]?.meses?.[mDef.key]?.atc) || 0;
          atd = Number(yearAtd?.por_establecimiento?.[selectedEstab]?.meses?.[mDef.key]?.atd) || 0;
          app = Number(yearApp?.por_establecimiento?.[selectedEstab]?.meses?.[mDef.key]) || 0;
        }
      }

      const totalMes = atc + app;
      sumAtc += atc;
      sumAtd += atd;
      sumApp += app;

      monthsList.push({
        monthKey: mDef.key,
        monthLabel: mDef.label,
        year: String(curYear),
        fullLabel: `${mDef.label} ${curYear}`,
        atc,
        atd,
        app,
        total: totalMes
      });
    }

    currentSerumsMonthsList = monthsList;
    currentSerumsTotals = {
      total_atc: sumAtc,
      total_atd: sumAtd,
      total_app: sumApp,
      total_prod: sumAtc + sumApp
    };

    // Actualizar KPIs visuales
    document.getElementById("serumsKpiAtc").textContent = sumAtc.toLocaleString();
    document.getElementById("serumsKpiAtd").textContent = sumAtd.toLocaleString();
    document.getElementById("serumsKpiApp").textContent = sumApp.toLocaleString();
    document.getElementById("serumsKpiTotal").textContent = (sumAtc + sumApp).toLocaleString();

    // Renderizar tabla previa
    if (tableBody) {
      tableBody.innerHTML = "";
      monthsList.forEach((m, idx) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="text-center text-muted">${idx + 1}</td>
          <td><strong>${m.fullLabel}</strong></td>
          <td class="text-center">${m.atc.toLocaleString()}</td>
          <td class="text-center">${m.atd.toLocaleString()}</td>
          <td class="text-center">${m.app.toLocaleString()}</td>
          <td class="text-center fw-bold text-primary">${m.total.toLocaleString()}</td>
        `;
        tableBody.appendChild(tr);
      });
    }

    if (previewSection) previewSection.classList.remove("d-none");
    if (btnDownload) btnDownload.disabled = false;
  }

  function initSerumsReportControl() {
    const btnOpenModal = document.getElementById("btnOpenSerumsModal");
    const userSelect = document.getElementById("serumsUserSelect");
    const estabSelect = document.getElementById("serumsEstabSelect");
    const startM = document.getElementById("serumsStartMonth");
    const startY = document.getElementById("serumsStartYear");
    const endM = document.getElementById("serumsEndMonth");
    const endY = document.getElementById("serumsEndYear");
    const btnDownload = document.getElementById("btnDownloadSerumsPdf");

    if (btnOpenModal) {
      btnOpenModal.addEventListener("click", () => openSerumsModal());
    }

    if (userSelect) {
      userSelect.addEventListener("change", (e) => {
        handleSerumsUserChange(e.target.value);
      });
    }

    [estabSelect, startM, startY, endM, endY].forEach(el => {
      if (el) {
        el.addEventListener("change", () => {
          calculateSerumsPreview();
        });
      }
    });

    if (btnDownload) {
      btnDownload.addEventListener("click", async () => {
        if (!currentSerumsUser || !currentSerumsMonthsList || currentSerumsMonthsList.length === 0) {
          alert("Por favor selecciona un profesional y un rango válido.");
          return;
        }

        btnDownload.disabled = true;
        btnDownload.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Generando PDF...';

        try {
          const sM = parseInt(startM.value, 10);
          const sY = parseInt(startY.value, 10);
          const eM = parseInt(endM.value, 10);
          const eY = parseInt(endY.value, 10);
          const periodLabel = `${MONTH_DEFS[sM].label} ${sY} a ${MONTH_DEFS[eM].label} ${eY}`;
          const selectedEstab = estabSelect ? estabSelect.value : "ALL";

          // Registrar en log de auditoría
          Api.callAppsScript("logDownload", {
            dni: currentSerumsUser.dni,
            personal: currentSerumsUser.nombre,
            establecimiento: selectedEstab === "ALL" ? "Consolidado Red Cusco Sur" : selectedEstab,
            meses: `SERUMS (${periodLabel})`,
            tipo: "PDF_SERUMS_ADMIN"
          });

          await PdfGenerator.generateSerums({
            user: currentSerumsUser,
            periodLabel,
            monthsList: currentSerumsMonthsList,
            selectedEstab,
            totals: currentSerumsTotals
          });
        } catch (err) {
          alert("Error al generar reporte SERUMS: " + err.message);
        } finally {
          btnDownload.disabled = false;
          btnDownload.innerHTML = '<i class="bi bi-file-earmark-pdf-fill me-1"></i> Descargar Reporte SERUMS (PDF)';
        }
      });
    }
  }

  // Ejecución inicial
  loadInitialData();
  initEstabsControl();
  initYearsControl();
  initSerumsReportControl();
});

