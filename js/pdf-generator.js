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
   * @param {Object} dailyData - Objeto con datos diarios por mes
   * @param {Boolean} includeDaily - Indica si se debe incluir el desglose día a día
   */
  async generate(user, selectedMonths, atdData, appData, fullAtdData = null, selectedEstab = "ALL", dailyData = null, includeDaily = false, targetYear = null, options = {}) {
    const previewOnly = Boolean(options && options.previewOnly);
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
        // Protección contra rezagos de sincronización: si no es San Sebastián y su ATC coincide exactamente con las citas de SIHCE sin ATD, descartar ese residuo
        if (selectedMonths.length === 1 && !est.toUpperCase().includes("SAN SEBASTIAN")) {
          const mKey = selectedMonths[0];
          const mDaily = dailyData && dailyData[mKey];
          const mCitas = mDaily ? (Number(mDaily.total_citas) || 0) : 0;
          if (atcPeriod === mCitas && atdPeriod === 0 && mCitas > 0) {
            atcPeriod = 0;
          }
        }

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

    const reportYear = targetYear || CONFIG.ANIO || "2026";
    const isSingleMonth = selectedMonths.length === 1;

    // -------------------------------------------------------------
    // RUTA OPTIMIZADA: REPORTE MENSUAL EN 1 SOLA PÁGINA (AHORRO DE PAPEL)
    // Cuando el usuario consulta exactamente 1 mes (con o sin desglose día a día)
    // -------------------------------------------------------------
    if (isSingleMonth) {
      return this._generateSingleMonthPage(doc, {
        user,
        mKey: selectedMonths[0],
        atdData,
        appData,
        activeEstabsInPeriod,
        isConsolidated,
        selectedEstab,
        dailyData,
        includeDaily,
        reportYear,
        primaryColor,
        secondaryColor,
        accentColor,
        previewOnly
      });
    }

    // -------------------------------------------------------------
    // 1. ENCABEZADO INSTITUCIONAL MULTI-MES
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
      ? `Período Completo: Enero a Noviembre ${reportYear}`
      : `Meses seleccionados: ${selectedMonths.join(", ")} (Año ${reportYear})`;
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

    // Detectar si el usuario tiene producción de SIHCE (Triajes o Citas) en el período seleccionado
    let hasAnySihceInPeriod = false;
    let sumPeriodTriajes = 0;
    let sumPeriodCitas = 0;
    let sumPeriodHis = 0;

    selectedMonths.forEach(mKey => {
      const mDaily = dailyData && dailyData[mKey];
      if (mDaily) {
        sumPeriodTriajes += Number(mDaily.total_triajes) || 0;
        sumPeriodCitas += Number(mDaily.total_citas) || 0;
      }
    });
    hasAnySihceInPeriod = (sumPeriodTriajes > 0 || sumPeriodCitas > 0);

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

      if (hasAnySihceInPeriod) {
        const mDaily = dailyData && dailyData[mKey];
        const mTriajes = mDaily ? (Number(mDaily.total_triajes) || 0) : 0;
        const mCitas = mDaily ? (Number(mDaily.total_citas) || 0) : 0;
        const mHis = Math.max(0, atc - mTriajes - mCitas);
        sumPeriodHis += mHis;

        atdBody.push([
          monthObj.label.toUpperCase(),
          mHis > 0 ? mHis.toLocaleString() : "-",
          mTriajes > 0 ? mTriajes.toLocaleString() : "-",
          mCitas > 0 ? mCitas.toLocaleString() : "-",
          atc.toLocaleString(),
          atd.toLocaleString()
        ]);
      } else {
        atdBody.push([monthObj.label.toUpperCase(), atc.toLocaleString(), atd.toLocaleString()]);
      }
    });

    if (hasAnySihceInPeriod) {
      doc.autoTable({
        startY: currentY,
        head: [["MES", "ATENCIONES HIS", "TRIAJES (SIHCE)", "CITAS ADM. (SIHCE)", "TOTAL ATC", "ATENDIDOS (ATD)"]],
        body: atdBody,
        foot: [[
          "TOTAL SELECCIONADO",
          sumPeriodHis.toLocaleString(),
          sumPeriodTriajes.toLocaleString(),
          sumPeriodCitas.toLocaleString(),
          sumATC.toLocaleString(),
          sumATD.toLocaleString()
        ]],
        theme: "grid",
        headStyles: {
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontSize: 7.5,
          fontStyle: "bold",
          halign: "center"
        },
        footStyles: {
          fillColor: [226, 232, 240],
          textColor: [15, 23, 42],
          fontSize: 7.5,
          fontStyle: "bold",
          halign: "center"
        },
        styles: {
          fontSize: 7,
          cellPadding: 2,
          halign: "center"
        },
        columnStyles: {
          0: { halign: "left", fontStyle: "bold", cellWidth: 42 },
          1: { halign: "center", cellWidth: 28 },
          2: { halign: "center", cellWidth: 28 },
          3: { halign: "center", cellWidth: 28 },
          4: { halign: "center", fontStyle: "bold", cellWidth: 28 },
          5: { halign: "center", cellWidth: 28 }
        },
        margin: { left: 14, right: 14 }
      });
    } else {
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
    }

    currentY = doc.lastAutoTable.finalY + 3;

    if (hasAnySihceInPeriod) {
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(75, 85, 99);
      doc.text("* Diferenciación Asistencial: La columna 'TOTAL ATC' consolida las atenciones HIS e integra registros oficiales de SIHCE (Triajes de Enfermería y Citas de Admisión).", 14, currentY);
      currentY += 4;
    } else {
      currentY += 3;
    }

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
          halign: "center",
          cellPadding: 2.5
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

      currentY = doc.lastAutoTable.finalY + 8;
    }

    // -------------------------------------------------------------
    // 5.5 TABLA OPCIONAL: DESGLOSE DIARIO (DÍA 01 AL 31)
    // Se activa cuando el usuario consulta 1 mes y marca desglose diario
    // -------------------------------------------------------------
    if (includeDaily && selectedMonths.length === 1 && dailyData) {
      const mKey = selectedMonths[0];
      const mDaily = dailyData[mKey];
      if (mDaily && mDaily.dias) {
        const monthName = (CONFIG.MESES.find((m) => m.key === mKey)?.label || mKey).toUpperCase();

        // Si queda poco espacio en la página actual (el desglose diario con 16 filas y cabecera multinivel requiere al menos 100mm), agregar nueva página
        if (currentY > 135) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFontSize(9.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...primaryColor);
        doc.text(`DESGLOSE DETALLADO DÍA A DÍA — MES: ${monthName} ${reportYear}`, 14, currentY);
        currentY += 5;

        // Detectar si el mes tiene registros de SIHCE (Citas o Triajes)
        const hasSihce = (mDaily.total_citas && mDaily.total_citas > 0) || (mDaily.total_triajes && mDaily.total_triajes > 0);

        if (hasSihce) {
          // TABLA DETALLADA POR DÍA CON FUENTES (HIS [ATC / ATD], TRIAJES, CITAS, TOTAL ATC)
          const dailyBody = [];
          let sumHisAtcQ1 = 0, sumHisAtdQ1 = 0, sumTriQ1 = 0, sumCitQ1 = 0, sumAtcQ1 = 0;
          let sumHisAtcQ2 = 0, sumHisAtdQ2 = 0, sumTriQ2 = 0, sumCitQ2 = 0, sumAtcQ2 = 0;

          for (let d = 1; d <= 16; d++) {
            const dLeft = (d < 10 ? "0" : "") + d;
            const leftInfo = mDaily.dias[dLeft] || { atc: 0, atd: 0, citas: 0, triajes: 0 };
            const leftAtc = Number(leftInfo.atc) || 0;
            const leftAtd = Number(leftInfo.atd) || 0;
            const leftTri = Number(leftInfo.triajes) || 0;
            const leftCit = Number(leftInfo.citas) || 0;
            const leftHisAtc = Math.max(0, leftAtc - leftTri - leftCit);
            const leftHisAtd = leftAtd;

            sumHisAtcQ1 += leftHisAtc;
            sumHisAtdQ1 += leftHisAtd;
            sumTriQ1 += leftTri;
            sumCitQ1 += leftCit;
            sumAtcQ1 += leftAtc;

            const dRightNum = d + 16;
            let dRightStr = "—";
            let rightHisAtcStr = "—", rightHisAtdStr = "—", rightTriStr = "—", rightCitStr = "—", rightAtcStr = "—";

            if (dRightNum <= 31) {
              const dRight = (dRightNum < 10 ? "0" : "") + dRightNum;
              dRightStr = `Día ${dRight}`;
              const rightInfo = mDaily.dias[dRight] || { atc: 0, atd: 0, citas: 0, triajes: 0 };
              const rightAtc = Number(rightInfo.atc) || 0;
              const rightAtd = Number(rightInfo.atd) || 0;
              const rightTri = Number(rightInfo.triajes) || 0;
              const rightCit = Number(rightInfo.citas) || 0;
              const rightHisAtc = Math.max(0, rightAtc - rightTri - rightCit);
              const rightHisAtd = rightAtd;

              sumHisAtcQ2 += rightHisAtc;
              sumHisAtdQ2 += rightHisAtd;
              sumTriQ2 += rightTri;
              sumCitQ2 += rightCit;
              sumAtcQ2 += rightAtc;

              rightHisAtcStr = rightHisAtc > 0 ? rightHisAtc.toLocaleString() : "-";
              rightHisAtdStr = rightHisAtd > 0 ? rightHisAtd.toLocaleString() : "-";
              rightTriStr = rightTri > 0 ? rightTri.toLocaleString() : "-";
              rightCitStr = rightCit > 0 ? rightCit.toLocaleString() : "-";
              rightAtcStr = rightAtc > 0 ? rightAtc.toLocaleString() : "-";
            }

            dailyBody.push([
              `Día ${dLeft}`,
              leftHisAtc > 0 ? leftHisAtc.toLocaleString() : "-",
              leftHisAtd > 0 ? leftHisAtd.toLocaleString() : "-",
              leftTri > 0 ? leftTri.toLocaleString() : "-",
              leftCit > 0 ? leftCit.toLocaleString() : "-",
              leftAtc > 0 ? leftAtc.toLocaleString() : "-",
              dRightStr,
              rightHisAtcStr,
              rightHisAtdStr,
              rightTriStr,
              rightCitStr,
              rightAtcStr
            ]);
          }

          doc.autoTable({
            startY: currentY,
            head: [
              [
                { content: "PRIMERA QUINCENA (DÍAS 01 AL 16)", colSpan: 6, styles: { halign: "center", fillColor: [30, 64, 175], textColor: [255, 255, 255] } },
                { content: "SEGUNDA QUINCENA (DÍAS 17 AL 31)", colSpan: 6, styles: { halign: "center", fillColor: [15, 118, 110], textColor: [255, 255, 255] } }
              ],
              [
                { content: "DÍA", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
                { content: "HIS", colSpan: 2, styles: { halign: "center" } },
                { content: "TRIAJE", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
                { content: "CITAS", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
                { content: "TOTAL", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
                { content: "DÍA", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
                { content: "HIS", colSpan: 2, styles: { halign: "center" } },
                { content: "TRIAJE", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
                { content: "CITAS", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
                { content: "TOTAL", rowSpan: 2, styles: { valign: "middle", halign: "center" } }
              ],
              [
                "ATC", "ATD",
                "ATC", "ATD"
              ]
            ],
            body: dailyBody,
            foot: [
              [
                "SUBTOTAL",
                sumHisAtcQ1 > 0 ? sumHisAtcQ1.toLocaleString() : "-",
                sumHisAtdQ1 > 0 ? sumHisAtdQ1.toLocaleString() : "-",
                sumTriQ1 > 0 ? sumTriQ1.toLocaleString() : "-",
                sumCitQ1 > 0 ? sumCitQ1.toLocaleString() : "-",
                sumAtcQ1.toLocaleString(),
                "SUBTOTAL",
                sumHisAtcQ2 > 0 ? sumHisAtcQ2.toLocaleString() : "-",
                sumHisAtdQ2 > 0 ? sumHisAtdQ2.toLocaleString() : "-",
                sumTriQ2 > 0 ? sumTriQ2.toLocaleString() : "-",
                sumCitQ2 > 0 ? sumCitQ2.toLocaleString() : "-",
                sumAtcQ2.toLocaleString()
              ],
              [
                {
                  content: `CONSOLIDADO DEL MES (${monthName}):  HIS: ${(sumHisAtcQ1 + sumHisAtcQ2).toLocaleString()} ATC / ${(sumHisAtdQ1 + sumHisAtdQ2).toLocaleString()} ATD   |   TRIAJES: ${(sumTriQ1 + sumTriQ2).toLocaleString()}   |   CITAS ADMISIÓN: ${(sumCitQ1 + sumCitQ2).toLocaleString()}   |   TOTAL ATC: ${(sumAtcQ1 + sumAtcQ2).toLocaleString()}`,
                  colSpan: 12,
                  styles: { halign: "center", fontStyle: "bold", fillColor: [241, 245, 249], textColor: [15, 23, 42], fontSize: 6.5 }
                }
              ]
            ],
            theme: "grid",
            headStyles: {
              fontSize: 6.5,
              fontStyle: "bold",
              halign: "center",
              textColor: [255, 255, 255],
              fillColor: [51, 65, 85]
            },
            footStyles: {
              fillColor: [226, 232, 240],
              textColor: [15, 23, 42],
              fontSize: 6.5,
              fontStyle: "bold",
              halign: "center"
            },
            styles: {
              fontSize: 6,
              cellPadding: 1,
              halign: "center"
            },
            columnStyles: {
              0: { halign: "center", fontStyle: "bold", cellWidth: 15 },
              1: { halign: "center", cellWidth: 14 },
              2: { halign: "center", cellWidth: 14 },
              3: { halign: "center", cellWidth: 16 },
              4: { halign: "center", cellWidth: 15 },
              5: { halign: "center", fontStyle: "bold", cellWidth: 17 },
              6: { halign: "center", fontStyle: "bold", cellWidth: 15 },
              7: { halign: "center", cellWidth: 14 },
              8: { halign: "center", cellWidth: 14 },
              9: { halign: "center", cellWidth: 16 },
              10: { halign: "center", cellWidth: 15 },
              11: { halign: "center", fontStyle: "bold", cellWidth: 17 }
            },
            margin: { left: 14, right: 14 }
          });

          currentY = doc.lastAutoTable.finalY + 3;

          doc.setFontSize(6);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(100, 116, 139);
          doc.text("* Documento formal con plena validez institucional: Se certifica la producción combinada y detallada de atenciones del sistema HIS y registros de SIHCE.", 14, currentY);
          currentY += 4;
        } else {
          // Construir tabla estándar en dos bloques paralelos (Días 01 a 16 / Días 17 a 31)
          const dailyBody = [];
          for (let d = 1; d <= 16; d++) {
            const dLeft = (d < 10 ? "0" : "") + d;
            const leftInfo = mDaily.dias[dLeft] || { atc: 0, atd: 0 };
            const leftAtc = Number(leftInfo.atc) || 0;
            const leftAtd = Number(leftInfo.atd) || 0;

            const dRightNum = d + 16;
            let dRight = "";
            let rightAtcStr = "";
            let rightAtdStr = "";

            if (dRightNum <= 31) {
              dRight = (dRightNum < 10 ? "0" : "") + dRightNum;
              const rightInfo = mDaily.dias[dRight] || { atc: 0, atd: 0 };
              const rightAtc = Number(rightInfo.atc) || 0;
              const rightAtd = Number(rightInfo.atd) || 0;
              rightAtcStr = rightAtc > 0 ? rightAtc.toLocaleString() : "-";
              rightAtdStr = rightAtd > 0 ? rightAtd.toLocaleString() : "-";
            } else {
              dRight = "—";
              rightAtcStr = "—";
              rightAtdStr = "—";
            }

            dailyBody.push([
              `Día ${dLeft}`,
              leftAtc > 0 ? leftAtc.toLocaleString() : "-",
              leftAtd > 0 ? leftAtd.toLocaleString() : "-",
              dRightNum <= 31 ? `Día ${dRight}` : "—",
              rightAtcStr,
              rightAtdStr
            ]);
          }

          doc.autoTable({
            startY: currentY,
            head: [
              [
                { content: "PRIMERA QUINCENA (DÍAS 01 AL 16)", colSpan: 3, styles: { halign: "center", fillColor: [30, 64, 175] } },
                { content: "SEGUNDA QUINCENA (DÍAS 17 AL 31)", colSpan: 3, styles: { halign: "center", fillColor: [15, 118, 110] } }
              ],
              ["DÍA", "ATC", "ATD", "DÍA", "ATC", "ATD"]
            ],
            body: dailyBody,
            foot: [
              [
                "TOTAL MES",
                (mDaily.total_atc || 0).toLocaleString(),
                (mDaily.total_atd || 0).toLocaleString(),
                "TOTAL MES",
                (mDaily.total_atc || 0).toLocaleString(),
                (mDaily.total_atd || 0).toLocaleString()
              ]
            ],
            theme: "grid",
            headStyles: {
              fontSize: 7.5,
              fontStyle: "bold",
              halign: "center",
              textColor: [255, 255, 255],
              fillColor: [51, 65, 85]
            },
            footStyles: {
              fillColor: [226, 232, 240],
              textColor: [15, 23, 42],
              fontSize: 7.5,
              fontStyle: "bold",
              halign: "center"
            },
            styles: {
              fontSize: 7,
              cellPadding: 1.5,
              halign: "center"
            },
            columnStyles: {
              0: { halign: "center", fontStyle: "bold", cellWidth: 26 },
              1: { halign: "center", cellWidth: 33 },
              2: { halign: "center", cellWidth: 32 },
              3: { halign: "center", fontStyle: "bold", cellWidth: 26 },
              4: { halign: "center", cellWidth: 33 },
              5: { halign: "center", cellWidth: 32 }
            },
            margin: { left: 14, right: 14 }
          });

          currentY = doc.lastAutoTable.finalY + 3;
        }
      }
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
        let sumMultiAPP = 0;
        if (appData && appData.meses) {
          selectedMonths.forEach(mK => { sumMultiAPP += Number(appData.meses[mK]) || 0; });
        }
        const qrUrl = `${verifyBase}?dni=${user.dni}&p=${encodeURIComponent(user.nombre || "")}&e=${encodeURIComponent(estabParam)}&m=${selectedMonths.join(",")}&atc=${sumATC}&atd=${sumATD}&app=${sumMultiAPP}&his=${sumPeriodHis}&tri=${sumPeriodTriajes}&cit=${sumPeriodCitas}&y=${reportYear}&d=${includeDaily ? 1 : 0}&col=${encodeURIComponent(user.colegio || "")}&mr=${encodeURIComponent(user.microred || "")}`;

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

    // Guardar o devolver vista previa del archivo
    const cleanDni = String(user.dni || "reporte");
    const estabSuffix = isConsolidated ? "Consolidado" : selectedEstab.replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `Reporte40_${cleanDni}_${estabSuffix}_${new Date().toISOString().slice(0, 10)}.pdf`;
    if (previewOnly) {
      const blob = doc.output("blob");
      return { blobUrl: URL.createObjectURL(blob), filename };
    }
    doc.save(filename);

    return true;
  },

  /**
   * Generador Ultra-Optimizado de 1 Sola Página para Reportes de 1 Mes
   * (Ahorro de papel institucional: Resumen consolidado + Desglose diario 01 al 31 + Firmas y QR en 1 sola hoja A4)
   */
  _generateSingleMonthPage(doc, {
    user,
    mKey,
    atdData,
    appData,
    activeEstabsInPeriod,
    isConsolidated,
    selectedEstab,
    dailyData,
    includeDaily,
    reportYear,
    primaryColor,
    secondaryColor,
    accentColor,
    previewOnly = false
  }) {
    const monthObj = CONFIG.MESES.find((m) => m.key === mKey) || { label: mKey };
    const monthName = monthObj.label.toUpperCase();

    // Cálculos de producción mensual
    const mData = (atdData && atdData.meses && atdData.meses[mKey]) || { atc: 0, atd: 0 };
    const sumATC = Number(mData.atc) || 0;
    const sumATD = Number(mData.atd) || 0;
    const sumAPP = (appData && appData.meses && Number(appData.meses[mKey])) || 0;

    const mDaily = dailyData && dailyData[mKey];
    const sumPeriodTriajes = mDaily ? (Number(mDaily.total_triajes) || 0) : 0;
    const sumPeriodCitas = mDaily ? (Number(mDaily.total_citas) || 0) : 0;
    const sumPeriodHis = Math.max(0, sumATC - sumPeriodTriajes - sumPeriodCitas);
    const hasSihce = (sumPeriodTriajes > 0 || sumPeriodCitas > 0);

    // 1. ENCABEZADO INSTITUCIONAL COMPACTO
    let currentY = 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...secondaryColor);
    doc.text("GOBIERNO REGIONAL CUSCO — GERESA CUSCO", 105, currentY, { align: "center" });

    currentY += 4.5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...primaryColor);
    doc.text(CONFIG.INSTITUCION || "RED DE SERVICIOS DE SALUD CUSCO SUR", 105, currentY, { align: "center" });

    currentY += 4.5;
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text("REPORTE MENSUAL DE PRODUCCIÓN ASISTENCIAL (REPORTE 40)", 105, currentY, { align: "center" });

    currentY += 4;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...primaryColor);

    let estabDisplay = String(user.establecimiento || "No especificado");
    if (!isConsolidated) {
      estabDisplay = selectedEstab;
    } else if (activeEstabsInPeriod.length > 1) {
      const estabNames = activeEstabsInPeriod.map(e => e.estab).join(", ");
      estabDisplay = `Consolidado (${activeEstabsInPeriod.length} IPRESS: ${estabNames})`;
      if (estabDisplay.length > 55) {
        estabDisplay = `Consolidado (${activeEstabsInPeriod.length} IPRESS en el mes)`;
      }
    } else if (activeEstabsInPeriod.length === 1) {
      estabDisplay = activeEstabsInPeriod[0].estab;
    }

    doc.text(`MES: ${monthName} ${reportYear}   —   ÁMBITO: ${estabDisplay}`, 105, currentY, { align: "center" });

    currentY += 3;
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.6);
    doc.line(14, currentY, 196, currentY);

    // 2. CAJA DE DATOS DEL PROFESIONAL (2 FILAS, ALTURA 14mm)
    currentY += 3;
    const boxH = 14;
    doc.setFillColor(...accentColor);
    doc.roundedRect(14, currentY, 182, boxH, 1.5, 1.5, "F");
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.roundedRect(14, currentY, 182, boxH, 1.5, 1.5, "D");

    doc.setFontSize(7.2);
    const col1 = 17;
    const col2 = 88;
    const col3 = 145;

    // Fila 1
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85);
    doc.text("Personal:", col1, currentY + 4.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(String(user.nombre || "No especificado").substring(0, 36), col1 + 14, currentY + 4.5);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85);
    doc.text("MicroRed:", col2, currentY + 4.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(String(user.microred || "-"), col2 + 15, currentY + 4.5);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85);
    doc.text("Colegio:", col3, currentY + 4.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(String(user.colegio || "-").substring(0, 18), col3 + 13, currentY + 4.5);

    // Fila 2
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85);
    doc.text("DNI:", col1, currentY + 10.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(String(user.dni || "-"), col1 + 14, currentY + 10.5);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85);
    doc.text("IPRESS:", col2, currentY + 10.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    const boxEstab = activeEstabsInPeriod.length > 1
      ? `Consolidado (${activeEstabsInPeriod.length} IPRESS)`
      : (estabDisplay.length > 28 ? estabDisplay.substring(0, 26) + "..." : estabDisplay);
    doc.text(boxEstab, col2 + 15, currentY + 10.5);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85);
    doc.text("Emisión:", col3, currentY + 10.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(new Date().toLocaleDateString("es-PE"), col3 + 13, currentY + 10.5);

    currentY += boxH + 3.5;

    // 3. TABLA 1: RESUMEN MENSUAL CONSOLIDADO DE PRODUCCIÓN (1 SOLA TABLA ELEGANTE)
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...primaryColor);
    doc.text(`1. RESUMEN MENSUAL CONSOLIDADO DE PRODUCCIÓN (MES: ${monthName} ${reportYear})`, 14, currentY);
    currentY += 2;

    // Calcular distribución detallada por establecimiento (HIS, Triajes, Citas, APP)
    // Regla Asistencial Oficial: Citas de Admisión y Triajes de SIHCE pertenecen a C.S. SAN SEBASTIAN.
    // Los demás establecimientos (ej. Rondocán) corresponden estrictamente a producción asistencial de consultorios HIS.
    const estabDetails = activeEstabsInPeriod.map(eItem => {
      const estName = eItem.estab;
      const rawAtc = Number(eItem.atc) || 0;
      const estAtd = Number(eItem.atd) || 0;

      let estApp = 0;
      if (appData && appData.por_establecimiento && appData.por_establecimiento[estName]) {
        estApp = Number(appData.por_establecimiento[estName]?.meses?.[mKey]) || 0;
      }

      let estCit = 0;
      let estTri = 0;
      let estHis = 0;
      let finalAtc = rawAtc;

      // SIHCE (Citas de Admisión y Triajes) pertenece exclusivamente a C.S. SAN SEBASTIAN
      const isSihceEstab = estName.toUpperCase().includes("SAN SEBASTIAN") || (activeEstabsInPeriod.length === 1 && hasSihce);

      if (isSihceEstab) {
        estCit = sumPeriodCitas;
        estTri = sumPeriodTriajes;
        // Si rawAtc ya contiene SIHCE incorporado (ej. 468 = 375 HIS + 93 Citas):
        if (rawAtc >= sumPeriodHis + estCit + estTri) {
          estHis = rawAtc - estCit - estTri;
          finalAtc = rawAtc;
        } else {
          // Si rawAtc contiene únicamente la producción de consultorio HIS original (ej. 375):
          estHis = Math.max(rawAtc, sumPeriodHis);
          finalAtc = estHis + estCit + estTri;
        }
      } else {
        // En cualquier otra IPRESS (ej. Rondocán), toda la producción registrada es 100% asistencial HIS
        estHis = rawAtc;
        estCit = 0;
        estTri = 0;
        finalAtc = rawAtc;
      }

      return {
        estab: estName,
        atc: finalAtc,
        atd: estAtd,
        app: estApp,
        his: estHis,
        tri: estTri,
        cit: estCit
      };
    });

    // Si ningún establecimiento tuvo APP asignada directamente pero sumAPP > 0:
    const totalAllocApp = estabDetails.reduce((acc, ed) => acc + ed.app, 0);
    if (totalAllocApp === 0 && sumAPP > 0) {
      const primaryEst = estabDetails.find(ed => ed.atd > 0) || estabDetails[0];
      if (primaryEst) primaryEst.app = sumAPP;
    }

    let summaryHead = [];
    let summaryBody = [];
    let summaryFoot = null;

    if (hasSihce) {
      summaryHead = [["ÁMBITO / ESTABLECIMIENTO", "ATENCIONES HIS", "TRIAJES (SIHCE)", "CITAS ADM. (SIHCE)", "TOTAL ATC", "ATENDIDOS (ATD)", "ACTIVIDADES APP", "TOTAL PROD."]];
      if (activeEstabsInPeriod.length > 1) {
        estabDetails.forEach(ed => {
          const estProd = ed.atc + ed.app;
          summaryBody.push([
            ed.estab,
            ed.his > 0 ? ed.his.toLocaleString() : "-",
            ed.tri > 0 ? ed.tri.toLocaleString() : "-",
            ed.cit > 0 ? ed.cit.toLocaleString() : "-",
            ed.atc > 0 ? ed.atc.toLocaleString() : "-",
            ed.atd > 0 ? ed.atd.toLocaleString() : "-",
            ed.app > 0 ? ed.app.toLocaleString() : "-",
            estProd > 0 ? estProd.toLocaleString() : "-"
          ]);
        });
        summaryFoot = [[
          `TOTAL CONSOLIDADO (${monthName})`,
          sumPeriodHis.toLocaleString(),
          sumPeriodTriajes > 0 ? sumPeriodTriajes.toLocaleString() : "0",
          sumPeriodCitas > 0 ? sumPeriodCitas.toLocaleString() : "0",
          sumATC.toLocaleString(),
          sumATD.toLocaleString(),
          sumAPP > 0 ? sumAPP.toLocaleString() : "-",
          (sumATC + sumAPP).toLocaleString()
        ]];
      } else {
        summaryBody = [[
          estabDisplay,
          sumPeriodHis.toLocaleString(),
          sumPeriodTriajes > 0 ? sumPeriodTriajes.toLocaleString() : "-",
          sumPeriodCitas > 0 ? sumPeriodCitas.toLocaleString() : "-",
          sumATC.toLocaleString(),
          sumATD.toLocaleString(),
          sumAPP > 0 ? sumAPP.toLocaleString() : "-",
          (sumATC + sumAPP).toLocaleString()
        ]];
      }
    } else {
      summaryHead = [["ÁMBITO / ESTABLECIMIENTO", "ATENCIONES (ATC)", "ATENDIDOS (ATD)", "ACTIVIDADES (APP)", "TOTAL PRODUCCIÓN GENERAL"]];
      if (activeEstabsInPeriod.length > 1) {
        estabDetails.forEach(ed => {
          const estProd = ed.atc + ed.app;
          summaryBody.push([
            ed.estab,
            ed.atc > 0 ? ed.atc.toLocaleString() : "-",
            ed.atd > 0 ? ed.atd.toLocaleString() : "-",
            ed.app > 0 ? ed.app.toLocaleString() : "-",
            estProd > 0 ? estProd.toLocaleString() : "-"
          ]);
        });
        summaryFoot = [[
          `TOTAL CONSOLIDADO (${monthName})`,
          sumATC.toLocaleString(),
          sumATD.toLocaleString(),
          sumAPP > 0 ? sumAPP.toLocaleString() : "-",
          (sumATC + sumAPP).toLocaleString()
        ]];
      } else {
        summaryBody = [[
          estabDisplay,
          sumATC.toLocaleString(),
          sumATD.toLocaleString(),
          sumAPP > 0 ? sumAPP.toLocaleString() : "-",
          (sumATC + sumAPP).toLocaleString()
        ]];
      }
    }

    doc.autoTable({
      startY: currentY,
      head: summaryHead,
      body: summaryBody,
      foot: summaryFoot,
      theme: "grid",
      pageBreak: "avoid",
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontSize: 7.2,
        fontStyle: "bold",
        halign: "center",
        cellPadding: 1.8
      },
      footStyles: {
        fillColor: [226, 232, 240],
        textColor: [15, 23, 42],
        fontSize: 7.2,
        fontStyle: "bold",
        halign: "center",
        cellPadding: 1.8
      },
      styles: {
        fontSize: 7,
        cellPadding: 1.6,
        halign: "center"
      },
      columnStyles: {
        0: { halign: "left", fontStyle: "bold" }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = doc.lastAutoTable.finalY + 3;

    let sumAtcQ1 = 0, sumAtcQ2 = 0;
    let sumHisAtcQ1 = 0, sumHisAtdQ1 = 0, sumTriQ1 = 0, sumCitQ1 = 0;
    let sumHisAtcQ2 = 0, sumHisAtdQ2 = 0, sumTriQ2 = 0, sumCitQ2 = 0;

    // 4. TABLA 2: DESGLOSE DETALLADO DÍA A DÍA (01 AL 31) SI CORRESPONDE
    if (includeDaily && dailyData && dailyData[mKey] && dailyData[mKey].dias) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...primaryColor);
      doc.text(`2. REGISTRO Y DESGLOSE DETALLADO DÍA A DÍA (DÍAS 01 AL 31) — ${monthName} ${reportYear}`, 14, currentY);
      currentY += 2;

      if (hasSihce) {
        const dailyBody = [];
        for (let d = 1; d <= 16; d++) {
          const dLeft = (d < 10 ? "0" : "") + d;
          const leftInfo = mDaily.dias[dLeft] || { atc: 0, atd: 0, citas: 0, triajes: 0 };
          const leftAtc = Number(leftInfo.atc) || 0;
          const leftAtd = Number(leftInfo.atd) || 0;
          const leftTri = Number(leftInfo.triajes) || 0;
          const leftCit = Number(leftInfo.citas) || 0;
          const leftHisAtc = Math.max(0, leftAtc - leftTri - leftCit);

          sumHisAtcQ1 += leftHisAtc;
          sumHisAtdQ1 += leftAtd;
          sumTriQ1 += leftTri;
          sumCitQ1 += leftCit;
          sumAtcQ1 += leftAtc;

          const dRightNum = d + 16;
          let dRightStr = "—";
          let rightHisAtcStr = "—", rightHisAtdStr = "—", rightTriStr = "—", rightCitStr = "—", rightAtcStr = "—";

          if (dRightNum <= 31) {
            const dRight = (dRightNum < 10 ? "0" : "") + dRightNum;
            dRightStr = `Día ${dRight}`;
            const rightInfo = mDaily.dias[dRight] || { atc: 0, atd: 0, citas: 0, triajes: 0 };
            const rightAtc = Number(rightInfo.atc) || 0;
            const rightAtd = Number(rightInfo.atd) || 0;
            const rightTri = Number(rightInfo.triajes) || 0;
            const rightCit = Number(rightInfo.citas) || 0;
            const rightHisAtc = Math.max(0, rightAtc - rightTri - rightCit);

            sumHisAtcQ2 += rightHisAtc;
            sumHisAtdQ2 += rightAtd;
            sumTriQ2 += rightTri;
            sumCitQ2 += rightCit;
            sumAtcQ2 += rightAtc;

            rightHisAtcStr = rightHisAtc > 0 ? rightHisAtc.toLocaleString() : "-";
            rightHisAtdStr = rightAtd > 0 ? rightAtd.toLocaleString() : "-";
            rightTriStr = rightTri > 0 ? rightTri.toLocaleString() : "-";
            rightCitStr = rightCit > 0 ? rightCit.toLocaleString() : "-";
            rightAtcStr = rightAtc > 0 ? rightAtc.toLocaleString() : "-";
          }

          dailyBody.push([
            `Día ${dLeft}`,
            leftHisAtc > 0 ? leftHisAtc.toLocaleString() : "-",
            leftAtd > 0 ? leftAtd.toLocaleString() : "-",
            leftTri > 0 ? leftTri.toLocaleString() : "-",
            leftCit > 0 ? leftCit.toLocaleString() : "-",
            leftAtc > 0 ? leftAtc.toLocaleString() : "-",
            dRightStr,
            rightHisAtcStr,
            rightHisAtdStr,
            rightTriStr,
            rightCitStr,
            rightAtcStr
          ]);
        }

        doc.autoTable({
          startY: currentY,
          pageBreak: "avoid",
          head: [
            [
              { content: "PRIMERA QUINCENA (DÍAS 01 AL 16)", colSpan: 6, styles: { halign: "center", fillColor: [30, 64, 175], textColor: [255, 255, 255] } },
              { content: "SEGUNDA QUINCENA (DÍAS 17 AL 31)", colSpan: 6, styles: { halign: "center", fillColor: [15, 118, 110], textColor: [255, 255, 255] } }
            ],
            [
              { content: "DÍA", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
              { content: "HIS", colSpan: 2, styles: { halign: "center" } },
              { content: "TRIAJE", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
              { content: "CITAS", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
              { content: "TOTAL", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
              { content: "DÍA", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
              { content: "HIS", colSpan: 2, styles: { halign: "center" } },
              { content: "TRIAJE", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
              { content: "CITAS", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
              { content: "TOTAL", rowSpan: 2, styles: { valign: "middle", halign: "center" } }
            ],
            [
              "ATC", "ATD",
              "ATC", "ATD"
            ]
          ],
          body: dailyBody,
          foot: [
            [
              "SUBTOTAL",
              sumHisAtcQ1 > 0 ? sumHisAtcQ1.toLocaleString() : "-",
              sumHisAtdQ1 > 0 ? sumHisAtdQ1.toLocaleString() : "-",
              sumTriQ1 > 0 ? sumTriQ1.toLocaleString() : "-",
              sumCitQ1 > 0 ? sumCitQ1.toLocaleString() : "-",
              sumAtcQ1.toLocaleString(),
              "SUBTOTAL",
              sumHisAtcQ2 > 0 ? sumHisAtcQ2.toLocaleString() : "-",
              sumHisAtdQ2 > 0 ? sumHisAtdQ2.toLocaleString() : "-",
              sumTriQ2 > 0 ? sumTriQ2.toLocaleString() : "-",
              sumCitQ2 > 0 ? sumCitQ2.toLocaleString() : "-",
              sumAtcQ2.toLocaleString()
            ],
            [
              {
                content: `CONSOLIDADO DEL MES (${monthName}):  HIS: ${(sumHisAtcQ1 + sumHisAtcQ2).toLocaleString()} ATC / ${(sumHisAtdQ1 + sumHisAtdQ2).toLocaleString()} ATD   |   TRIAJES: ${(sumTriQ1 + sumTriQ2).toLocaleString()}   |   CITAS ADMISIÓN: ${(sumCitQ1 + sumCitQ2).toLocaleString()}   |   TOTAL ATC: ${(sumAtcQ1 + sumAtcQ2).toLocaleString()}`,
                colSpan: 12,
                styles: { halign: "center", fontStyle: "bold", fillColor: [241, 245, 249], textColor: [15, 23, 42], fontSize: 6.8 }
              }
            ]
          ],
          theme: "grid",
          headStyles: {
            fontSize: 6.8,
            fontStyle: "bold",
            halign: "center",
            textColor: [255, 255, 255],
            fillColor: [51, 65, 85],
            cellPadding: 1.2
          },
          footStyles: {
            fillColor: [226, 232, 240],
            textColor: [15, 23, 42],
            fontSize: 6.8,
            fontStyle: "bold",
            halign: "center",
            cellPadding: 1.2
          },
          styles: {
            fontSize: 6.8,
            cellPadding: 1.2,
            halign: "center"
          },
          columnStyles: {
            0: { halign: "center", fontStyle: "bold", cellWidth: 15 },
            1: { halign: "center", cellWidth: 14 },
            2: { halign: "center", cellWidth: 14 },
            3: { halign: "center", cellWidth: 15 },
            4: { halign: "center", cellWidth: 15 },
            5: { halign: "center", fontStyle: "bold", cellWidth: 18 },
            6: { halign: "center", fontStyle: "bold", cellWidth: 15 },
            7: { halign: "center", cellWidth: 14 },
            8: { halign: "center", cellWidth: 14 },
            9: { halign: "center", cellWidth: 15 },
            10: { halign: "center", cellWidth: 15 },
            11: { halign: "center", fontStyle: "bold", cellWidth: 18 }
          },
          margin: { left: 14, right: 14 }
        });

        currentY = doc.lastAutoTable.finalY + 2.5;
      } else {
        const dailyBody = [];
        for (let d = 1; d <= 16; d++) {
          const dLeft = (d < 10 ? "0" : "") + d;
          const leftInfo = mDaily.dias[dLeft] || { atc: 0, atd: 0 };
          const leftAtc = Number(leftInfo.atc) || 0;
          const leftAtd = Number(leftInfo.atd) || 0;
          sumAtcQ1 += leftAtc;

          const dRightNum = d + 16;
          let dRightStr = "—";
          let rightAtcStr = "—", rightAtdStr = "—";

          if (dRightNum <= 31) {
            const dRight = (dRightNum < 10 ? "0" : "") + dRightNum;
            dRightStr = `Día ${dRight}`;
            const rightInfo = mDaily.dias[dRight] || { atc: 0, atd: 0 };
            const rightAtc = Number(rightInfo.atc) || 0;
            const rightAtd = Number(rightInfo.atd) || 0;
            sumAtcQ2 += rightAtc;
            rightAtcStr = rightAtc > 0 ? rightAtc.toLocaleString() : "-";
            rightAtdStr = rightAtd > 0 ? rightAtd.toLocaleString() : "-";
          }

          dailyBody.push([
            `Día ${dLeft}`,
            leftAtc > 0 ? leftAtc.toLocaleString() : "-",
            leftAtd > 0 ? leftAtd.toLocaleString() : "-",
            dRightStr,
            rightAtcStr,
            rightAtdStr
          ]);
        }

        doc.autoTable({
          startY: currentY,
          pageBreak: "avoid",
          head: [
            [
              { content: "PRIMERA QUINCENA (DÍAS 01 AL 16)", colSpan: 3, styles: { halign: "center", fillColor: [30, 64, 175] } },
              { content: "SEGUNDA QUINCENA (DÍAS 17 AL 31)", colSpan: 3, styles: { halign: "center", fillColor: [15, 118, 110] } }
            ],
            ["DÍA", "ATC", "ATD", "DÍA", "ATC", "ATD"]
          ],
          body: dailyBody,
          foot: [
            [
              "SUBTOTAL Q1",
              sumAtcQ1.toLocaleString(),
              "-",
              "SUBTOTAL Q2",
              sumAtcQ2.toLocaleString(),
              "-"
            ]
          ],
          theme: "grid",
          headStyles: {
            fontSize: 6.5,
            fontStyle: "bold",
            halign: "center",
            textColor: [255, 255, 255],
            fillColor: [51, 65, 85]
          },
          footStyles: {
            fillColor: [226, 232, 240],
            textColor: [15, 23, 42],
            fontSize: 6.5,
            fontStyle: "bold",
            halign: "center"
          },
          styles: {
            fontSize: 6,
            cellPadding: 1,
            halign: "center"
          },
          columnStyles: {
            0: { halign: "center", fontStyle: "bold", cellWidth: 26 },
            1: { halign: "center", cellWidth: 33 },
            2: { halign: "center", cellWidth: 32 },
            3: { halign: "center", fontStyle: "bold", cellWidth: 26 },
            4: { halign: "center", cellWidth: 33 },
            5: { halign: "center", cellWidth: 32 }
          },
          margin: { left: 14, right: 14 }
        });

        currentY = doc.lastAutoTable.finalY + 2.5;
      }
    }

    // 5. NOTA DE CERTIFICACIÓN INSTITUCIONAL
    doc.setFontSize(5.6);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 116, 139);
    const certText = "* Certificación Oficial: Se certifica la producción combinada y detallada de atenciones del sistema HIS y registros de SIHCE de la Red Cusco Sur. Cualquier adulteración física o discrepancia con el sistema digital anula la validez del presente documento.";
    const splitCert = doc.splitTextToSize(certText, 182);
    doc.text(splitCert, 14, currentY);
    currentY += (splitCert.length * 2.8) + 1;

    // 6. FIRMAS INSTITUCIONALES Y CÓDIGO QR EN PARALELO
    const signLineY = includeDaily ? 246 : 175;

    // Línea 1: Firma Profesional
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.35);
    doc.line(18, signLineY, 70, signLineY);
    doc.setFontSize(6.8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("FIRMA DEL PROFESIONAL", 44, signLineY + 3.8, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.8);
    doc.setTextColor(71, 85, 105);
    doc.text(String(user.nombre || "").toUpperCase().substring(0, 30), 44, signLineY + 7, { align: "center" });
    doc.text(`DNI: ${user.dni || "-"}`, 44, signLineY + 10.2, { align: "center" });

    // Línea 2: Encargado del Área de Estadística / Punto de digitación
    doc.line(78, signLineY, 135, signLineY);
    doc.setFontSize(6.8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("ENCARGADO DEL ÁREA DE ESTADÍSTICA", 106.5, signLineY + 3.8, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(71, 85, 105);
    doc.text("Punto de digitación", 106.5, signLineY + 7, { align: "center" });

    // QR Code a la derecha
    try {
      if (typeof qrcode === "function") {
        const verifyBase = window.location.href.replace(/[^/]*$/, "") + "validar.html";
        const estabParam = isConsolidated ? (activeEstabsInPeriod.length > 1 ? "Consolidado Red Cusco Sur" : estabDisplay) : selectedEstab;
        let qrUrl = `${verifyBase}?dni=${user.dni}&p=${encodeURIComponent(user.nombre || "")}&e=${encodeURIComponent(estabParam)}&m=${mKey}&atc=${sumATC}&atd=${sumATD}&app=${sumAPP}&his=${sumPeriodHis}&tri=${sumPeriodTriajes}&cit=${sumPeriodCitas}&y=${reportYear}&d=${includeDaily ? 1 : 0}&col=${encodeURIComponent(user.colegio || "")}&mr=${encodeURIComponent(user.microred || "")}`;
        if (includeDaily) {
          qrUrl += `&q1=${sumAtcQ1}&q2=${sumAtcQ2}`;
        }

        const qr = qrcode(0, "M");
        qr.addData(qrUrl);
        qr.make();
        const qrDataUrl = qr.createDataURL(4, 0);

        doc.addImage(qrDataUrl, "PNG", 154, signLineY - 18, 26, 26);
        doc.setFontSize(6);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...primaryColor);
        doc.text("VERIFICACIÓN DIGITAL", 167, signLineY + 11, { align: "center" });
        doc.setFontSize(4.8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(148, 163, 184);
        doc.text("Escanear código QR para cotejo", 167, signLineY + 13.5, { align: "center" });
        doc.text("con la base de datos oficial", 167, signLineY + 16, { align: "center" });
      }
    } catch (e) {
      console.warn("QR Error:", e);
    }

    // 7. PIE DE PÁGINA (GARANTIZADO PÁGINA 1 DE 1)
    const nowDateTime = new Date().toLocaleString("es-PE", {
      dateStyle: "short",
      timeStyle: "medium"
    });
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(14, 282, 196, 282);

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(CONFIG.AUTOR, 14, 287);
    doc.text(`Generado: ${nowDateTime}`, 105, 287, { align: "center" });
    doc.text("Página 1 de 1", 196, 287, { align: "right" });

    // Guardar o devolver vista previa del archivo PDF
    const cleanDni = String(user.dni || "reporte");
    const estabSuffix = isConsolidated ? "Consolidado" : selectedEstab.replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `Reporte40_${cleanDni}_${monthName}_${estabSuffix}_${new Date().toISOString().slice(0, 10)}.pdf`;
    if (previewOnly) {
      const blob = doc.output("blob");
      return { blobUrl: URL.createObjectURL(blob), filename };
    }
    doc.save(filename);

    return true;
  },

  /**
   * Genera y descarga el Reporte Oficial Personalizado SERUMS (Multi-Anual)
   * Exclusivo para Reporte 40 (HIS General: ATC, ATD y APP). Sin Citas ni Triajes.
   */
  async generateSerums({ user, periodLabel, monthsList, selectedEstab = "ALL", totals }) {
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

    const primaryColor = [30, 64, 175];   // Azul institucional #1e40af
    const secondaryColor = [71, 85, 105]; // Slate
    const accentColor = [241, 245, 249];  // Gris claro #f1f5f9
    const isConsolidated = selectedEstab === "ALL";

    let currentY = 16;

    // 1. ENCABEZADO INSTITUCIONAL
    doc.setFontSize(10.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...primaryColor);
    doc.text(CONFIG.INSTITUCION || "RED DE SERVICIOS DE SALUD CUSCO SUR", 105, currentY, { align: "center" });

    currentY += 4.5;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...secondaryColor);
    doc.text("GOBIERNO REGIONAL CUSCO — DIRECCIÓN REGIONAL DE SALUD", 105, currentY, { align: "center" });

    currentY += 5;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("REPORTE OFICIAL DE PRODUCCIÓN ASISTENCIAL — SERUMS", 105, currentY, { align: "center" });

    currentY += 4.5;
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...primaryColor);
    doc.text(`Período de Servicio: ${periodLabel}`, 105, currentY, { align: "center" });

    currentY += 4;
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...secondaryColor);
    const scopeText = isConsolidated 
      ? "Ámbito: CONSOLIDADO RED CUSCO SUR (TODOS LOS ESTABLECIMIENTOS ASIGNADOS)"
      : `Ámbito: ESTABLECIMIENTO DE SALUD ${selectedEstab}`;
    doc.text(scopeText, 105, currentY, { align: "center" });

    // Línea divisoria decorativa
    currentY += 3.5;
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.8);
    doc.line(14, currentY, 196, currentY);

    // 2. CAJA DE DATOS DEL PROFESIONAL SERUMS
    currentY += 4.5;
    const boxHeight = 28;
    doc.setFillColor(...accentColor);
    doc.roundedRect(14, currentY, 182, boxHeight, 2, 2, "F");
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(14, currentY, 182, boxHeight, 2, 2, "D");

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...secondaryColor);
    doc.text("DATOS DEL PROFESIONAL SERUMS", 18, currentY + 5);

    // Grid de datos
    doc.setFontSize(8);
    const col1X = 18;
    const col2X = 105;

    // Fila 1
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Apellidos y Nombres:", col1X, currentY + 11);
    doc.setFont("helvetica", "normal");
    doc.text(String(user.nombre || "-").toUpperCase(), col1X + 32, currentY + 11);

    doc.setFont("helvetica", "bold");
    doc.text("DNI / Doc.:", col2X, currentY + 11);
    doc.setFont("helvetica", "normal");
    doc.text(String(user.dni || "-"), col2X + 18, currentY + 11);

    // Fila 2
    doc.setFont("helvetica", "bold");
    doc.text("Colegio Profesional:", col1X, currentY + 17);
    doc.setFont("helvetica", "normal");
    doc.text(String(user.colegio || "No registrado"), col1X + 32, currentY + 17);

    doc.setFont("helvetica", "bold");
    doc.text("MicroRed:", col2X, currentY + 17);
    doc.setFont("helvetica", "normal");
    doc.text(String(user.microred || "-"), col2X + 18, currentY + 17);

    // Fila 3
    doc.setFont("helvetica", "bold");
    doc.text("Establecimiento Sede:", col1X, currentY + 23);
    doc.setFont("helvetica", "normal");
    doc.text(String(user.establecimiento || "-"), col1X + 32, currentY + 23);

    doc.setFont("helvetica", "bold");
    doc.text("Modalidad:", col2X, currentY + 23);
    doc.setFont("helvetica", "normal");
    doc.text("SERUMS REMUNERADO / EQUIVALENTE", col2X + 18, currentY + 23);

    currentY += boxHeight + 4;

    // 3. TARJETAS DE RESUMEN KPI ACUMULADO
    const kpiWidth = 43;
    const kpiHeight = 16;
    const kpiY = currentY;

    // KPI 1: Total ATC
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(14, kpiY, kpiWidth, kpiHeight, 1.5, 1.5, "F");
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 64, 175);
    doc.text("ATENCIONES TOTALES (ATC)", 14 + kpiWidth / 2, kpiY + 5, { align: "center" });
    doc.setFontSize(11);
    doc.text(Number(totals.total_atc || 0).toLocaleString(), 14 + kpiWidth / 2, kpiY + 12.5, { align: "center" });

    // KPI 2: Total ATD
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(60, kpiY, kpiWidth, kpiHeight, 1.5, 1.5, "F");
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(21, 128, 61);
    doc.text("ATENDIDOS (ATD)", 60 + kpiWidth / 2, kpiY + 5, { align: "center" });
    doc.setFontSize(11);
    doc.text(Number(totals.total_atd || 0).toLocaleString(), 60 + kpiWidth / 2, kpiY + 12.5, { align: "center" });

    // KPI 3: Total APP
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(106, kpiY, kpiWidth, kpiHeight, 1.5, 1.5, "F");
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(180, 83, 9);
    doc.text("ACTIVIDADES PROMOCIÓN (APP)", 106 + kpiWidth / 2, kpiY + 5, { align: "center" });
    doc.setFontSize(11);
    doc.text(Number(totals.total_app || 0).toLocaleString(), 106 + kpiWidth / 2, kpiY + 12.5, { align: "center" });

    // KPI 4: Total Producción General
    doc.setFillColor(245, 243, 255);
    doc.roundedRect(152, kpiY, kpiWidth, kpiHeight, 1.5, 1.5, "F");
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(109, 40, 217);
    doc.text("TOTAL GENERAL PRODUCCIÓN", 152 + kpiWidth / 2, kpiY + 5, { align: "center" });
    doc.setFontSize(11);
    doc.text(Number(totals.total_prod || 0).toLocaleString(), 152 + kpiWidth / 2, kpiY + 12.5, { align: "center" });

    currentY += kpiHeight + 6;

    // 4. TABLA DETALLADA CRONOLÓGICA MES A MES (Reporte 40 HIS General)
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...primaryColor);
    doc.text("CONSOLIDADO MENSUAL DE PRODUCCIÓN — REPORTE 40 (HIS GENERAL)", 14, currentY);

    currentY += 2;

    const tableHeaders = [
      ["N°", "Periodo (Mes y Año)", "Atenciones Médicas (ATC)", "Atendidos (ATD)", "Actividades APP", "Total Mes"]
    ];

    const tableData = monthsList.map((m, idx) => [
      String(idx + 1),
      m.fullLabel,
      Number(m.atc || 0).toLocaleString(),
      Number(m.atd || 0).toLocaleString(),
      Number(m.app || 0).toLocaleString(),
      Number((m.atc || 0) + (m.app || 0)).toLocaleString()
    ]);

    // Fila de Total Acumulado
    const tableFooters = [
      [
        "",
        "TOTAL ACUMULADO SERUMS",
        Number(totals.total_atc || 0).toLocaleString(),
        Number(totals.total_atd || 0).toLocaleString(),
        Number(totals.total_app || 0).toLocaleString(),
        Number(totals.total_prod || 0).toLocaleString()
      ]
    ];

    doc.autoTable({
      startY: currentY,
      head: tableHeaders,
      body: tableData,
      foot: tableFooters,
      theme: "grid",
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.1
      },
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center"
      },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: primaryColor,
        fontStyle: "bold",
        halign: "center"
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 12 },
        1: { halign: "left", cellWidth: 50, fontStyle: "bold" },
        2: { halign: "center", cellWidth: 30 },
        3: { halign: "center", cellWidth: 30 },
        4: { halign: "center", cellWidth: 30 },
        5: { halign: "center", cellWidth: 30, fontStyle: "bold" }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = doc.lastAutoTable.finalY + 6;

    // Si queda poco espacio para la certificación y firmas, agregar página
    if (currentY > 215) {
      doc.addPage();
      currentY = 20;
    }

    // 5. NOTA DE CERTIFICACIÓN INSTITUCIONAL
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, currentY, 182, 14, 1.5, 1.5, "F");
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.roundedRect(14, currentY, 182, 14, 1.5, 1.5, "D");

    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...secondaryColor);
    doc.text(
      "CERTIFICACIÓN: Se expide el presente reporte oficial de producción asistencial a solicitud de la parte interesada para los fines correspondientes",
      17, currentY + 5
    );
    doc.text(
      "al informe final de labores y trámite de Resolución de Término de SERUMS, según registros del Sistema de Información HIS de la Red Cusco Sur.",
      17, currentY + 10
    );

    currentY += 20;

    // 6. BLOQUE DE FIRMAS INSTITUCIONALES
    const signBoxY = currentY + 12;
    // Línea Firma 1 (Estadística / Punto de Digitación)
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.4);
    doc.line(25, signBoxY, 85, signBoxY);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("ENCARGADO DEL ÁREA DE ESTADÍSTICA", 55, signBoxY + 4, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...secondaryColor);
    doc.text("Punto de digitación", 55, signBoxY + 8, { align: "center" });

    // Línea Firma 2 (Dirección Ejecutiva)
    doc.line(125, signBoxY, 185, signBoxY);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("DIRECCIÓN EJECUTIVA", 155, signBoxY + 4, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...secondaryColor);
    doc.text("Red de Servicios de Salud Cusco Sur", 155, signBoxY + 8, { align: "center" });

    // 7. PIE DE PÁGINA EN TODAS LAS PÁGINAS
    const totalPages = doc.internal.getNumberOfPages();
    const nowDateTime = new Date().toLocaleString();

    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(14, 282, 196, 282);

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184);

      // Firma institucional
      doc.text(CONFIG.AUTOR, 14, 287);

      // Fecha y hora
      doc.text(`Generado: ${nowDateTime} — Vía Panel Administrador`, 105, 287, { align: "center" });

      // Numeración
      doc.text(`Página ${i} de ${totalPages}`, 196, 287, { align: "right" });
    }

    // Descargar PDF
    const cleanDni = String(user.dni || "serums");
    const filename = `Reporte_SERUMS_${cleanDni}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);

    return true;
  }
};
