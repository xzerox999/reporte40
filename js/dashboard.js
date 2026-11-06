/**
 * =====================================================================
 * CONTROLADOR DEL DASHBOARD (PERSONAL DE SALUD)
 * Soporta Consolidado Multi-Establecimiento y Filtro por IPRESS
 * Hecho por xzerox99
 * =====================================================================
 */

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Validar autenticación
  if (!Auth.requireAuth()) return;

  const currentUser = Auth.getCurrentUser();
  let userAtdData = null;
  let userAppData = null;
  let selectedEstab = "ALL"; // Por defecto "ALL" (Consolidado)
  let selectedMonths = CONFIG.MESES.map(m => m.key); // Por defecto todos seleccionados

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
  const atdTableTotalATC = document.getElementById("atdTableTotalATC");
  const atdTableTotalATD = document.getElementById("atdTableTotalATD");

  const appTableBody = document.getElementById("appTableBody");
  const appTableTotal = document.getElementById("appTableTotal");

  const downloadPdfBtn = document.getElementById("downloadPdfBtn");

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
      return userAtdData.consolidado || userAtdData;
    }
    return userAtdData.por_establecimiento[selectedEstab] || null;
  }

  function getActiveAppDataset() {
    if (!userAppData) return null;
    if (selectedEstab === "ALL" || !userAppData.por_establecimiento) {
      return userAppData.consolidado || userAppData;
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

  function onSelectionChange() {
    selectedCountBadge.textContent = `${selectedMonths.length} seleccionados`;
    updateTablesAndKPIs();
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
      
      // Opción 1: Consolidado General (Suma de todo)
      const totalGeneral = userAtdData.consolidado ? userAtdData.consolidado.total_atc : 0;
      const optAll = document.createElement("option");
      optAll.value = "ALL";
      optAll.textContent = `🌟 Todos los Establecimientos (Consolidado: ${totalGeneral.toLocaleString()} Atenciones)`;
      estabSelect.appendChild(optAll);

      // Opciones por cada establecimiento ordenadas de mayor a menor producción
      const sortedEstabs = [...estabs].sort((a, b) => {
        const prodA = (userAtdData.por_establecimiento[a] && userAtdData.por_establecimiento[a].total_atc) || 0;
        const prodB = (userAtdData.por_establecimiento[b] && userAtdData.por_establecimiento[b].total_atc) || 0;
        return prodB - prodA;
      });

      sortedEstabs.forEach((est) => {
        const prod = (userAtdData.por_establecimiento[est] && userAtdData.por_establecimiento[est].total_atc) || 0;
        const opt = document.createElement("option");
        opt.value = est;
        opt.textContent = `${est} (${prod.toLocaleString()} Atenciones)`;
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

    // 1. Tabla ATD / ATC
    atdTableBody.innerHTML = "";
    if (selectedMonths.length === 0) {
      atdTableBody.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-3">Selecciona al menos un mes</td></tr>`;
      atdTableTotalATC.textContent = "0";
      atdTableTotalATD.textContent = "0";
    } else {
      selectedMonths.forEach((mKey) => {
        const monthObj = CONFIG.MESES.find(m => m.key === mKey) || { label: mKey };
        const mData = (activeAtd && activeAtd.meses && activeAtd.meses[mKey]) || { atc: 0, atd: 0 };
        const atc = Number(mData.atc) || 0;
        const atd = Number(mData.atd) || 0;
        totalATC += atc;
        totalATD += atd;

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>${monthObj.label}</strong></td>
          <td class="text-center fw-semibold text-main">${atc.toLocaleString()}</td>
          <td class="text-center fw-semibold text-main">${atd.toLocaleString()}</td>
        `;
        atdTableBody.appendChild(tr);
      });

      atdTableTotalATC.textContent = totalATC.toLocaleString();
      atdTableTotalATD.textContent = totalATD.toLocaleString();
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

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";
    const textColor = isDark ? "#94a3b8" : "#64748b";

    const labels = [];
    const atcData = [];
    const atdData = [];

    selectedMonths.forEach((mKey) => {
      const monthObj = CONFIG.MESES.find(m => m.key === mKey) || { label: mKey };
      labels.push(monthObj.label);
      const mData = (activeAtd && activeAtd.meses && activeAtd.meses[mKey]) || { atc: 0, atd: 0 };
      atcData.push(Number(mData.atc) || 0);
      atdData.push(Number(mData.atd) || 0);
    });

    if (productionChart) {
      productionChart.data.labels = labels;
      productionChart.data.datasets[0].data = atcData;
      productionChart.data.datasets[1].data = atdData;
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

  // 2. Cargar datos del usuario desde la API
  try {
    const res = await Api.callAppsScript("getData", { dni: currentUser.dni });
    if (res.success) {
      userAtdData = res.atd_atc;
      userAppData = res.app;

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
    }
  } catch (err) {
    console.error("Error al cargar datos:", err);
  }

  // Inicializar componentes
  renderComunicadoBanner();
  setupEstablishmentSelector();
  renderMonthSelector();
  updateTablesAndKPIs();

  // 3. Descarga de PDF
  downloadPdfBtn.addEventListener("click", async () => {
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
      Api.callAppsScript("logDownload", {
        dni: currentUser.dni,
        personal: currentUser.nombre,
        establecimiento: estabLabel,
        meses: selectedMonths.join(","),
        tipo: selectedEstab === "ALL" ? "PDF_CONSOLIDADO" : "PDF_IPRESS"
      });

      // Generar PDF Profesional con desglose multi-establecimiento
      await PdfGenerator.generate(
        currentUser,
        selectedMonths,
        activeAtd,
        activeApp,
        userAtdData,
        selectedEstab
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
