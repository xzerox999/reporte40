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
  async generate(user, selectedMonths, atdData, appData, fullAtdData = null, selectedEstab = "ALL", dailyData = null, includeDaily = false) {
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
    // 5.5 TABLA OPCIONAL: DESGLOSE DIARIO (DÍA 01 AL 31)
    // Se activa cuando el usuario consulta 1 mes y marca desglose diario
    // -------------------------------------------------------------
    if (includeDaily && selectedMonths.length === 1 && dailyData) {
      const mKey = selectedMonths[0];
      const mDaily = dailyData[mKey];
      if (mDaily && mDaily.dias) {
        const monthName = (CONFIG.MESES.find((m) => m.key === mKey)?.label || mKey).toUpperCase();

        // Si queda poco espacio en la página actual, agregar nueva página
        if (currentY > 165) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFontSize(9.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...primaryColor);
        doc.text(`DESGLOSE DETALLADO DÍA A DÍA — MES: ${monthName} ${CONFIG.ANIO}`, 14, currentY);
        currentY += 4;

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
