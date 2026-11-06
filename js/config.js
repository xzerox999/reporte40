/**
 * =====================================================================
 * CONFIGURACIÓN DEL SISTEMA REPORTE 40
 * =====================================================================
 */

const CONFIG = {
  // Pega aquí la URL de tu Google Apps Script una vez desplegado.
  // Ejemplo: "https://script.google.com/macros/s/AKfycbx.../exec"
  API_URL: "https://script.google.com/macros/s/AKfycbyt8ijYhPLtgBQxiAUNNaUxGvj09un1CjzzrbtL7EkzbMMHy1eNrojbi8Rz27ba3fFI/exec",

  // Modo Demo: si es true o si API_URL está vacío, el sistema utilizará
  // el archivo data/demo_data.json generado con los datos reales del Excel.
  // Esto permite usar y probar la página inmediatamente en GitHub Pages sin configuración previa.
  USE_DEMO_FALLBACK: true,

  // Datos institucionales
  INSTITUCION: "RED DE SERVICIOS DE SALUD CUSCO SUR",
  TITULO_SISTEMA: "REPORTE 40 — PRODUCCIÓN DE PERSONAL",
  ANIO: "2026",
  AUTOR: "hecho por xzerox99",

  // Meses disponibles en el reporte
  MESES: [
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
    { key: "NOV", label: "Noviembre" }
  ],

  // Admin por defecto
  ADMIN_DEFAULT_DNI: "46638223"
};

