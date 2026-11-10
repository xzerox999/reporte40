/**
 * =====================================================================
 * CONTROLADOR DEL DASHBOARD (PERSONAL DE SALUD)
 * Soporta Consolidado Multi-Establecimiento y Filtro por IPRESS
 * Hecho por xzerox99
 * =====================================================================
 */

document.addEventListener("DOMContentLoaded", async () => {
  // 0. Funciones de barra de progreso de vinculación inicial
  const syncOverlay = document.getElementById("syncDatabaseOverlay");
  const syncProgressBar = document.getElementById("syncProgressBar");
  const syncPercentText = document.getElementById("syncPercentText");
  const syncStepText = document.getElementById("syncStepText");
  const syncTitle = document.getElementById("syncTitle");
  const syncIconContainer = document.getElementById("syncIconContainer");

  function setSyncProgress(percent, stepMessage, title = null) {
    if (syncProgressBar) syncProgressBar.style.width = percent + "%";
    if (syncPercentText) syncPercentText.textContent = percent + "%";
    if (syncStepText && stepMessage) syncStepText.textContent = stepMessage;
    if (syncTitle && title) syncTitle.textContent = title;
  }

  function finishSyncOverlay() {
    setSyncProgress(100, "¡Sincronización completa con la Red Cusco Sur!", "¡Datos Vinculados Exitosamente!");
    if (syncIconContainer) {
      syncIconContainer.innerHTML = '<i class="bi bi-check-circle-fill text-success"></i>';
      syncIconContainer.style.background = "rgba(16, 185, 129, 0.15)";
      syncIconContainer.style.color = "#10b981";
    }
    setTimeout(() => {
      if (syncOverlay) {
        syncOverlay.classList.add("fade-out");
        setTimeout(() => syncOverlay.remove(), 400);
      }
    }, 450);
  }

  setSyncProgress(15, "Verificando credenciales institucionales...");

  // 1. Validar autenticación
  if (!Auth.requireAuth()) return;

  // Soporte para Modo Simulación de Auditor (Admin viendo como un personal específico)
  let currentUser = Auth.getCurrentUser();
  const impersonateDni = sessionStorage.getItem("impersonate_user_dni");
  if (impersonateDni && Auth.isAdmin()) {
    const demo = window.DEMO_DATA || {};
    const targetUser = demo.usuarios && demo.usuarios[impersonateDni];
    if (targetUser) {
      currentUser = { ...targetUser };
      // Insertar banner superior de auditor
      const auditBanner = document.createElement("div");
      auditBanner.className = "alert alert-info py-2 px-3 mb-0 text-center fw-bold d-flex justify-content-between align-items-center shadow-sm";
      auditBanner.style.borderRadius = "0";
      auditBanner.style.borderBottom = "2px solid #0284c7";
      auditBanner.innerHTML = `
        <span><i class="bi bi-eye-fill me-2 text-primary fs-5"></i> MODO SIMULACIÓN AUDITOR: Visualizando producción de <u>${targetUser.nombre}</u> (DNI: ${impersonateDni})</span>
        <button class="btn btn-sm btn-dark" onclick="sessionStorage.removeItem('impersonate_user_dni'); window.close(); window.location.reload();">
          <i class="bi bi-x-circle me-1"></i> Finalizar Simulación
        </button>
      `;
      document.body.prepend(auditBanner);
    }
  }

  let userAtdData = null;
  let userAppData = null;
  let userDailyData = null;
  let isDailyModeActive = false;
  let selectedEstab = "ALL"; // Por defecto "ALL" (Consolidado)
  let selectedMonths = []; // Todos desactivados por defecto al cargar según indicación

  // Control de IPRESS activas/bloqueadas
  function getIpressControl() {
    try {
      const saved = localStorage.getItem("reporte40_ipress_control");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    if (window.DEMO_DATA && window.DEMO_DATA.ipress_control) {
      return window.DEMO_DATA.ipress_control;
    }
    return {};
  }

  function isIpressActive(estabName) {
    if (!estabName) return true;
    const ctrl = getIpressControl();
    if (!ctrl || Object.keys(ctrl).length === 0) return true;
    const clean = estabName.trim().toUpperCase();
    for (const [k, v] of Object.entries(ctrl)) {
      if (k.trim().toUpperCase() === clean) {
        return v !== false;
      }
    }
    return true;
  }

  // Elementos DOM
  const navUserName = document.getElementById("navUserName");
  const userNameDisplay = document.getElementById("userNameDisplay");
  const userDniBadge = document.getElementById("userDniBadge");
  const userEstabDisplay = document.getElementById("userEstabDisplay");
  const userMicroRedDisplay = document.getElementById("userMicroRedDisplay");
  const userColegioDisplay = document.getElementById("userColegioDisplay");
  const userColegioContainer = document.getElementById("userColegioContainer");
  const adminMenuOption = document.getElementById("adminMenuOption");
  const logoutBtn = document.getElementById("logoutBtn");
  const urgentPasswordAlert = document.getElementById("urgentPasswordAlert");
  const disabledIpressAlert = document.getElementById("disabledIpressAlert");

  const estabSelectorCard = document.getElementById("estabSelectorCard");
  const estabSelect = document.getElementById("estabSelect");
  const multiEstabBadge = document.getElementById("multiEstabBadge");
  const multiEstabCount = document.getElementById("multiEstabCount");

  const monthSelectorContainer = document.getElementById("monthSelectorContainer");
  const selectedCountBadge = document.getElementById("selectedCountBadge");
  const selectAllMonthsBtn = document.getElementById("selectAllMonthsBtn");
  const clearMonthsBtn = document.getElementById("clearMonthsBtn");

  const kpiATC = document.getElementById("kpiATC");
  const kpiATD = document.getElementById("kpiATD");
  const kpiAPP = document.getElementById("kpiAPP");

  const atdTableBody = document.getElementById("atdTableBody");
  const atdTableHead = document.getElementById("atdTableHead");
  const atdTableFoot = document.getElementById("atdTableFoot");
  const atdTableTotalATC = document.getElementById("atdTableTotalATC");
  const atdTableTotalATD = document.getElementById("atdTableTotalATD");

  const appTableBody = document.getElementById("appTableBody");
  const appTableTotal = document.getElementById("appTableTotal");

  const downloadPdfBtn = document.getElementById("downloadPdfBtn");

  // Elementos de Control de Modo Diario
  const toggleDailyReport = document.getElementById("toggleDailyReport");
  const dailyAvailabilityBadge = document.getElementById("dailyAvailabilityBadge");
  const dailyReportHelpText = document.getElementById("dailyReportHelpText");
  const dailyDetailSection = document.getElementById("dailyDetailSection");
  const dailySectionTitle = document.getElementById("dailySectionTitle");
  const dailyTableBody = document.getElementById("dailyTableBody");
  const dailyTotalATC = document.getElementById("dailyTotalATC");
  const dailyTotalATD = document.getElementById("dailyTotalATD");
  const dailyDaysActiveText = document.getElementById("dailyDaysActiveText");
  const dailyTotalBadge = document.getElementById("dailyTotalBadge");

  // Mostrar datos del usuario en la interfaz
  navUserName.textContent = currentUser.nombre ? currentUser.nombre.split(" ")[0] : "Personal";
  userNameDisplay.textContent = currentUser.nombre || "Personal de Salud";
  userDniBadge.textContent = `DNI: ${currentUser.dni}`;
  userEstabDisplay.textContent = currentUser.establecimiento || "No especificado";
  userMicroRedDisplay.textContent = currentUser.microred || "-";

  if (currentUser.colegio) {
    userColegioDisplay.textContent = currentUser.colegio;
  } else {
    userColegioContainer.classList.add("d-none");
  }

  if (Auth.isAdmin()) {
    adminMenuOption.classList.remove("d-none");
  }

  // Logout
  logoutBtn.addEventListener("click", (e) => {
    e.preventDefault();
    Auth.logout();
  });

  // Helpers para obtener el conjunto de datos activo (Consolidado o IPRESS específica)
  function getActiveAtdDataset() {
    if (!userAtdData) return null;

    if (selectedEstab === "ALL" || !userAtdData.por_establecimiento) {
      const porEst = userAtdData.por_establecimiento || {};
      const estabNames = Object.keys(porEst);

      if (estabNames.length > 0) {
        const activeEstabs = estabNames.filter(e => isIpressActive(e));

        if (activeEstabs.length === 0) {
          if (disabledIpressAlert) disabledIpressAlert.classList.remove("d-none");
          return { meses: {}, total_atc: 0, total_atd: 0, disabled: true };
        } else {
          if (disabledIpressAlert) disabledIpressAlert.classList.add("d-none");
        }

        const consMeses = {};
        CONFIG.MESES.forEach(m => {
          consMeses[m.key] = {
            atc: activeEstabs.reduce((acc, e) => acc + (porEst[e]?.meses?.[m.key]?.atc || 0), 0),
            atd: activeEstabs.reduce((acc, e) => acc + (porEst[e]?.meses?.[m.key]?.atd || 0), 0)
          };
        });

        return {
          meses: consMeses,
          total_atc: activeEstabs.reduce((acc, e) => acc + (porEst[e]?.total_atc || 0), 0),
          total_atd: activeEstabs.reduce((acc, e) => acc + (porEst[e]?.total_atd || 0), 0)
        };
      }

      if (!isIpressActive(currentUser.establecimiento)) {
        if (disabledIpressAlert) disabledIpressAlert.classList.remove("d-none");
        return { meses: {}, total_atc: 0, total_atd: 0, disabled: true };
      }
      if (disabledIpressAlert) disabledIpressAlert.classList.add("d-none");
      return userAtdData.consolidado || userAtdData;
    }

    // IPRESS individual seleccionada
    if (!isIpressActive(selectedEstab)) {
      if (disabledIpressAlert) disabledIpressAlert.classList.remove("d-none");
      return { meses: {}, total_atc: 0, total_atd: 0, disabled: true };
    }
    if (disabledIpressAlert) disabledIpressAlert.classList.add("d-none");
    return userAtdData.por_establecimiento[selectedEstab] || null;
  }

  function getActiveAppDataset() {
    if (!userAppData) return null;

    if (selectedEstab === "ALL" || !userAppData.por_establecimiento) {
      const porEst = userAppData.por_establecimiento || {};
      const estabNames = Object.keys(porEst);

      if (estabNames.length > 0) {
        const activeEstabs = estabNames.filter(e => isIpressActive(e));
        if (activeEstabs.length === 0) {
          return { meses: {}, total: 0, disabled: true };
        }
        const consMeses = {};
        CONFIG.MESES.forEach(m => {
          consMeses[m.key] = activeEstabs.reduce((acc, e) => acc + (porEst[e]?.meses?.[m.key] || 0), 0);
        });
        return {
          meses: consMeses,
          total: activeEstabs.reduce((acc, e) => acc + (porEst[e]?.total || 0), 0)
        };
      }

      if (!isIpressActive(currentUser.establecimiento)) {
        return { meses: {}, total: 0, disabled: true };
      }
      return userAppData.consolidado || userAppData;
    }

    if (!isIpressActive(selectedEstab)) {
      return { meses: {}, total: 0, disabled: true };
    }
    return userAppData.por_establecimiento[selectedEstab] || null;
  }

  // Renderizar Selector de Meses
  function renderMonthSelector() {
    monthSelectorContainer.innerHTML = "";
    CONFIG.MESES.forEach((m) => {
      const isChecked = selectedMonths.includes(m.key);
      const chip = document.createElement("div");
      chip.className = "month-chip";
      chip.innerHTML = `
        <input type="checkbox" id="month_${m.key}" value="${m.key}" ${isChecked ? "checked" : ""}>
        <label for="month_${m.key}">${m.key}</label>
      `;
      monthSelectorContainer.appendChild(chip);

      chip.querySelector("input").addEventListener("change", (e) => {
        const val = e.target.value;
        if (e.target.checked) {
          if (!selectedMonths.includes(val)) selectedMonths.push(val);
        } else {
          selectedMonths = selectedMonths.filter(x => x !== val);
        }
        onSelectionChange();
      });
    });
  }

  function updateDailyControlState() {
    if (!toggleDailyReport) return;
    if (selectedMonths.length === 1) {
      const mKey = selectedMonths[0];
      const monthObj = CONFIG.MESES.find(m => m.key === mKey) || { label: mKey };
      const hasDailyData = userDailyData && userDailyData[mKey] && userDailyData[mKey].dias;

      toggleDailyReport.disabled = false;
      // Activación automática cuando se selecciona un único mes
      toggleDailyReport.checked = true;
      isDailyModeActive = true;

      if (hasDailyData) {
        if (dailyAvailabilityBadge) {
          dailyAvailabilityBadge.className = "badge bg-success-subtle text-success small";
          dailyAvailabilityBadge.textContent = `Disponible para ${mKey}`;
        }
        if (dailyReportHelpText) {
          dailyReportHelpText.innerHTML = `<i class="bi bi-check-circle-fill text-success me-1"></i> Desglose día por día activado automáticamente para <strong>${monthObj.label}</strong>.`;
        }
      } else {
        if (dailyAvailabilityBadge) {
          dailyAvailabilityBadge.className = "badge bg-secondary-subtle text-secondary small";
          dailyAvailabilityBadge.textContent = `Consolidado ${mKey}`;
        }
        if (dailyReportHelpText) {
          dailyReportHelpText.innerHTML = `<i class="bi bi-info-circle me-1"></i> Para ${monthObj.label} los registros están en formato consolidado mensual.`;
        }
      }
    } else {
      toggleDailyReport.checked = false;
      toggleDailyReport.disabled = true;
      isDailyModeActive = false;
      if (dailyAvailabilityBadge) {
        dailyAvailabilityBadge.className = "badge bg-secondary-subtle text-secondary small";
        dailyAvailabilityBadge.textContent = "Selecciona 1 mes";
      }
      if (dailyReportHelpText) {
        dailyReportHelpText.innerHTML = `<i class="bi bi-info-circle me-1"></i> Disponible al seleccionar un único mes para ver su producción detallada día por día.`;
      }
      if (dailyDetailSection) dailyDetailSection.classList.add("d-none");
    }
  }

  function updateDailyView() {
    if (!dailyDetailSection) return;
    if (!isDailyModeActive || selectedMonths.length !== 1) {
      dailyDetailSection.classList.add("d-none");
      return;
    }

    const mKey = selectedMonths[0];
    const monthObj = CONFIG.MESES.find(m => m.key === mKey) || { label: mKey };
    if (dailySectionTitle) {
      dailySectionTitle.textContent = `Desglose Diario de Producción — Mes: ${monthObj.label.toUpperCase()} ${CONFIG.ANIO}`;
    }

    const activeAtd = getActiveAtdDataset();
    if (activeAtd && activeAtd.disabled) {
      if (dailyTableBody) {
        dailyTableBody.innerHTML = `
          <tr>
            <td colspan="4" class="text-center text-danger py-4">
              <i class="bi bi-shield-lock-fill fs-3 d-block mb-2 text-warning"></i>
              <strong class="text-danger">Producción Diaria Restringida</strong><br>
              <span class="small text-muted">El establecimiento se encuentra temporalmente bloqueado por auditoría y conciliación. Comuníquese con la Administración.</span>
            </td>
          </tr>
        `;
      }
      if (dailyTotalATC) dailyTotalATC.textContent = "0";
      if (dailyTotalATD) dailyTotalATD.textContent = "0";
      if (dailyDaysActiveText) dailyDaysActiveText.textContent = "0 días laborados";
      if (dailyTotalBadge) dailyTotalBadge.textContent = "0 días con actividad";
      dailyDetailSection.classList.remove("d-none");
      return;
    }

    const monthData = userDailyData && userDailyData[mKey];
    if (dailyTableBody) dailyTableBody.innerHTML = "";

    if (!monthData || !monthData.dias) {
      if (dailyTableBody) {
        dailyTableBody.innerHTML = `
          <tr>
            <td colspan="4" class="text-center text-muted py-4">
              <i class="bi bi-info-circle fs-4 d-block mb-2"></i>
              No se encontraron registros de producción día a día para <strong>${monthObj.label}</strong> en la base de datos.<br>
              <span class="small">Este mes se encuentra consolidado a nivel mensual en las tablas inferiores.</span>
            </td>
          </tr>
        `;
      }
      if (dailyTotalATC) dailyTotalATC.textContent = "0";
      if (dailyTotalATD) dailyTotalATD.textContent = "0";
      if (dailyDaysActiveText) dailyDaysActiveText.textContent = "0 días laborados";
      if (dailyTotalBadge) dailyTotalBadge.textContent = "0 días con actividad";
      dailyDetailSection.classList.remove("d-none");
      return;
    }

    const dias = monthData.dias;
    let daysWithActivity = 0;
    let sumATC = 0;
    let sumATD = 0;

    const maxATC = Math.max(...Object.values(dias).map(d => Number(d.atc) || 0), 1);

    for (let d = 1; d <= 31; d++) {
      const dTag = (d < 10 ? "0" : "") + d;
      const dInfo = dias[dTag] || { atc: 0, atd: 0 };
      const atc = Number(dInfo.atc) || 0;
      const atd = Number(dInfo.atd) || 0;
      const hasActivity = atc > 0 || atd > 0;

      if (hasActivity) {
        daysWithActivity++;
        sumATC += atc;
        sumATD += atd;
      }

      const citas = Number(dInfo.citas) || 0;
      const triajes = Number(dInfo.triajes) || 0;
      const hisAtc = Math.max(0, atc - citas - triajes);

      let detailBadges = [];
      if (hisAtc > 0) {
        detailBadges.push(`<span class="badge bg-primary-subtle text-primary border border-primary-subtle me-1" title="Atenciones médicas / asistenciales del sistema HIS">${hisAtc} HIS</span>`);
      }
      if (triajes > 0) {
        detailBadges.push(`<span class="badge bg-success-subtle text-success border border-success-subtle me-1" title="Triajes de enfermería registrados en SIHCE">${triajes} triajes</span>`);
      }
      if (citas > 0) {
        detailBadges.push(`<span class="badge bg-info-subtle text-info border border-info-subtle me-1" title="Citas reservadas registradas en SIHCE Admisión">${citas} citas</span>`);
      }

      let detailLabel = "";
      if (detailBadges.length > 0) {
        detailLabel = detailBadges.join("");
      } else if (hasActivity) {
        detailLabel = `<span class="text-muted small">${atc} pac.</span>`;
      } else {
        detailLabel = `<span class="text-muted opacity-50 small">Sin activ.</span>`;
      }

      const percent = Math.min(100, Math.round((atc / maxATC) * 100));

      const tr = document.createElement("tr");
      if (hasActivity) {
        tr.style.backgroundColor = "rgba(59, 130, 246, 0.04)";
      }

      tr.innerHTML = `
        <td class="text-center">
          <span class="daily-day-badge ${hasActivity ? 'daily-day-active' : ''}">${dTag}</span>
        </td>
        <td class="text-center fw-bold ${atc > 0 ? 'text-primary' : 'text-muted'}">${atc > 0 ? atc.toLocaleString() : '-'}</td>
        <td class="text-center fw-bold ${atd > 0 ? 'text-success' : 'text-muted'}">${atd > 0 ? atd.toLocaleString() : '-'}</td>
        <td>
          <div class="d-flex align-items-center gap-2">
            <div class="daily-bar-container flex-grow-1">
              <div class="daily-bar-fill" style="width: ${percent}%;"></div>
            </div>
            <span class="small d-flex flex-wrap align-items-center" style="min-width: 140px;">
              ${detailLabel}
            </span>
          </div>
        </td>
      `;
      if (dailyTableBody) dailyTableBody.appendChild(tr);
    }

    let sumTriajesMonth = 0;
    let sumCitasMonth = 0;
    Object.values(dias).forEach(d => {
      sumTriajesMonth += Number(d.triajes) || 0;
      sumCitasMonth += Number(d.citas) || 0;
    });
    const finalMonthAtc = monthData.total_atc || sumATC;
    const sumHisMonth = Math.max(0, finalMonthAtc - sumTriajesMonth - sumCitasMonth);

    let pillsSummary = [];
    if (sumHisMonth > 0) {
      pillsSummary.push(`<span class="badge bg-primary-subtle text-primary border border-primary-subtle">${sumHisMonth.toLocaleString()} HIS</span>`);
    }
    if (sumTriajesMonth > 0) {
      pillsSummary.push(`<span class="badge bg-success-subtle text-success border border-success-subtle">${sumTriajesMonth.toLocaleString()} Triajes Enf.</span>`);
    }
    if (sumCitasMonth > 0) {
      pillsSummary.push(`<span class="badge bg-info-subtle text-info border border-info-subtle">${sumCitasMonth.toLocaleString()} Citas Admisión</span>`);
    }

    if (dailyTotalATC) dailyTotalATC.textContent = finalMonthAtc.toLocaleString();
    if (dailyTotalATD) dailyTotalATD.textContent = (monthData.total_atd || sumATD).toLocaleString();
    if (dailyDaysActiveText) {
      if (pillsSummary.length > 1) {
        dailyDaysActiveText.innerHTML = `<span class="me-2">${daysWithActivity} de 31 días con actividad</span> <span class="d-inline-flex flex-wrap gap-1 align-items-center">(${pillsSummary.join(" + ")})</span>`;
      } else {
        dailyDaysActiveText.textContent = `${daysWithActivity} de 31 días con actividad asistencial`;
      }
    }
    if (dailyTotalBadge) dailyTotalBadge.textContent = `${daysWithActivity} días con actividad`;

    dailyDetailSection.classList.remove("d-none");
  }

  if (toggleDailyReport) {
    toggleDailyReport.addEventListener("change", (e) => {
      isDailyModeActive = e.target.checked;
      updateDailyView();
      const activeAtd = getActiveAtdDataset();
      renderOrUpdateChart(activeAtd);
    });
  }

  function onSelectionChange() {
    selectedCountBadge.textContent = `${selectedMonths.length} seleccionados`;
    updateDailyControlState();
    updateTablesAndKPIs();
    updateDailyView();
  }

  selectAllMonthsBtn.addEventListener("click", () => {
    selectedMonths = CONFIG.MESES.map(m => m.key);
    monthSelectorContainer.querySelectorAll("input[type='checkbox']").forEach(i => i.checked = true);
    onSelectionChange();
  });

  clearMonthsBtn.addEventListener("click", () => {
    selectedMonths = [];
    monthSelectorContainer.querySelectorAll("input[type='checkbox']").forEach(i => i.checked = false);
    onSelectionChange();
  });

  // Configurar Selector de Establecimientos (si prestó labores en más de 1 IPRESS)
  function setupEstablishmentSelector() {
    const estabs = userAtdData ? (userAtdData.establecimientos || []) : [];
    
    if (estabs.length > 1) {
      estabSelectorCard.classList.remove("d-none");
      multiEstabBadge.classList.remove("d-none");
      multiEstabCount.textContent = `${estabs.length} IPRESS`;

      estabSelect.innerHTML = "";
      
      // Opción 1: Consolidado General (Suma de las IPRESS activas)
      const porEst = userAtdData.por_establecimiento || {};
      const activeTotal = Object.keys(porEst)
        .filter(e => isIpressActive(e))
        .reduce((acc, e) => acc + (porEst[e]?.total_atc || 0), 0);

      const optAll = document.createElement("option");
      optAll.value = "ALL";
      optAll.textContent = `🌟 Todos los Establecimientos (Consolidado Activo: ${activeTotal.toLocaleString()} Atenciones)`;
      estabSelect.appendChild(optAll);

      // Opciones por cada establecimiento ordenadas de mayor a menor producción
      const sortedEstabs = [...estabs].sort((a, b) => {
        const prodA = (porEst[a] && porEst[a].total_atc) || 0;
        const prodB = (porEst[b] && porEst[b].total_atc) || 0;
        return prodB - prodA;
      });

      sortedEstabs.forEach((est) => {
        const prod = (porEst[est] && porEst[est].total_atc) || 0;
        const opt = document.createElement("option");
        opt.value = est;
        const active = isIpressActive(est);
        opt.textContent = active 
          ? `${est} (${prod.toLocaleString()} Atenciones)`
          : `🔒 ${est} [EN AUDITORÍA / BLOQUEADO]`;
        if (!active) {
          opt.style.color = "#ef4444";
        }
        estabSelect.appendChild(opt);
      });

      // Evento de cambio de establecimiento
      estabSelect.addEventListener("change", (e) => {
        selectedEstab = e.target.value;
        if (selectedEstab === "ALL") {
          userEstabDisplay.textContent = `${userAtdData.establecimiento_principal || "Principal"} (Consolidado Red)`;
        } else {
          userEstabDisplay.textContent = selectedEstab;
        }
        updateTablesAndKPIs();
      });
    } else {
      estabSelectorCard.classList.add("d-none");
      multiEstabBadge.classList.add("d-none");
    }
  }

  // Actualizar tablas y tarjetas KPI
  function updateTablesAndKPIs() {
    const activeAtd = getActiveAtdDataset();
    const activeApp = getActiveAppDataset();

    let totalATC = 0;
    let totalATD = 0;
    let totalAPP = 0;

    let sumPeriodTriajes = 0;
    let sumPeriodCitas = 0;
    let sumPeriodHis = 0;

    selectedMonths.forEach(mKey => {
      const mDaily = userDailyData && userDailyData[mKey];
      if (mDaily) {
        sumPeriodTriajes += Number(mDaily.total_triajes) || 0;
        sumPeriodCitas += Number(mDaily.total_citas) || 0;
      }
    });
    const hasAnySihce = (sumPeriodTriajes > 0 || sumPeriodCitas > 0);

    // Si el establecimiento seleccionado (o consolidado) está bloqueado por auditoría
    if (activeAtd && activeAtd.disabled) {
      const colSpan = hasAnySihce ? 6 : 3;
      atdTableBody.innerHTML = `
        <tr>
          <td colspan="${colSpan}" class="text-center text-danger py-4">
            <i class="bi bi-shield-lock-fill fs-3 d-block mb-2 text-warning"></i>
            <strong class="text-danger">Establecimiento Bloqueado por Auditoría</strong><br>
            <span class="small text-muted">La producción de este establecimiento se encuentra temporalmente en proceso de conciliación y validación por la administración.</span>
          </td>
        </tr>
      `;
      if (atdTableFoot) {
        atdTableFoot.innerHTML = `
          <tr>
            <td>Total Seleccionado</td>
            ${hasAnySihce ? '<td class="text-center">0</td><td class="text-center">0</td><td class="text-center">0</td>' : ''}
            <td class="text-center">0</td>
            <td class="text-center">0</td>
          </tr>
        `;
      }
      appTableBody.innerHTML = `
        <tr>
          <td colspan="2" class="text-center text-danger py-3">
            <i class="bi bi-shield-lock-fill me-1 text-warning"></i>
            Producción de APP Bloqueada por Auditoría
          </td>
        </tr>
      `;
      if (appTableTotal) appTableTotal.textContent = "0";
      kpiATC.textContent = "0";
      kpiATD.textContent = "0";
      kpiAPP.textContent = "0";
      renderOrUpdateChart(activeAtd);
      updateDailyView();
      return;
    }

    // 1. Tabla ATD / ATC
    atdTableBody.innerHTML = "";
    if (atdTableHead) {
      if (hasAnySihce) {
        atdTableHead.innerHTML = `
          <tr>
            <th>Mes</th>
            <th class="text-center"><span class="badge bg-primary-subtle text-primary border border-primary-subtle">Atenciones HIS</span></th>
            <th class="text-center"><span class="badge bg-success-subtle text-success border border-success-subtle">Triajes (SIHCE)</span></th>
            <th class="text-center"><span class="badge bg-info-subtle text-info border border-info-subtle">Citas Adm. (SIHCE)</span></th>
            <th class="text-center">Total ATC</th>
            <th class="text-center">Atendidos (ATD)</th>
          </tr>
        `;
      } else {
        atdTableHead.innerHTML = `
          <tr>
            <th>Mes</th>
            <th class="text-center">Atenciones (ATC)</th>
            <th class="text-center">Atendidos (ATD)</th>
          </tr>
        `;
      }
    }

    if (selectedMonths.length === 0) {
      const colSpan = hasAnySihce ? 6 : 3;
      atdTableBody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center text-muted py-3">Selecciona al menos un mes</td></tr>`;
      if (atdTableFoot) {
        if (hasAnySihce) {
          atdTableFoot.innerHTML = `
            <tr>
              <td>Total Seleccionado</td>
              <td class="text-center">0</td>
              <td class="text-center">0</td>
              <td class="text-center">0</td>
              <td class="text-center">0</td>
              <td class="text-center">0</td>
            </tr>
          `;
        } else {
          atdTableFoot.innerHTML = `
            <tr>
              <td>Total Seleccionado</td>
              <td id="atdTableTotalATC" class="text-center">0</td>
              <td id="atdTableTotalATD" class="text-center">0</td>
            </tr>
          `;
        }
      }
    } else {
      selectedMonths.forEach((mKey) => {
        const monthObj = CONFIG.MESES.find(m => m.key === mKey) || { label: mKey };
        const mData = (activeAtd && activeAtd.meses && activeAtd.meses[mKey]) || { atc: 0, atd: 0 };
        const atc = Number(mData.atc) || 0;
        const atd = Number(mData.atd) || 0;
        totalATC += atc;
        totalATD += atd;

        const tr = document.createElement("tr");
        if (hasAnySihce) {
          const mDaily = userDailyData && userDailyData[mKey];
          const mTriajes = mDaily ? (Number(mDaily.total_triajes) || 0) : 0;
          const mCitas = mDaily ? (Number(mDaily.total_citas) || 0) : 0;
          const mHis = Math.max(0, atc - mTriajes - mCitas);
          sumPeriodHis += mHis;

          tr.innerHTML = `
            <td><strong>${monthObj.label}</strong></td>
            <td class="text-center fw-semibold text-primary">${mHis > 0 ? mHis.toLocaleString() : '-'}</td>
            <td class="text-center fw-semibold text-success">${mTriajes > 0 ? mTriajes.toLocaleString() : '-'}</td>
            <td class="text-center fw-semibold text-info">${mCitas > 0 ? mCitas.toLocaleString() : '-'}</td>
            <td class="text-center fw-bold text-main">${atc.toLocaleString()}</td>
            <td class="text-center fw-semibold text-main">${atd.toLocaleString()}</td>
          `;
        } else {
          tr.innerHTML = `
            <td><strong>${monthObj.label}</strong></td>
            <td class="text-center fw-semibold text-main">${atc.toLocaleString()}</td>
            <td class="text-center fw-semibold text-main">${atd.toLocaleString()}</td>
          `;
        }
        atdTableBody.appendChild(tr);
      });

      if (atdTableFoot) {
        if (hasAnySihce) {
          atdTableFoot.innerHTML = `
            <tr>
              <td><strong>Total Seleccionado</strong></td>
              <td class="text-center fw-bold text-primary">${sumPeriodHis.toLocaleString()}</td>
              <td class="text-center fw-bold text-success">${sumPeriodTriajes.toLocaleString()}</td>
              <td class="text-center fw-bold text-info">${sumPeriodCitas.toLocaleString()}</td>
              <td class="text-center fw-bold text-main">${totalATC.toLocaleString()}</td>
              <td class="text-center fw-bold text-main">${totalATD.toLocaleString()}</td>
            </tr>
          `;
        } else {
          atdTableFoot.innerHTML = `
            <tr>
              <td>Total Seleccionado</td>
              <td id="atdTableTotalATC" class="text-center">${totalATC.toLocaleString()}</td>
              <td id="atdTableTotalATD" class="text-center">${totalATD.toLocaleString()}</td>
            </tr>
          `;
        }
      }
    }

    // 2. Tabla APP
    appTableBody.innerHTML = "";
    if (selectedMonths.length === 0) {
      appTableBody.innerHTML = `<tr><td colspan="2" class="text-center text-muted py-3">Selecciona al menos un mes</td></tr>`;
      appTableTotal.textContent = "0";
    } else {
      selectedMonths.forEach((mKey) => {
        const monthObj = CONFIG.MESES.find(m => m.key === mKey) || { label: mKey };
        const appVal = (activeApp && activeApp.meses && Number(activeApp.meses[mKey])) || 0;
        totalAPP += appVal;

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>${monthObj.label}</strong></td>
          <td class="text-center fw-semibold text-main">${appVal.toLocaleString()}</td>
        `;
        appTableBody.appendChild(tr);
      });

      appTableTotal.textContent = totalAPP.toLocaleString();
    }

    // 3. Actualizar KPIs
    kpiATC.textContent = totalATC.toLocaleString();
    kpiATD.textContent = totalATD.toLocaleString();
    kpiAPP.textContent = totalAPP.toLocaleString();

    // 4. Actualizar Gráfico Chart.js
    renderOrUpdateChart(activeAtd);
  }

  // Gráfico Interactivo Chart.js
  let productionChart = null;
  function renderOrUpdateChart(activeAtd) {
    const canvas = document.getElementById("productionChart");
    if (!canvas || typeof Chart === "undefined") return;

    if (activeAtd && activeAtd.disabled) {
      if (productionChart) {
        productionChart.destroy();
        productionChart = null;
      }
      return;
    }

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";
    const textColor = isDark ? "#94a3b8" : "#64748b";

    let labels = [];
    let atcData = [];
    let atdData = [];

    // Modo Diario si está activo para 1 mes
    if (isDailyModeActive && selectedMonths.length === 1) {
      const mKey = selectedMonths[0];
      const mDaily = userDailyData && userDailyData[mKey];
      if (mDaily && mDaily.dias) {
        for (let d = 1; d <= 31; d++) {
          const dTag = (d < 10 ? "0" : "") + d;
          labels.push(`D${dTag}`);
          atcData.push(mDaily.dias[dTag]?.atc || 0);
          atdData.push(mDaily.dias[dTag]?.atd || 0);
        }
      }
    }

    // Modo Mensual Estándar
    if (labels.length === 0) {
      selectedMonths.forEach((mKey) => {
        const monthObj = CONFIG.MESES.find(m => m.key === mKey) || { label: mKey };
        labels.push(monthObj.label);
        const mData = (activeAtd && activeAtd.meses && activeAtd.meses[mKey]) || { atc: 0, atd: 0 };
        atcData.push(Number(mData.atc) || 0);
        atdData.push(Number(mData.atd) || 0);
      });
    }

    if (productionChart) {
      productionChart.data.labels = labels;
      productionChart.data.datasets[0].data = atcData;
      productionChart.data.datasets[1].data = atdData;
      productionChart.data.datasets[0].label = isDailyModeActive ? "Atenciones Diarias (ATC)" : "Atenciones (ATC)";
      productionChart.data.datasets[1].label = isDailyModeActive ? "Atendidos Diarios (ATD)" : "Atendidos (ATD)";
      if (productionChart.options.scales.x) {
        productionChart.options.scales.x.grid.color = gridColor;
        productionChart.options.scales.x.ticks.color = textColor;
      }
      if (productionChart.options.scales.y) {
        productionChart.options.scales.y.grid.color = gridColor;
        productionChart.options.scales.y.ticks.color = textColor;
      }
      productionChart.update();
      return;
    }

    productionChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Atenciones (ATC)",
            data: atcData,
            backgroundColor: "rgba(59, 130, 246, 0.85)",
            borderColor: "#3b82f6",
            borderWidth: 1.5,
            borderRadius: 6,
            maxBarThickness: 32
          },
          {
            label: "Atendidos (ATD)",
            data: atdData,
            backgroundColor: "rgba(16, 185, 129, 0.85)",
            borderColor: "#10b981",
            borderWidth: 1.5,
            borderRadius: 6,
            maxBarThickness: 32
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            padding: 10,
            cornerRadius: 8,
            titleFont: { size: 13, weight: "bold" },
            bodyFont: { size: 12 }
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { weight: 600 } }
          },
          y: {
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: { color: textColor, font: { weight: 600 } }
          }
        }
      }
    });
  }

  // Renderizar Banner de Comunicado Institucional
  function renderComunicadoBanner() {
    const banner = document.getElementById("bannerComunicado");
    const tit = document.getElementById("comunicadoTitulo");
    const txt = document.getElementById("comunicadoTexto");
    if (!banner) return;

    let com = null;
    const localSaved = localStorage.getItem("comunicado_reporte40");
    if (localSaved) {
      try {
        com = JSON.parse(localSaved);
      } catch (e) {
        console.warn("Error leyendo comunicado en localStorage:", e);
      }
    }
    if (!com && window.DEMO_DATA && window.DEMO_DATA.comunicado) {
      com = window.DEMO_DATA.comunicado;
    }

    if (com && com.activo && (com.titulo || com.mensaje)) {
      tit.textContent = com.titulo || "Aviso Oficial";
      txt.textContent = com.mensaje || "";
      banner.classList.remove("d-none");
    } else {
      banner.classList.add("d-none");
    }
  }

  // Observar cambio de tema para adaptar colores del gráfico
  const themeObserver = new MutationObserver(() => {
    if (productionChart) {
      const activeAtd = getActiveAtdDataset();
      renderOrUpdateChart(activeAtd);
    }
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // Funciones de fusión para producción SIHCE (Admisión y Triaje)
  function mergeDiarioWithSihce(baseDiario, localDaily) {
    if (!localDaily) return baseDiario;
    if (!baseDiario) return localDaily;

    const merged = JSON.parse(JSON.stringify(baseDiario));
    Object.keys(localDaily).forEach(mKey => {
      const lMonth = localDaily[mKey];
      if (!merged[mKey]) {
        merged[mKey] = JSON.parse(JSON.stringify(lMonth));
        return;
      }

      const mMonth = merged[mKey];
      mMonth.total_triajes = lMonth.total_triajes || 0;
      mMonth.total_citas = lMonth.total_citas || 0;

      if (lMonth.dias) {
        if (!mMonth.dias) mMonth.dias = {};
        let calcAtc = 0;
        let calcAtd = 0;

        for (let d = 1; d <= 31; d++) {
          const dStr = (d < 10 ? "0" : "") + d;
          const lDay = lMonth.dias[dStr] || { atc: 0, atd: 0, citas: 0, triajes: 0 };
          const mDay = mMonth.dias[dStr] || { atc: 0, atd: 0 };

          const cVal = Number(lDay.citas) || 0;
          const tVal = Number(lDay.triajes) || 0;
          const lAtc = Number(lDay.atc) || 0;
          const mAtc = Number(mDay.atc) || 0;
          const mAtd = Number(mDay.atd) || 0;
          const lAtd = Number(lDay.atd) || 0;

          let finalAtc = Math.max(mAtc, lAtc);
          if (cVal + tVal > 0 && finalAtc < (cVal + tVal)) {
            finalAtc = mAtc + cVal + tVal;
          }

          mMonth.dias[dStr] = {
            atc: finalAtc,
            atd: Math.max(mAtd, lAtd),
            citas: cVal,
            triajes: tVal
          };
          calcAtc += finalAtc;
          calcAtd += Math.max(mAtd, lAtd);
        }

        mMonth.total_atc = Math.max(calcAtc, Number(lMonth.total_atc) || 0);
        mMonth.total_atd = Math.max(calcAtd, Number(lMonth.total_atd) || 0);
      }
    });

    return merged;
  }

  function mergeAtdWithSihce(baseAtd, localAtd, dailyData) {
    if (!localAtd && !dailyData) return baseAtd;
    if (!baseAtd) return localAtd;

    const merged = JSON.parse(JSON.stringify(baseAtd));
    CONFIG.MESES.forEach(m => {
      const mKey = m.key;
      const dMonthAtc = dailyData?.[mKey]?.total_atc || 0;
      const lMonthAtc = localAtd?.consolidado?.meses?.[mKey]?.atc || 0;
      const targetAtc = Math.max(dMonthAtc, lMonthAtc);

      if (merged.consolidado?.meses?.[mKey]) {
        const curAtc = Number(merged.consolidado.meses[mKey].atc) || 0;
        if (targetAtc > curAtc) {
          merged.consolidado.meses[mKey].atc = targetAtc;
          const pEst = merged.establecimiento_principal;
          if (pEst && merged.por_establecimiento?.[pEst]?.meses?.[mKey]) {
            merged.por_establecimiento[pEst].meses[mKey].atc = targetAtc;
          }
        }
      }
    });

    if (merged.consolidado?.meses) {
      let sumTot = 0;
      CONFIG.MESES.forEach(m => {
        sumTot += Number(merged.consolidado.meses[m.key]?.atc) || 0;
      });
      merged.consolidado.total_atc = sumTot;

      const pEst = merged.establecimiento_principal;
      if (pEst && merged.por_establecimiento?.[pEst]) {
        merged.por_establecimiento[pEst].total_atc = sumTot;
      }
    }

    return merged;
  }

  // 2. Cargar datos del usuario desde la API con barra de progreso
  try {
    setSyncProgress(25, "Consultando base de datos oficial (Google Sheets / HIS)...");
    
    // Cargar datos locales de demo / respaldo / override primero
    const localDemo = await Api.loadDemoData();
    const localDailyMatch = Api.findInMapByDni(currentUser.dni, localDemo?.diario);
    const localAtdMatch = Api.findInMapByDni(currentUser.dni, localDemo?.atd_atc);
    const localAppMatch = Api.findInMapByDni(currentUser.dni, localDemo?.app);

    const localDaily = localDailyMatch?.data || null;
    const localAtd = localAtdMatch?.data || null;
    const localApp = localAppMatch?.data || null;

    setSyncProgress(55, "Sincronizando atenciones (ATC / ATD) y actividades (APP)...");
    let res = null;
    try {
      res = await Api.callAppsScript("getData", { dni: currentUser.dni });
    } catch (e) {
      console.warn("Apps Script no disponible o en modo local:", e);
    }

    if (res && res.success) {
      userDailyData = mergeDiarioWithSihce(res.diario, localDaily);
      userAtdData = mergeAtdWithSihce(res.atd_atc, localAtd, userDailyData);
      userAppData = res.app || localApp;

      // Si tiene establecimiento principal detectado
      if (userAtdData && userAtdData.establecimiento_principal) {
        currentUser.establecimiento = userAtdData.establecimiento_principal;
        userEstabDisplay.textContent = currentUser.establecimiento;
      }

      if (userAppData && userAppData.microred && !currentUser.microred) {
        currentUser.microred = userAppData.microred;
        userMicroRedDisplay.textContent = currentUser.microred;
      }
      Auth.setSession(currentUser);

      // Sincronizar control de disponibilidad de IPRESS recibido de la nube
      if (res.ipress_control && typeof res.ipress_control === "object") {
        try {
          localStorage.setItem("reporte40_ipress_control", JSON.stringify(res.ipress_control));
        } catch (e) {}
        if (window.DEMO_DATA) {
          window.DEMO_DATA.ipress_control = res.ipress_control;
        }
      }
    } else {
      userDailyData = localDaily;
      userAtdData = localAtd;
      userAppData = localApp;

      if (userAtdData && userAtdData.establecimiento_principal) {
        currentUser.establecimiento = userAtdData.establecimiento_principal;
        userEstabDisplay.textContent = currentUser.establecimiento;
      }
      if (userAppData && userAppData.microred && !currentUser.microred) {
        currentUser.microred = userAppData.microred;
        userMicroRedDisplay.textContent = currentUser.microred;
      }

      // Si falla getData o está en local, intentar obtener ipress_control
      try {
        const ctrlRes = await Api.callAppsScript("getIpressControl");
        if (ctrlRes && ctrlRes.success && ctrlRes.ipress_control && typeof ctrlRes.ipress_control === "object") {
          try {
            localStorage.setItem("reporte40_ipress_control", JSON.stringify(ctrlRes.ipress_control));
          } catch (e) {}
          if (window.DEMO_DATA) {
            window.DEMO_DATA.ipress_control = ctrlRes.ipress_control;
          }
        }
      } catch (e) {}
    }
  } catch (err) {
    console.error("Error al cargar datos:", err);
  } finally {
    finishSyncOverlay();
  }

  // Verificación de Contraseña por defecto (DNI)
  function checkDefaultPasswordAlert() {
    if (!urgentPasswordAlert) return;
    const hasCustomPass = localStorage.getItem("custom_pass_" + currentUser.dni);
    if (!hasCustomPass && currentUser.rol !== "admin") {
      urgentPasswordAlert.classList.remove("d-none");
    } else {
      urgentPasswordAlert.classList.add("d-none");
    }
  }

  // Inicializar componentes
  checkDefaultPasswordAlert();
  renderComunicadoBanner();
  setupEstablishmentSelector();
  renderMonthSelector();
  updateTablesAndKPIs();

  // 3. Descarga de PDF
  downloadPdfBtn.addEventListener("click", async () => {
    const activeAtd = getActiveAtdDataset();
    if (activeAtd && activeAtd.disabled) {
      alert("No es posible generar ni descargar el reporte en PDF: el establecimiento seleccionado se encuentra temporalmente bloqueado por auditoría de la administración.");
      return;
    }

    if (selectedMonths.length === 0) {
      alert("Por favor selecciona al menos un mes para generar tu reporte.");
      return;
    }

    downloadPdfBtn.disabled = true;
    downloadPdfBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Generando PDF...';

    const activeAtd = getActiveAtdDataset();
    const activeApp = getActiveAppDataset();

    try {
      // Registrar log de auditoría
      const estabLabel = selectedEstab === "ALL" ? "Consolidado Red Cusco Sur" : selectedEstab;
      const isDailySingleMonth = isDailyModeActive && selectedMonths.length === 1;
      const logTipo = isDailySingleMonth 
        ? (selectedEstab === "ALL" ? "PDF_DIARIO_CONSOLIDADO" : "PDF_DIARIO_IPRESS")
        : (selectedEstab === "ALL" ? "PDF_CONSOLIDADO" : "PDF_IPRESS");

      Api.callAppsScript("logDownload", {
        dni: currentUser.dni,
        personal: currentUser.nombre,
        establecimiento: estabLabel,
        meses: selectedMonths.join(",") + (isDailySingleMonth ? " (Desglose Diario)" : ""),
        tipo: logTipo
      });

      // Generar PDF Profesional con opción de desglose diario
      await PdfGenerator.generate(
        currentUser,
        selectedMonths,
        activeAtd,
        activeApp,
        userAtdData,
        selectedEstab,
        userDailyData,
        isDailySingleMonth
      );
    } catch (err) {
      alert("Hubo un inconveniente al generar el PDF: " + err.message);
    } finally {
      downloadPdfBtn.disabled = false;
      downloadPdfBtn.innerHTML = '<i class="bi bi-file-earmark-pdf-fill"></i> Descargar Reporte en PDF';
    }
  });

  // 4. Formulario de Cambio de Contraseña
  const changePasswordForm = document.getElementById("changePasswordForm");
  const changePassAlert = document.getElementById("changePassAlert");
  const currentPassInput = document.getElementById("currentPassInput");
  const newPassInput = document.getElementById("newPassInput");
  const confirmPassInput = document.getElementById("confirmPassInput");
  const savePasswordBtn = document.getElementById("savePasswordBtn");

  changePasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const currentPass = currentPassInput.value.trim();
    const newPass = newPassInput.value.trim();
    const confirmPass = confirmPassInput.value.trim();

    changePassAlert.className = "alert d-none";

    if (newPass !== confirmPass) {
      changePassAlert.className = "alert alert-danger py-2 px-3 small";
      changePassAlert.textContent = "La confirmación de la contraseña no coincide.";
      return;
    }

    savePasswordBtn.disabled = true;
    savePasswordBtn.textContent = "Guardando...";

    try {
      const res = await Api.callAppsScript("changePassword", {
        dni: currentUser.dni,
        oldPassword: currentPass,
        newPassword: newPass
      });

      if (res.success) {
        changePassAlert.className = "alert alert-success py-2 px-3 small";
        changePassAlert.textContent = res.message || "¡Contraseña actualizada exitosamente!";
        
        // Ocultar de inmediato el banner de advertencia urgente
        if (urgentPasswordAlert) urgentPasswordAlert.classList.add("d-none");

        setTimeout(() => {
          const modalEl = document.getElementById("changePasswordModal");
          const modal = bootstrap.Modal.getInstance(modalEl);
          if (modal) modal.hide();
          changePasswordForm.reset();
          changePassAlert.className = "alert d-none";
        }, 1200);
      } else {
        changePassAlert.className = "alert alert-danger py-2 px-3 small";
        changePassAlert.textContent = res.message || "Error al cambiar la contraseña.";
      }
    } catch (err) {
      changePassAlert.className = "alert alert-danger py-2 px-3 small";
      changePassAlert.textContent = "Error al procesar la solicitud.";
    } finally {
      savePasswordBtn.disabled = false;
      savePasswordBtn.textContent = "Guardar Nueva Contraseña";
    }
  });
});
