/**
 * =====================================================================
 * CONTROLADOR DEL DASHBOARD (PERSONAL DE SALUD)
 * Soporta Consolidado Multi-Establecimiento y Filtro por IPRESS
 * Hecho por xzerox99
 * =====================================================================
 */

async function initDashboard() {
  // 0. Funciones de barra de progreso de vinculación inicial
  const syncOverlay = document.getElementById("syncDatabaseOverlay");
  const syncProgressBar = document.getElementById("syncProgressBar");
  const syncPercentText = document.getElementById("syncPercentText");
  const syncStepText = document.getElementById("syncStepText");
  const syncSubDetailText = document.getElementById("syncSubDetailText");
  const syncTitle = document.getElementById("syncTitle");
  const syncIconContainer = document.getElementById("syncIconContainer");
  const syncHeroVisual = document.getElementById("syncHeroVisual");

  let isOverlayClosed = false;
  let safetyOverlayTimer = null;

  function setSyncProgress(percent, stepMessage, title = null, subDetail = null) {
    if (syncProgressBar) syncProgressBar.style.width = percent + "%";
    if (syncPercentText) syncPercentText.textContent = percent + "%";
    if (syncStepText && stepMessage) syncStepText.textContent = stepMessage;
    if (syncTitle && title) syncTitle.textContent = title;
    if (syncSubDetailText && subDetail) syncSubDetailText.innerHTML = subDetail;
  }

  function finishSyncOverlay(success = true, finalMessage = "¡Información generada exitosamente!") {
    if (isOverlayClosed) return;
    isOverlayClosed = true;
    if (safetyOverlayTimer) clearTimeout(safetyOverlayTimer);

    setSyncProgress(
      100,
      finalMessage,
      "¡Panel Sincronizado!",
      '<i class="bi bi-check-all text-success me-1"></i> Todos los registros listos para consulta y descarga de PDF'
    );

    if (syncHeroVisual) {
      syncHeroVisual.style.transform = "scale(1.05)";
      syncHeroVisual.style.transition = "transform 0.4s ease";
    }

    setTimeout(() => {
      if (syncOverlay) {
        syncOverlay.classList.add("fade-out");
        setTimeout(() => syncOverlay.remove(), 450);
      }
    }, 600);
  }

  // Seguro de tiempo máximo prudencial: 15 segundos si la red está lenta, para no bloquear al usuario
  safetyOverlayTimer = setTimeout(() => {
    finishSyncOverlay(true, "¡Información lista para visualización!");
  }, 15000);

  setSyncProgress(
    15,
    "Validando credenciales y perfil asistencial...",
    "Vinculando con Base de Datos",
    '<i class="bi bi-key-fill text-primary me-1"></i> Verificación de sesión de usuario'
  );

  // 1. Validar autenticación
  if (!Auth.requireAuth()) {
    finishSyncOverlay(false);
    return;
  }

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
        <span><i class="bi bi-eye-fill me-2 text-primary fs-5"></i> MODO SIMULACIÓN AUDITOR: Visualizando producción de <u>${Utils.escapeHtml(targetUser.nombre)}</u> (DNI: ${Utils.escapeHtml(impersonateDni)})</span>
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
  let selectedYear = CONFIG.ANIO || "2026";

  // Control de Años Habilitados (Multi-Anual)
  function getEnabledYears() {
    try {
      const saved = localStorage.getItem("reporte40_anios_habilitados");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    if (window.DEMO_DATA && Array.isArray(window.DEMO_DATA.anios_habilitados) && window.DEMO_DATA.anios_habilitados.length > 0) {
      return window.DEMO_DATA.anios_habilitados;
    }
    return [CONFIG.ANIO || "2026"];
  }

  function setupYearSelector() {
    const yearCard = document.getElementById("yearSelectorCard");
    const yearGroup = document.getElementById("yearButtonsGroup");
    if (!yearCard || !yearGroup) return;

    const enabledYears = getEnabledYears();
    if (!enabledYears.includes(selectedYear)) {
      selectedYear = enabledYears[0] || CONFIG.ANIO || "2026";
    }

    if (enabledYears.length <= 1) {
      yearCard.classList.add("d-none");
      return;
    }

    yearCard.classList.remove("d-none");
    yearGroup.innerHTML = "";

    enabledYears.forEach((yr) => {
      const btn = document.createElement("button");
      btn.type = "button";
      const isActive = String(yr) === String(selectedYear);
      btn.className = `btn btn-sm ${isActive ? "btn-primary fw-bold shadow-sm" : "btn-outline-secondary"}`;
      btn.innerHTML = `<i class="bi bi-calendar-check me-1"></i> ${yr}`;
      btn.onclick = () => {
        if (selectedYear === String(yr)) return;
        selectedYear = String(yr);
        setupYearSelector();
        updateTablesAndKPIs();
        if (isDailyModeActive) {
          updateDailyView();
        }
      };
      yearGroup.appendChild(btn);
    });
  }

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
  const previewPdfBtn = document.getElementById("previewPdfBtn");

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

  // Estado de filtro y ordenamiento en tabla diaria
  let dailyFilterMode = "all"; // 'all' | 'active' | 'sihce'
  let dailySortKey = "day";    // 'day' | 'atc' | 'atd'
  let dailySortDir = "asc";    // 'asc' | 'desc'

  // Helper de Contador en Vivo (Count-Up) para KPIs
  const counterAnimations = new WeakMap();
  function animateCounter(el, targetValue, duration = 520) {
    if (!el) return;
    const target = Math.max(0, Math.round(Number(targetValue) || 0));
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const startVal = Number(el.dataset.currentVal || 0);

    if (reduced || startVal === target) {
      el.dataset.currentVal = String(target);
      el.textContent = target.toLocaleString();
      return;
    }

    if (counterAnimations.has(el)) {
      cancelAnimationFrame(counterAnimations.get(el));
    }

    const startTime = performance.now();
    function step(now) {
      const elapsed = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - elapsed, 3); // easeOutCubic
      const current = Math.round(startVal + (target - startVal) * eased);
      el.textContent = current.toLocaleString();
      if (elapsed < 1) {
        const rafId = requestAnimationFrame(step);
        counterAnimations.set(el, rafId);
      } else {
        el.dataset.currentVal = String(target);
        el.textContent = target.toLocaleString();
        counterAnimations.delete(el);
      }
    }
    const rafId = requestAnimationFrame(step);
    counterAnimations.set(el, rafId);
  }

  // Mostrar datos del usuario en la interfaz
  navUserName.textContent = currentUser.nombre ? currentUser.nombre.split(" ")[0] : "Personal";
  userNameDisplay.textContent = currentUser.nombre || "Personal de Salud";
  const userAvatarBadge = document.getElementById("userAvatarBadge");
  const userGreetingBadge = document.getElementById("userGreetingBadge");
  if (userAvatarBadge && typeof Utils.getInitials === "function") {
    userAvatarBadge.textContent = Utils.getInitials(currentUser.nombre || "PS");
  }
  if (userGreetingBadge && typeof Utils.getGreeting === "function") {
    userGreetingBadge.textContent = `• ${Utils.getGreeting()}`;
  }
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
          total: activeEstabs.reduce((acc, e) => acc + (porEst[e]?.total || 0), 0),
          por_establecimiento: userAppData.por_establecimiento
        };
      }

      if (!isIpressActive(currentUser.establecimiento)) {
        return { meses: {}, total: 0, disabled: true };
      }
      const baseApp = userAppData.consolidado || userAppData;
      return { ...baseApp, por_establecimiento: userAppData.por_establecimiento };
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
      dailySectionTitle.textContent = `Desglose Diario de Producción — Mes: ${monthObj.label.toUpperCase()} ${selectedYear || CONFIG.ANIO}`;
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

    const quincenaBox = document.getElementById("quincenaComparisonBox");
    const heatmapWrapper = document.getElementById("dailyHeatmapWrapper");
    const heatmapGrid = document.getElementById("dailyHeatmapGrid");
    const filterBar = document.getElementById("dailyFilterBar");
    const filterSihceBtn = document.getElementById("dailyFilterSihceBtn");

    if (!monthData || !monthData.dias) {
      if (quincenaBox) quincenaBox.classList.add("d-none");
      if (heatmapWrapper) heatmapWrapper.classList.add("d-none");
      if (filterBar) filterBar.classList.add("d-none");
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
    let q1Atc = 0;
    let q2Atc = 0;
    let hasSihceDays = false;

    const maxATC = Math.max(...Object.values(dias).map(d => Number(d.atc) || 0), 1);
    const dayItems = [];

    for (let d = 1; d <= 31; d++) {
      const dTag = (d < 10 ? "0" : "") + d;
      const dInfo = dias[dTag] || { atc: 0, atd: 0 };
      const atc = Number(dInfo.atc) || 0;
      const atd = Number(dInfo.atd) || 0;
      const citas = Number(dInfo.citas) || 0;
      const triajes = Number(dInfo.triajes) || 0;
      const hasActivity = atc > 0 || atd > 0;
      const hasSihce = citas > 0 || triajes > 0;
      if (hasSihce) hasSihceDays = true;

      if (hasActivity) {
        daysWithActivity++;
        sumATC += atc;
        sumATD += atd;
      }
      if (d <= 15) q1Atc += atc;
      else q2Atc += atc;

      dayItems.push({ d, dTag, atc, atd, citas, triajes, hasActivity, hasSihce });
    }

    // A. Comparativa Visual 1ra vs 2da Quincena
    if (quincenaBox) {
      const totalQ = q1Atc + q2Atc;
      const q1Pct = totalQ > 0 ? Math.round((q1Atc / totalQ) * 100) : 0;
      const q2Pct = totalQ > 0 ? Math.round((q2Atc / totalQ) * 100) : 0;
      const q1Text = document.getElementById("q1Text");
      const q2Text = document.getElementById("q2Text");
      const q1Bar = document.getElementById("q1Bar");
      const q2Bar = document.getElementById("q2Bar");
      const qWinner = document.getElementById("quincenaWinnerBadge");

      if (q1Text) q1Text.textContent = `${q1Atc.toLocaleString()} ATC (${q1Pct}%)`;
      if (q2Text) q2Text.textContent = `${q2Atc.toLocaleString()} ATC (${q2Pct}%)`;
      if (q1Bar) q1Bar.style.width = `${q1Pct}%`;
      if (q2Bar) q2Bar.style.width = `${q2Pct}%`;
      if (qWinner) {
        if (totalQ === 0) {
          qWinner.className = "badge bg-secondary-subtle text-secondary small";
          qWinner.textContent = "Sin producción registrada";
        } else if (q1Atc > q2Atc) {
          qWinner.className = "badge bg-primary-subtle text-primary small";
          qWinner.innerHTML = `<i class="bi bi-trophy-fill me-1"></i> Mayor carga en 1ra Quincena (+${(q1Atc - q2Atc).toLocaleString()} ATC)`;
        } else if (q2Atc > q1Atc) {
          qWinner.className = "badge bg-success-subtle text-success small";
          qWinner.innerHTML = `<i class="bi bi-trophy-fill me-1"></i> Mayor carga en 2da Quincena (+${(q2Atc - q1Atc).toLocaleString()} ATC)`;
        } else {
          qWinner.className = "badge bg-info-subtle text-info small";
          qWinner.textContent = "Producción equilibrada en ambas quincenas";
        }
      }
      quincenaBox.classList.remove("d-none");
    }

    // B. Mapa de Calor Mensual (31 cuadritos clicables)
    if (heatmapWrapper && heatmapGrid) {
      heatmapGrid.innerHTML = "";
      dayItems.forEach((item) => {
        let lvl = 0;
        if (item.atc > 0) {
          const ratio = item.atc / maxATC;
          if (ratio >= 0.8) lvl = 4;
          else if (ratio >= 0.5) lvl = 3;
          else if (ratio >= 0.25) lvl = 2;
          else lvl = 1;
        }
        const tile = document.createElement("div");
        tile.className = `heatmap-tile heatmap-lvl-${lvl}`;
        const sihceHint = item.hasSihce ? ` | ${item.triajes} triajes, ${item.citas} citas` : "";
        tile.title = `Día ${item.dTag}: ${item.atc} ATC, ${item.atd} ATD${sihceHint}`;
        tile.innerHTML = `<span class="hm-day">${item.dTag}</span><span class="hm-val">${item.atc > 0 ? item.atc : "·"}</span>`;
        tile.addEventListener("click", () => {
          // Si el filtro activo oculta ese día, cambiar a 'all' para ubicarlo
          if (dailyFilterMode !== "all") {
            dailyFilterMode = "all";
            document.querySelectorAll(".daily-filter-pill").forEach(p => {
              p.classList.toggle("active", p.dataset.dailyFilter === "all");
            });
            updateDailyView();
          }
          const targetRow = document.getElementById(`dailyRow_${item.dTag}`);
          if (targetRow) {
            targetRow.scrollIntoView({ behavior: "smooth", block: "center" });
            targetRow.classList.remove("heatmap-row-highlight");
            void targetRow.offsetWidth;
            targetRow.classList.add("heatmap-row-highlight");
          }
        });
        heatmapGrid.appendChild(tile);
      });
      heatmapWrapper.classList.remove("d-none");
    }

    // C. Filtros rápidos y Ordenamiento
    if (filterBar) filterBar.classList.remove("d-none");
    if (filterSihceBtn) {
      filterSihceBtn.classList.toggle("d-none", !hasSihceDays);
      if (!hasSihceDays && dailyFilterMode === "sihce") {
        dailyFilterMode = "all";
        document.querySelectorAll(".daily-filter-pill").forEach(p => {
          p.classList.toggle("active", p.dataset.dailyFilter === "all");
        });
      }
    }

    let visibleDays = dayItems.filter(item => {
      if (dailyFilterMode === "active") return item.hasActivity;
      if (dailyFilterMode === "sihce") return item.hasSihce;
      return true;
    });

    visibleDays.sort((a, b) => {
      const mult = dailySortDir === "asc" ? 1 : -1;
      if (dailySortKey === "atc") return (a.atc - b.atc) * mult || (a.d - b.d);
      if (dailySortKey === "atd") return (a.atd - b.atd) * mult || (a.d - b.d);
      return (a.d - b.d) * mult;
    });

    // Actualizar iconos de ordenamiento
    const sortIconDay = document.getElementById("sortIconDay");
    const sortIconAtc = document.getElementById("sortIconAtc");
    const sortIconAtd = document.getElementById("sortIconAtd");
    [
      [sortIconDay, "day"],
      [sortIconAtc, "atc"],
      [sortIconAtd, "atd"]
    ].forEach(([iconEl, key]) => {
      if (!iconEl) return;
      if (dailySortKey === key) {
        iconEl.className = `bi ${dailySortDir === "asc" ? "bi-sort-numeric-down" : "bi-sort-numeric-up-alt"} ms-1 small text-primary`;
      } else {
        iconEl.className = "bi bi-arrow-down-up ms-1 small opacity-50";
      }
    });

    if (visibleDays.length === 0) {
      if (dailyTableBody) {
        dailyTableBody.innerHTML = `
          <tr>
            <td colspan="4" class="text-center text-muted py-4">
              <i class="bi bi-funnel fs-4 d-block mb-1"></i>
              No hay días que coincidan con este filtro rápido.
            </td>
          </tr>
        `;
      }
    } else {
      visibleDays.forEach((item) => {
        const { dTag, atc, atd, citas, triajes, hasActivity } = item;
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
        tr.id = `dailyRow_${dTag}`;
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
      });
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

  // Vincular filtros rápidos y cabeceras ordenables de la tabla diaria
  document.querySelectorAll(".daily-filter-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      dailyFilterMode = pill.dataset.dailyFilter || "all";
      document.querySelectorAll(".daily-filter-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      updateDailyView();
    });
  });

  document.querySelectorAll("#dailyTable thead th[data-daily-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.dailySort;
      if (dailySortKey === key) {
        dailySortDir = dailySortDir === "asc" ? "desc" : "asc";
      } else {
        dailySortKey = key;
        dailySortDir = key === "day" ? "asc" : "desc";
      }
      updateDailyView();
    });
  });

  // Botón Ampliar / Pantalla Completa de Gráficos
  const btnFullscreenChart = document.getElementById("btnFullscreenChart");
  const chartContainerCard = document.getElementById("chartContainerCard");
  if (btnFullscreenChart && chartContainerCard) {
    btnFullscreenChart.addEventListener("click", () => {
      const isFs = chartContainerCard.classList.toggle("chart-card-fullscreen");
      btnFullscreenChart.innerHTML = isFs
        ? '<i class="bi bi-fullscreen-exit"></i> <span class="d-none d-sm-inline">Salir</span>'
        : '<i class="bi bi-arrows-fullscreen"></i> <span class="d-none d-sm-inline">Ampliar</span>';
      setTimeout(() => {
        if (productionChart) productionChart.resize();
        if (compositionChart) compositionChart.resize();
      }, 60);
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

  const selectLastMonthBtn = document.getElementById("selectLastMonthBtn");
  if (selectLastMonthBtn) {
    selectLastMonthBtn.addEventListener("click", () => {
      const activeAtd = getActiveAtdDataset();
      const activeApp = getActiveAppDataset();
      const mesesWithData = CONFIG.MESES.filter(m => {
        const atcVal = Number(activeAtd?.meses?.[m.key]?.atc) || 0;
        const atdVal = Number(activeAtd?.meses?.[m.key]?.atd) || 0;
        const appVal = Number(activeApp?.meses?.[m.key]) || 0;
        return atcVal > 0 || atdVal > 0 || appVal > 0;
      });
      const currentMonthIdx = Math.min(new Date().getMonth(), CONFIG.MESES.length - 1);
      const targetKey = mesesWithData.length > 0
        ? mesesWithData[mesesWithData.length - 1].key
        : CONFIG.MESES[currentMonthIdx].key;
      selectedMonths = [targetKey];
      monthSelectorContainer.querySelectorAll("input[type='checkbox']").forEach(i => {
        i.checked = i.value === targetKey;
      });
      onSelectionChange();
      if (typeof Utils.showToast === "function") {
        const mLabel = (CONFIG.MESES.find(m => m.key === targetKey) || {}).label || targetKey;
        Utils.showToast(`Mes seleccionado: ${mLabel}`, "info", 2200);
      }
    });
  }

  const btnDownloadBarChart = document.getElementById("btnDownloadBarChart");
  if (btnDownloadBarChart) {
    btnDownloadBarChart.addEventListener("click", () => {
      if (!productionChart || selectedMonths.length === 0) {
        Utils.showToast("Selecciona al menos un mes para exportar el gráfico.", "warning");
        return;
      }
      Utils.downloadChartPng(productionChart, `Produccion_${currentUser.dni || "reporte"}_${selectedYear}.png`);
    });
  }

  const btnDownloadDonutChart = document.getElementById("btnDownloadDonutChart");
  if (btnDownloadDonutChart) {
    btnDownloadDonutChart.addEventListener("click", () => {
      if (!compositionChart || selectedMonths.length === 0) {
        Utils.showToast("Selecciona al menos un mes para exportar la composición.", "warning");
        return;
      }
      Utils.downloadChartPng(compositionChart, `Composicion_${currentUser.dni || "reporte"}_${selectedYear}.png`);
    });
  }

  const btnBackToTop = document.getElementById("btnBackToTop");
  if (btnBackToTop) {
    window.addEventListener("scroll", () => {
      btnBackToTop.classList.toggle("visible", window.scrollY > 360);
    }, { passive: true });
    btnBackToTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

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
      animateCounter(kpiATC, 0);
      animateCounter(kpiATD, 0);
      animateCounter(kpiAPP, 0);
      updateInsights(activeAtd, 0, 0, 0, 0);
      renderOrUpdateChart(activeAtd);
      renderOrUpdateCompositionChart(0, 0, 0);
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

    // 3. Actualizar KPIs con efecto Contador en Vivo
    animateCounter(kpiATC, totalATC);
    animateCounter(kpiATD, totalATD);
    animateCounter(kpiAPP, totalAPP);

    // 4. Actualizar Insights (Récords Personales) y ambos gráficos
    const finalHis = hasAnySihce ? sumPeriodHis : totalATC;
    const finalSihce = sumPeriodTriajes + sumPeriodCitas;
    updateInsights(activeAtd, totalATC, totalATD, finalHis, finalSihce);
    renderOrUpdateChart(activeAtd);
    renderOrUpdateCompositionChart(finalHis, finalSihce, totalAPP);
  }

  // Calcular y mostrar tarjetas de Récords Personales del Período
  function updateInsights(activeAtd, totalATC, totalATD, totalHis, totalSihce) {
    const row = document.getElementById("insightsRow");
    if (!row) return;

    if (!activeAtd || activeAtd.disabled || selectedMonths.length === 0 || (totalATC === 0 && totalATD === 0)) {
      row.classList.add("d-none");
      return;
    }

    const bestMonthEl = document.getElementById("insightBestMonth");
    const bestDayEl = document.getElementById("insightBestDay");
    const avgDailyEl = document.getElementById("insightAvgDaily");

    // 1. Mes más productivo entre los seleccionados
    let bestMKey = selectedMonths[0];
    let bestMAtc = -1;
    selectedMonths.forEach((mKey) => {
      const mAtc = Number(activeAtd?.meses?.[mKey]?.atc) || 0;
      if (mAtc > bestMAtc) {
        bestMAtc = mAtc;
        bestMKey = mKey;
      }
    });
    const bestMObj = CONFIG.MESES.find(m => m.key === bestMKey) || { label: bestMKey };
    if (bestMonthEl) {
      bestMonthEl.textContent = `${bestMObj.label} — ${Math.max(0, bestMAtc).toLocaleString()} ATC`;
    }

    // 2. Día récord y promedio diario activo en los meses con desglose diario
    let bestDayInfo = null;
    let totalActiveDays = 0;
    let totalDailyAtc = 0;

    selectedMonths.forEach((mKey) => {
      const mDaily = userDailyData && userDailyData[mKey];
      if (!mDaily || !mDaily.dias) return;
      for (let d = 1; d <= 31; d++) {
        const dTag = (d < 10 ? "0" : "") + d;
        const atcVal = Number(mDaily.dias[dTag]?.atc) || 0;
        const atdVal = Number(mDaily.dias[dTag]?.atd) || 0;
        if (atcVal > 0 || atdVal > 0) {
          totalActiveDays++;
          totalDailyAtc += atcVal;
        }
        if (!bestDayInfo || atcVal > bestDayInfo.atc) {
          bestDayInfo = { dTag, mKey, atc: atcVal };
        }
      }
    });

    if (bestDayEl) {
      if (bestDayInfo && bestDayInfo.atc > 0) {
        const mLabel = selectedMonths.length === 1 ? "" : ` (${bestDayInfo.mKey})`;
        bestDayEl.textContent = `Día ${bestDayInfo.dTag}${mLabel} — ${bestDayInfo.atc.toLocaleString()} ATC`;
      } else {
        bestDayEl.textContent = "Consolidado mensual (sin desglose diario)";
      }
    }

    if (avgDailyEl) {
      if (totalActiveDays > 0) {
        const avg = Math.round(totalDailyAtc / totalActiveDays);
        avgDailyEl.textContent = `${avg.toLocaleString()} ATC / día activo (${totalActiveDays} días)`;
      } else {
        const avgMonth = Math.round(totalATC / selectedMonths.length);
        avgDailyEl.textContent = `${avgMonth.toLocaleString()} ATC promedio / mes`;
      }
    }

    row.classList.remove("d-none");
  }

  // Gráfico Interactivo Chart.js (Barras) + Gráfico de Dona de Composición
  let productionChart = null;
  let compositionChart = null;

  function renderOrUpdateCompositionChart(hisVal, sihceVal, appVal) {
    const canvas = document.getElementById("compositionChart");
    const emptyEl = document.getElementById("compositionEmptyState");
    const badgeEl = document.getElementById("compositionTotalBadge");
    const legendEl = document.getElementById("compositionLegend");
    if (!canvas || typeof Chart === "undefined") return;

    const totalSum = hisVal + sihceVal + appVal;
    if (badgeEl) badgeEl.textContent = `${totalSum.toLocaleString()} total`;

    if (totalSum <= 0 || selectedMonths.length === 0) {
      if (emptyEl) emptyEl.classList.remove("d-none");
      if (legendEl) legendEl.innerHTML = "";
      if (compositionChart) {
        compositionChart.destroy();
        compositionChart = null;
      }
      return;
    }
    if (emptyEl) emptyEl.classList.add("d-none");

    const items = [
      { label: "Atenciones HIS", val: hisVal, color: "#3b82f6" },
      { label: "SIHCE (Triaje/Citas)", val: sihceVal, color: "#10b981" },
      { label: "Promoción (APP)", val: appVal, color: "#6366f1" }
    ].filter(i => i.val > 0);

    if (legendEl) {
      legendEl.innerHTML = items.map(i => {
        const pct = Math.round((i.val / totalSum) * 100);
        return `<span class="d-inline-flex align-items-center gap-1 text-muted">
          <span style="width:10px;height:10px;border-radius:50%;background:${i.color};display:inline-block;"></span>
          <span>${i.label}: <strong class="text-main">${pct}%</strong></span>
        </span>`;
      }).join("");
    }

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const borderColor = isDark ? "#1e293b" : "#ffffff";

    if (compositionChart) {
      compositionChart.data.labels = items.map(i => i.label);
      compositionChart.data.datasets[0].data = items.map(i => i.val);
      compositionChart.data.datasets[0].backgroundColor = items.map(i => i.color);
      compositionChart.data.datasets[0].borderColor = borderColor;
      compositionChart.update();
      return;
    }

    compositionChart = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: items.map(i => i.label),
        datasets: [{
          data: items.map(i => i.val),
          backgroundColor: items.map(i => i.color),
          borderColor: borderColor,
          borderWidth: 2,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "66%",
        plugins: {
          legend: { display: false },
          tooltip: {
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => {
                const v = Number(ctx.raw) || 0;
                const p = totalSum > 0 ? Math.round((v / totalSum) * 100) : 0;
                return ` ${ctx.label}: ${v.toLocaleString()} (${p}%)`;
              }
            }
          }
        }
      }
    });
  }

  function renderOrUpdateChart(activeAtd) {
    const canvas = document.getElementById("productionChart");
    const emptyOverlay = document.getElementById("chartEmptyState");
    const headerTitle = document.getElementById("chartHeaderTitle");
    if (!canvas || typeof Chart === "undefined") return;

    if (activeAtd && activeAtd.disabled) {
      if (emptyOverlay) emptyOverlay.classList.add("d-none");
      if (productionChart) {
        productionChart.destroy();
        productionChart = null;
      }
      return;
    }

    if (selectedMonths.length === 0) {
      if (emptyOverlay) emptyOverlay.classList.remove("d-none");
      if (headerTitle) headerTitle.textContent = "Evolución y Comparativo Mensual (ATC vs ATD)";
      if (productionChart) {
        productionChart.destroy();
        productionChart = null;
      }
      return;
    }
    if (emptyOverlay) emptyOverlay.classList.add("d-none");
    if (headerTitle) {
      headerTitle.textContent = (isDailyModeActive && selectedMonths.length === 1)
        ? `Producción Día a Día — ${(CONFIG.MESES.find(m => m.key === selectedMonths[0])?.label || selectedMonths[0])}`
        : "Evolución y Comparativo Mensual (ATC vs ATD)";
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

  // Observar cambio de tema para adaptar colores de los gráficos
  const themeObserver = new MutationObserver(() => {
    if (productionChart || compositionChart) {
      updateTablesAndKPIs();
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

    // 1. Saneamiento de por_establecimiento contra los datos auditados locales
    // Evita que rezagos antiguos de Google Sheets (donde citas de SIHCE fueron asignadas por error alfabético a Rondocán)
    // contaminen la producción del usuario.
    if (localAtd && localAtd.por_establecimiento && merged.por_establecimiento) {
      Object.keys(merged.por_establecimiento).forEach(est => {
        if (localAtd.por_establecimiento[est]) {
          if (!est.toUpperCase().includes("SAN SEBASTIAN")) {
            merged.por_establecimiento[est] = JSON.parse(JSON.stringify(localAtd.por_establecimiento[est]));
          }
        }
      });
    }

    // 2. Integración de SIHCE en el establecimiento principal (San Sebastián) y consolidado
    CONFIG.MESES.forEach(m => {
      const mKey = m.key;
      const dMonthAtc = dailyData?.[mKey]?.total_atc || 0;
      const lMonthAtc = localAtd?.consolidado?.meses?.[mKey]?.atc || 0;
      const targetAtc = Math.max(dMonthAtc, lMonthAtc);

      if (merged.consolidado?.meses?.[mKey]) {
        const curAtc = Number(merged.consolidado.meses[mKey].atc) || 0;
        if (targetAtc > curAtc) {
          merged.consolidado.meses[mKey].atc = targetAtc;
        }
      }

      // Asegurar que San Sebastián tenga el total con SIHCE
      const pEst = merged.establecimiento_principal || "SAN SEBASTIAN";
      if (merged.por_establecimiento && merged.por_establecimiento[pEst] && merged.por_establecimiento[pEst].meses?.[mKey]) {
        const sanSebAtc = Number(merged.por_establecimiento[pEst].meses[mKey].atc) || 0;
        if (targetAtc > sanSebAtc) {
          merged.por_establecimiento[pEst].meses[mKey].atc = targetAtc;
        }
      }
    });

    // 3. Recalcular totales por establecimiento y consolidado
    if (merged.por_establecimiento) {
      Object.keys(merged.por_establecimiento).forEach(est => {
        const estObj = merged.por_establecimiento[est];
        if (estObj && estObj.meses) {
          let eAtc = 0, eAtd = 0;
          CONFIG.MESES.forEach(m => {
            eAtc += Number(estObj.meses[m.key]?.atc) || 0;
            eAtd += Number(estObj.meses[m.key]?.atd) || 0;
          });
          estObj.total_atc = eAtc;
          estObj.total_atd = eAtd;
        }
      });
    }

    if (merged.consolidado?.meses) {
      let sumTot = 0, sumTotAtd = 0;
      CONFIG.MESES.forEach(m => {
        sumTot += Number(merged.consolidado.meses[m.key]?.atc) || 0;
        sumTotAtd += Number(merged.consolidado.meses[m.key]?.atd) || 0;
      });
      merged.consolidado.total_atc = sumTot;
      merged.consolidado.total_atd = sumTotAtd;
    }

    return merged;
  }

  // 2. Cargar datos del usuario desde la API con barra de progreso sincronizada
  try {
    setSyncProgress(
      25,
      "Consultando repositorio institucional...",
      "Vinculando con Base de Datos",
      '<i class="bi bi-cloud-arrow-down text-info me-1"></i> Recuperando datos mensuales (ATD / ATC y APP)...'
    );
    
    // Cargar datos locales de demo / respaldo / override primero
    const localDemo = await Api.loadDemoData();
    const localDailyMatch = Api.findInMapByDni(currentUser.dni, localDemo?.diario);
    const localAtdMatch = Api.findInMapByDni(currentUser.dni, localDemo?.atd_atc);
    const localAppMatch = Api.findInMapByDni(currentUser.dni, localDemo?.app);

    const localDaily = localDailyMatch?.data || null;
    const localAtd = localAtdMatch?.data || null;
    const localApp = localAppMatch?.data || null;

    setSyncProgress(
      55,
      "Descargando atenciones y producción diaria...",
      "Sincronizando con Google Sheets",
      '<i class="bi bi-arrow-repeat text-warning me-1"></i> Leyendo registros día a día del personal asistencial...'
    );

    let res = null;
    try {
      res = await Api.callAppsScript("getData", { dni: currentUser.dni });
    } catch (e) {
      console.warn("Apps Script no disponible o en modo local:", e);
    }

    setSyncProgress(
      85,
      "Consolidando atenciones HIS y SIHCE...",
      "Procesando Información",
      '<i class="bi bi-gear-wide-connected text-primary me-1"></i> Verificando totales asistenciales y días laborados...'
    );

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

      // Sincronizar años habilitados recibidos de la nube
      if (res.anios_habilitados && Array.isArray(res.anios_habilitados)) {
        try {
          localStorage.setItem("reporte40_anios_habilitados", JSON.stringify(res.anios_habilitados));
        } catch (e) {}
        if (window.DEMO_DATA) {
          window.DEMO_DATA.anios_habilitados = res.anios_habilitados;
        }
      }

      // Sincronizar comunicado institucional desde Google Sheets
      if (res.comunicado && typeof res.comunicado === "object") {
        try {
          localStorage.setItem("comunicado_reporte40", JSON.stringify(res.comunicado));
        } catch (e) {}
        if (window.DEMO_DATA) {
          window.DEMO_DATA.comunicado = res.comunicado;
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

      // Si falla getData o está en local, intentar obtener ipress_control y anios_habilitados
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

      try {
        const yrRes = await Api.callAppsScript("getEnabledYears");
        if (yrRes && yrRes.success && Array.isArray(yrRes.anios_habilitados)) {
          try {
            localStorage.setItem("reporte40_anios_habilitados", JSON.stringify(yrRes.anios_habilitados));
          } catch (e) {}
          if (window.DEMO_DATA) {
            window.DEMO_DATA.anios_habilitados = yrRes.anios_habilitados;
          }
        }
      } catch (e) {}
    }

    setSyncProgress(
      95,
      "Generando vistas del panel y gráficos...",
      "Finalizando Vinculación",
      '<i class="bi bi-pie-chart-fill text-success me-1"></i> Renderizando componentes de usuario...'
    );

  } catch (err) {
    console.error("Error al cargar datos:", err);
  } finally {
    // 1. Inicializar y renderizar TODOS los componentes de la interfaz primero
    checkDefaultPasswordAlert();
    renderComunicadoBanner();
    setupYearSelector();
    setupEstablishmentSelector();
    renderMonthSelector();
    updateTablesAndKPIs();
    if (isDailyModeActive) {
      updateDailyView();
    }

    // 2. Recién cuando la pantalla tiene todos los datos listos, cerrar el modal de forma agradable
    finishSyncOverlay(true, "¡Información generada exitosamente!");
  }

  // Verificación de Contraseña por defecto (DNI)
  function checkDefaultPasswordAlert() {
    if (!urgentPasswordAlert) return;
    if (currentUser.rol === "admin") {
      urgentPasswordAlert.classList.add("d-none");
      return;
    }
    const serverFlag = sessionStorage.getItem("reporte40_is_default_pass");
    const hasCustomPass = serverFlag === "0" || Boolean(localStorage.getItem("custom_pass_" + currentUser.dni));
    const isDefault = serverFlag === "1" ? true : !hasCustomPass;
    if (isDefault) {
      urgentPasswordAlert.classList.remove("d-none");
    } else {
      urgentPasswordAlert.classList.add("d-none");
    }
  }

  // Inicializar componentes cuando el script arranca (para evitar estados inconsistentes)
  // pero la renderización final con datos reales se ejecuta al completar la carga en el bloque finally.
  checkDefaultPasswordAlert();
  renderComunicadoBanner();
  setupYearSelector();
  setupEstablishmentSelector();
  renderMonthSelector();

  // Destello institucional sutil al completar descarga de PDF
  function triggerPdfSuccessSparkle(anchorBtn) {
    if (!anchorBtn) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = anchorBtn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const colors = ["#3b82f6", "#10b981", "#38bdf8", "#f59e0b", "#6366f1"];

    for (let i = 0; i < 16; i++) {
      const dot = document.createElement("span");
      dot.className = "pdf-sparkle-dot";
      const angle = (Math.PI * 2 * i) / 16 + (Math.random() - 0.5) * 0.25;
      const dist = 36 + Math.random() * 44;
      dot.style.left = `${cx}px`;
      dot.style.top = `${cy}px`;
      dot.style.background = colors[i % colors.length];
      dot.style.setProperty("--tx", `${Math.round(Math.cos(angle) * dist)}px`);
      dot.style.setProperty("--ty", `${Math.round(Math.sin(angle) * dist)}px`);
      document.body.appendChild(dot);
      setTimeout(() => dot.remove(), 900);
    }
  }

  function validatePdfPreconditions() {
    const activeAtd = getActiveAtdDataset();
    if (activeAtd && activeAtd.disabled) {
      Utils.showToast("No es posible generar ni descargar el reporte en PDF: el establecimiento seleccionado se encuentra temporalmente bloqueado por auditoría de la administración.", "warning", 5000);
      return null;
    }
    if (selectedMonths.length === 0) {
      Utils.showToast("Por favor selecciona al menos un mes para generar tu reporte.", "warning");
      return null;
    }
    return activeAtd;
  }

  async function runPdfDownload() {
    const activeAtd = validatePdfPreconditions();
    if (!activeAtd) return;

    downloadPdfBtn.disabled = true;
    downloadPdfBtn.classList.remove("btn-pdf-success");
    downloadPdfBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Armando PDF...';

    const activeApp = getActiveAppDataset();
    let ok = false;

    try {
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

      await PdfGenerator.generate(
        currentUser,
        selectedMonths,
        activeAtd,
        activeApp,
        userAtdData,
        selectedEstab,
        userDailyData,
        isDailySingleMonth,
        selectedYear
      );
      ok = true;
    } catch (err) {
      Utils.showToast("Hubo un inconveniente al generar el PDF: " + err.message, "danger", 5000);
    } finally {
      if (ok) {
        downloadPdfBtn.classList.add("btn-pdf-success");
        downloadPdfBtn.innerHTML = `
          <svg class="pdf-svg-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 13l4 4L19 7"/>
          </svg>
          ¡PDF Descargado!
        `;
        triggerPdfSuccessSparkle(downloadPdfBtn);
        setTimeout(() => {
          downloadPdfBtn.classList.remove("btn-pdf-success");
          downloadPdfBtn.disabled = false;
          downloadPdfBtn.innerHTML = '<i class="bi bi-file-earmark-pdf-fill"></i> Descargar Reporte en PDF';
        }, 1800);
      } else {
        downloadPdfBtn.disabled = false;
        downloadPdfBtn.innerHTML = '<i class="bi bi-file-earmark-pdf-fill"></i> Descargar Reporte en PDF';
      }
    }
  }

  // 3. Descarga de PDF y Vista Previa en Modal
  downloadPdfBtn.addEventListener("click", runPdfDownload);

  let currentPreviewBlobUrl = null;
  let pdfPreviewModalInstance = null;
  const pdfPreviewModalEl = document.getElementById("pdfPreviewModal");
  const pdfPreviewFrame = document.getElementById("pdfPreviewFrame");
  const pdfPreviewSubtitle = document.getElementById("pdfPreviewSubtitle");
  const btnDownloadFromPreview = document.getElementById("btnDownloadFromPreview");

  if (pdfPreviewModalEl) {
    pdfPreviewModalEl.addEventListener("hidden.bs.modal", () => {
      if (pdfPreviewFrame) pdfPreviewFrame.src = "about:blank";
      if (currentPreviewBlobUrl) {
        URL.revokeObjectURL(currentPreviewBlobUrl);
        currentPreviewBlobUrl = null;
      }
    });
  }

  if (btnDownloadFromPreview) {
    btnDownloadFromPreview.addEventListener("click", () => {
      if (pdfPreviewModalInstance) pdfPreviewModalInstance.hide();
      runPdfDownload();
    });
  }

  if (previewPdfBtn) {
    previewPdfBtn.addEventListener("click", async () => {
      const activeAtd = validatePdfPreconditions();
      if (!activeAtd) return;

      previewPdfBtn.disabled = true;
      previewPdfBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Preparando...';

      const activeApp = getActiveAppDataset();
      const isDailySingleMonth = isDailyModeActive && selectedMonths.length === 1;

      try {
        const result = await PdfGenerator.generate(
          currentUser,
          selectedMonths,
          activeAtd,
          activeApp,
          userAtdData,
          selectedEstab,
          userDailyData,
          isDailySingleMonth,
          selectedYear,
          { previewOnly: true }
        );

        if (result && result.blobUrl && pdfPreviewFrame && pdfPreviewModalEl) {
          if (currentPreviewBlobUrl) URL.revokeObjectURL(currentPreviewBlobUrl);
          currentPreviewBlobUrl = result.blobUrl;
          pdfPreviewFrame.src = result.blobUrl;
          if (pdfPreviewSubtitle) {
            pdfPreviewSubtitle.textContent = `${result.filename} — (${selectedMonths.join(", ")})`;
          }
          if (!pdfPreviewModalInstance) {
            pdfPreviewModalInstance = new bootstrap.Modal(pdfPreviewModalEl);
          }
          pdfPreviewModalInstance.show();
        }
      } catch (err) {
        Utils.showToast("No se pudo generar la vista previa del PDF: " + err.message, "danger", 5000);
      } finally {
        previewPdfBtn.disabled = false;
        previewPdfBtn.innerHTML = '<i class="bi bi-eye-fill text-primary"></i> Vista Previa';
      }
    });
  }

  // 4. Formulario de Cambio de Contraseña
  const changePasswordForm = document.getElementById("changePasswordForm");
  const changePassAlert = document.getElementById("changePassAlert");
  const currentPassInput = document.getElementById("currentPassInput");
  const newPassInput = document.getElementById("newPassInput");
  const confirmPassInput = document.getElementById("confirmPassInput");
  const savePasswordBtn = document.getElementById("savePasswordBtn");
  const passStrengthFill = document.getElementById("passStrengthFill");
  const passStrengthLabel = document.getElementById("passStrengthLabel");

  function updatePassStrengthMeter(val) {
    if (!passStrengthFill || !passStrengthLabel) return;
    if (!val) {
      passStrengthFill.style.width = "0%";
      passStrengthFill.style.backgroundColor = "transparent";
      passStrengthLabel.textContent = "";
      return;
    }
    let score = 0;
    if (val.length >= 4) score += 1;
    if (val.length >= 8) score += 1;
    if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score += 1;
    if (/[0-9]/.test(val) && /[^A-Za-z0-9]/.test(val)) score += 1;
    const levels = [
      { w: "25%", color: "#ef4444", text: "Muy débil", cls: "text-danger" },
      { w: "50%", color: "#f59e0b", text: "Regular", cls: "text-warning" },
      { w: "75%", color: "#3b82f6", text: "Buena", cls: "text-primary" },
      { w: "100%", color: "#10b981", text: "Segura", cls: "text-success" }
    ];
    const lvl = levels[Math.max(0, Math.min(3, score - 1))];
    passStrengthFill.style.width = lvl.w;
    passStrengthFill.style.backgroundColor = lvl.color;
    passStrengthLabel.textContent = lvl.text;
    passStrengthLabel.className = `small fw-semibold ${lvl.cls}`;
  }

  if (newPassInput) {
    newPassInput.addEventListener("input", () => updatePassStrengthMeter(newPassInput.value));
  }

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
        try {
          sessionStorage.setItem("reporte40_is_default_pass", "0");
          localStorage.setItem("custom_pass_" + currentUser.dni, "1");
        } catch (e) {}
        
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
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDashboard);
} else {
  initDashboard();
}
