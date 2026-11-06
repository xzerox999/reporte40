/**
 * =====================================================================
 * GENERADOR DE PDF PROFESIONAL — REPORTE 40
 * Soporte Dinámico por Período Seleccionado (Filtro por IPRESS y Meses)
 * Librerías: jsPDF + AutoTable
 * Hecho por xzerox99
 * =====================================================================
 */

const PdfGenerator = {
  /**
   * Genera y descarga el PDF profesional
   * @param {Object} user - Datos del usuario
   * @param {Array} selectedMonths - Códigos de meses seleccionados (ej: ["ENE", "FEB", "MAR"])
   * @param {Object} atdData - Datos activos de ATD/ATC
   * @param {Object} appData - Datos activos de APP
   * @param {Object} fullAtdData - Objeto completo con desglose por_establecimiento
   * @param {String} selectedEstab - "ALL" o nombre del establecimiento específico
   */
  async generate(user, selectedMonths, atdData, appData, fullAtdData = null, selectedEstab = "ALL") {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert("Error: La librería jsPDF no está cargada.");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const primaryColor = [30, 64, 175]; // Azul institucional #1e40af
    const secondaryColor = [71, 85, 105]; // Slate
    const accentColor = [241, 245, 249]; // Gris claro

    let currentY = 18;
    const isConsolidated = selectedEstab === "ALL";

    // -------------------------------------------------------------
    // 0. CALCULAR QUÉ ESTABLECIMIENTOS TUVIERON ACTIVIDAD EN EL PERÍODO
    // -------------------------------------------------------------
    let ipressControlMap = {};
    try {
      const savedIpress = localStorage.getItem("reporte40_ipress_control");
      if (savedIpress) ipressControlMap = JSON.parse(savedIpress);
    } catch (e) {}

    const activeEstabsInPeriod = [];
    if (fullAtdData && fullAtdData.por_establecimiento) {
      Object.keys(fullAtdData.por_establecimiento).forEach((est) => {
        // Si el establecimiento está desactivado por auditoría, omitirlo del reporte
        if (ipressControlMap[est.trim()] === false) return;

        const d = fullAtdData.por_establecimiento[est];
        let atcPeriod = 0;
        let atdPeriod = 0;
        selectedMonths.forEach((mKey) => {
          if (d.meses && d.meses[mKey]) {
            atcPeriod += Number(d.meses[mKey].atc) || 0;
            atdPeriod += Number(d.meses[mKey].atd) || 0;
          }
        });

        // Solo incluir los que realmente tuvieron producción en los meses seleccionados
        if (atcPeriod > 0 || atdPeriod > 0) {
          activeEstabsInPeriod.push({
            estab: est,
            atc: atcPeriod,
            atd: atdPeriod
          });
        }
      });
      activeEstabsInPeriod.sort((a, b) => b.atc - a.atc);
    }

    // -------------------------------------------------------------
    // 1. ENCABEZADO INSTITUCIONAL
    // -------------------------------------------------------------
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...primaryColor);
    doc.text(CONFIG.INSTITUCION, 105, currentY, { align: "center" });

    currentY += 6;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);

    let reportTitle = "REPORTE DE PRODUCCIÓN INDIVIDUAL";
    if (isConsolidated) {
      reportTitle += activeEstabsInPeriod.length > 1
        ? " (CONSOLIDADO RED CUSCO SUR)"
        : ` — IPRESS: ${activeEstabsInPeriod.length === 1 ? activeEstabsInPeriod[0].estab : (user.establecimiento || "RED")}`;
    } else {
      reportTitle += ` — IPRESS: ${selectedEstab}`;
    }
    doc.text(reportTitle, 105, currentY, { align: "center" });

    currentY += 5;
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...secondaryColor);
    const monthsText = selectedMonths.length === CONFIG.MESES.length
      ? "Período Completo: Enero a Noviembre 2026"
      : `Meses seleccionados: ${selectedMonths.join(", ")} (Año ${CONFIG.ANIO})`;
    doc.text(monthsText, 105, currentY, { align: "center" });

    // Línea divisoria decorativa
    currentY += 4;
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.8);
    doc.line(14, currentY, 196, currentY);

    // -------------------------------------------------------------
    // 2. CAJA DE DATOS DEL PROFESIONAL
    // -------------------------------------------------------------
    currentY += 5;
    const boxHeight = 30;
    doc.setFillColor(...accentColor);
    doc.roundedRect(14, currentY, 182, boxHeight, 2, 2, "F");
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(14, currentY, 182, boxHeight, 2, 2, "D");

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...primaryColor);
    doc.text("DATOS DEL PROFESIONAL DE LA SALUD", 18, currentY + 5);

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85);

    // Columna Izquierda
    doc.text("Personal:", 18, currentY + 12);
    doc.setFont("helvetica", "normal");
    doc.text(String(user.nombre || "No especificado"), 42, currentY + 12);

    doc.setFont("helvetica", "bold");
    doc.text("DNI:", 18, currentY + 18);
    doc.setFont("helvetica", "normal");
    doc.text(String(user.dni || ""), 42, currentY + 18);

    doc.setFont("helvetica", "bold");
    doc.text("Establecimiento:", 18, currentY + 24);
    doc.setFont("helvetica", "normal");
    
    let estabDisplay = String(user.establecimiento || "No especificado");
    if (!isConsolidated) {
      estabDisplay = selectedEstab;
    } else if (activeEstabsInPeriod.length > 1) {
      // Listar únicamente los establecimientos donde laboró en estos meses
      const estabNames = activeEstabsInPeriod.map(e => e.estab).join(", ");
      estabDisplay = `Consolidado (${activeEstabsInPeriod.length} IPRESS: ${estabNames})`;
      // Si la cadena es muy larga para el cuadro
      if (estabDisplay.length > 55) {
        estabDisplay = `Consolidado (${activeEstabsInPeriod.length} IPRESS en este período)`;
      }
    } else if (activeEstabsInPeriod.length === 1) {
      estabDisplay = activeEstabsInPeriod[0].estab;
    }
    doc.text(estabDisplay, 42, currentY + 24);

    // Columna Derecha
    doc.setFont("helvetica", "bold");
    doc.text("MicroRed:", 115, currentY + 12);
    doc.setFont("helvetica", "normal");
    doc.text(String(user.microred || "-"), 135, currentY + 12);

    if (user.colegio) {
      doc.setFont("helvetica", "bold");
      doc.text("Colegio Prof.:", 115, currentY + 18);
      doc.setFont("helvetica", "normal");
      doc.text(String(user.colegio), 135, currentY + 18);
    }

    doc.setFont("helvetica", "bold");
    doc.text("Fecha Emisión:", 115, currentY + 24);
    doc.setFont("helvetica", "normal");
    doc.text(new Date().toLocaleDateString("es-PE"), 138, currentY + 24);

    currentY += boxHeight + 4;

    // -------------------------------------------------------------
    // 3. TABLA 1: ATENCIONES Y ATENDIDOS (ATD / ATC)
    // -------------------------------------------------------------
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...primaryColor);
    doc.text("1. PRODUCCIÓN DE ATENCIONES Y ATENDIDOS (ATD / ATC)", 14, currentY);
    currentY += 3;

    const atdBody = [];
    let sumATC = 0;
    let sumATD = 0;

    selectedMonths.forEach((mKey) => {
      const monthObj = CONFIG.MESES.find((m) => m.key === mKey) || { label: mKey };
      const mData = (atdData && atdData.meses && atdData.meses[mKey]) || { atc: 0, atd: 0 };
      const atc = Number(mData.atc) || 0;
      const atd = Number(mData.atd) || 0;
      sumATC += atc;
      sumATD += atd;

      atdBody.push([monthObj.label.toUpperCase(), atc.toLocaleString(), atd.toLocaleString()]);
    });

    doc.autoTable({
      startY: currentY,
      head: [["MES", "ATENCIONES (ATC)", "ATENDIDOS (ATD)"]],
      body: atdBody,
      foot: [["TOTAL SELECCIONADO", sumATC.toLocaleString(), sumATD.toLocaleString()]],
      theme: "grid",
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold",
        halign: "center"
      },
      footStyles: {
        fillColor: [226, 232, 240],
        textColor: [15, 23, 42],
        fontSize: 8,
        fontStyle: "bold",
        halign: "center"
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        halign: "center"
      },
      columnStyles: {
        0: { halign: "left", fontStyle: "bold", cellWidth: 70 },
        1: { halign: "center", cellWidth: 56 },
        2: { halign: "center", cellWidth: 56 }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = doc.lastAutoTable.finalY + 6;

    // -------------------------------------------------------------
    // 4. TABLA 2: ACTIVIDADES DE PROMOCIÓN DE LA SALUD (APP)
    // -------------------------------------------------------------
    if (appData && appData.meses) {
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...primaryColor);
      doc.text("2. PRODUCCIÓN DE ACTIVIDADES DE PROMOCIÓN (APP)", 14, currentY);
      currentY += 3;

      const appBody = [];
      let sumAPP = 0;

      selectedMonths.forEach((mKey) => {
        const monthObj = CONFIG.MESES.find((m) => m.key === mKey) || { label: mKey };
        const appVal = Number(appData.meses[mKey]) || 0;
        sumAPP += appVal;
        appBody.push([monthObj.label.toUpperCase(), appVal.toLocaleString()]);
      });

      doc.autoTable({
        startY: currentY,
        head: [["MES", "TOTAL ACTIVIDADES APP"]],
        body: appBody,
        foot: [["TOTAL SELECCIONADO", sumAPP.toLocaleString()]],
        theme: "grid",
        headStyles: {
          fillColor: [79, 70, 229], // Indigo
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: "bold",
          halign: "center"
        },
        footStyles: {
          fillColor: [226, 232, 240],
          textColor: [15, 23, 42],
          fontSize: 8,
          fontStyle: "bold",
          halign: "center"
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 2,
          halign: "center"
        },
        columnStyles: {
          0: { halign: "left", fontStyle: "bold", cellWidth: 90 },
          1: { halign: "center", cellWidth: 92 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 6;
    }

    // -------------------------------------------------------------
    // 5. TABLA 3: DESGLOSE POR ESTABLECIMIENTO EN LOS MESES SELECCIONADOS
    // (Solo aparece si en los meses seleccionados laboró en 2 o más IPRESS)
    // -------------------------------------------------------------
    if (isConsolidated && activeEstabsInPeriod.length > 1) {
      if (currentY > 230) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...primaryColor);
      
      const periodLabel = selectedMonths.length === 1 
        ? `EN EL MES DE ${CONFIG.MESES.find(m => m.key === selectedMonths[0])?.label.toUpperCase()}`
        : "EN EL PERÍODO SELECCIONADO";
      doc.text(`3. DESGLOSE DE PRODUCCIÓN POR ESTABLECIMIENTO (${periodLabel})`, 14, currentY);
      currentY += 3;

      const estabBody = [];
      let totalPeriodATC = 0;
      let totalPeriodATD = 0;

      activeEstabsInPeriod.forEach((item) => {
        totalPeriodATC += item.atc;
        totalPeriodATD += item.atd;
        estabBody.push([
          item.estab,
          item.atc.toLocaleString(),
          item.atd.toLocaleString()
        ]);
      });

      doc.autoTable({
        startY: currentY,
        head: [["ESTABLECIMIENTO (IPRESS)", "ATENCIONES EN EL PERÍODO", "ATENDIDOS EN EL PERÍODO"]],
        body: estabBody,
        foot: [["TOTAL SELECCIONADO", totalPeriodATC.toLocaleString(), totalPeriodATD.toLocaleString()]],
        theme: "grid",
        headStyles: {
          fillColor: [15, 118, 110], // Teal institucional
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: "bold",
          halign: "center"
        },
        footStyles: {
          fillColor: [226, 232, 240],
          textColor: [15, 23, 42],
          fontSize: 8,
          fontStyle: "bold",
          halign: "center"
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 2,
          halign: "center"
        },
        columnStyles: {
          0: { halign: "left", fontStyle: "bold", cellWidth: 90 },
          1: { halign: "center", cellWidth: 46 },
          2: { halign: "center", cellWidth: 46 }
        },
        margin: { left: 14, right: 14 }
      });
    }

    // -------------------------------------------------------------
    // 6. CÓDIGO QR DE VERIFICACIÓN OFICIAL Y PIE DE PÁGINA
    // -------------------------------------------------------------
    const totalPages = doc.internal.getNumberOfPages();
    const nowDateTime = new Date().toLocaleString("es-PE", {
      dateStyle: "short",
      timeStyle: "medium"
    });

    // Generar código QR de autenticidad digital si la librería está disponible
    try {
      if (typeof qrcode === "function") {
        const verifyBase = window.location.href.replace(/[^/]*$/, "") + "validar.html";
        const estabParam = isConsolidated ? "Consolidado Red Cusco Sur" : selectedEstab;
        const qrUrl = `${verifyBase}?dni=${user.dni}&p=${encodeURIComponent(user.nombre || "")}&e=${encodeURIComponent(estabParam)}&m=${selectedMonths.join(",")}&atc=${sumATC}&atd=${sumATD}`;

        const qr = qrcode(0, "M");
        qr.addData(qrUrl);
        qr.make();
        const qrDataUrl = qr.createDataURL(4, 0);

        // Estampar en la última página
        doc.setPage(totalPages);
        doc.addImage(qrDataUrl, "PNG", 172, 255, 22, 22);
        doc.setFontSize(6);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...primaryColor);
        doc.text("VERIFICACIÓN DIGITAL", 183, 279, { align: "center" });
        doc.setFontSize(5.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(148, 163, 184);
        doc.text("Escanear código QR", 183, 281.5, { align: "center" });
      }
    } catch (e) {
      console.warn("No se pudo generar código QR en PDF:", e);
    }

    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(14, 282, 196, 282);

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184);

      // Firma solicitada
      doc.text(CONFIG.AUTOR, 14, 287);

      // Fecha y hora
      doc.text(`Generado: ${nowDateTime}`, 105, 287, { align: "center" });

      // Numeración
      doc.text(`Página ${i} de ${totalPages}`, 196, 287, { align: "right" });
    }

    // Guardar archivo
    const cleanDni = String(user.dni || "reporte");
    const estabSuffix = isConsolidated ? "Consolidado" : selectedEstab.replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `Reporte40_${cleanDni}_${estabSuffix}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);

    return true;
  }
};
