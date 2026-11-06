# 🏥 Sistema Reporte 40 — Red de Servicios de Salud Cusco Sur

Sistema web moderno, gratuito y responsivo diseñado para la consulta individual de producción de personal de salud (Atenciones ATD/ATC y actividades APP) y descarga de reportes oficiales en formato PDF profesional.

**Autor:** Hecho por **xzerox99**

---

## ✨ Características Principales

- 📱 **100% Responsivo**: Funciona perfectamente en celulares, tablets y computadoras de escritorio.
- 🌓 **Tema Claro y Oscuro**: Switch integrado con persistencia automática de preferencia en el dispositivo.
- 🎨 **Interfaz Moderna**: Animaciones suaves, tarjetas interactivas, componentes accesibles y diseño sobrio sin logos invasivos.
- 🔐 **Autenticación Segura**: 
  - Personal ingresa con su **DNI** como usuario y contraseña inicial.
  - Opción dentro del sistema para cambiar su contraseña en cualquier momento.
  - Contraseñas almacenadas con cifrado **SHA-256**.
- 📅 **Selector de Meses Flexible**: El personal puede elegir uno, varios o todos los meses (Enero a Noviembre 2026).
- 📄 **Reporte PDF Profesional**:
  - Descarga inmediata con tipografía institucional, datos del profesional, establecimiento, microred, colegio (si aplica) y detalle de atenciones.
  - Pie de página institucional con la leyenda **`hecho por xzerox99`** y numeración de páginas.
- 👑 **Panel Administrativo Completo**:
  - **Auditoría de Descargas**: Registro en tiempo real de qué personal descargó su reporte, qué meses incluyó y fecha/hora exacta.
  - **Gestión de Personal**: Búsqueda en tiempo real y opción de restablecer la contraseña a cualquier usuario en 1 clic.
  - **Exportación a Excel**: Botón para exportar el log de auditoría o toda la base de datos a `.xlsx`.

---

## 🔑 Credenciales por Defecto

| Rol | Usuario (DNI) | Contraseña |
|---|---|---|
| **Administrador** | `46638223` | `comatose` |
| **Personal de Salud** | Su propio número de DNI | Su propio número de DNI |

---

## 🚀 Cómo Desplegar en GitHub Pages (Gratis)

1. Ve a [github.com/new](https://github.com/new) y crea un repositorio público llamado **`reporte40`**.
2. Abre una terminal en esta carpeta y sube los archivos:
   ```bash
   git init
   git add .
   git commit -m "Sistema Reporte 40 inicial"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/reporte40.git
   git push -u origin main
   ```
3. En GitHub, entra a tu repositorio > **Settings** (Configuración) > pestaña **Pages** en el menú izquierdo.
4. En **Branch**, selecciona **`main`** y carpeta **`/(root)`**, luego haz clic en **Save**.
5. ¡Listo! En 1 minuto tu página estará activa en:
   👉 **`https://TU_USUARIO.github.io/reporte40/`**

---

## 📊 Cómo Conectar con Google Sheets (Base de Datos)

La guía detallada paso a paso está en [`google-apps-script/README_APPS_SCRIPT.md`](google-apps-script/README_APPS_SCRIPT.md).

1. Crea tu Google Sheet en blanco en [sheets.new](https://sheets.new).
2. Importa los archivos CSV que ya generamos en `data/`:
   - `data/USUARIOS.csv` → Hoja `USUARIOS`
   - `data/DATA_ATD_ATC.csv` → Hoja `DATA_ATD_ATC`
   - `data/DATA_APP.csv` → Hoja `DATA_APP`
3. Ve a **Extensiones > Apps Script**, pega el código de `google-apps-script/Code.gs` y dale **Implementar > Nueva implementación > Aplicación web** (Acceso: Cualquier persona).
4. Pega la URL generada en `js/config.js` (`API_URL`).

---

## 📂 Estructura del Proyecto

```text
reporte40/
├── index.html                   # Página de Login (Tema claro/oscuro + animaciones)
├── dashboard.html               # Portal del Personal (Selección de meses + tablas + PDF)
├── admin.html                   # Panel Administrativo (Logs + reseteo de claves + exportar Excel)
├── css/
│   └── styles.css               # Estilos responsivos, temas y animaciones
├── js/
│   ├── config.js                # Configuración de URLs y meses
│   ├── theme.js                 # Manejador de tema Claro/Oscuro
│   ├── auth.js                  # Manejador de sesiones y cifrado SHA-256
│   ├── api.js                   # Cliente API con soporte offline/demo
│   ├── dashboard.js             # Lógica del dashboard de usuario
│   ├── admin.js                 # Lógica del panel administrador
│   └── pdf-generator.js         # Generador de PDF institucional con jsPDF
├── google-apps-script/
│   ├── Code.gs                  # Código backend completo para Google Apps Script
│   └── README_APPS_SCRIPT.md    # Manual de despliegue en Google Sheets
├── scripts/
│   └── prepare_sheets_data.py   # Script ETL que procesa REPORTE 40 2026.xlsx
├── data/                        # Archivos listos para importar en Google Sheets
│   ├── USUARIOS.csv
│   ├── DATA_ATD_ATC.csv
│   ├── DATA_APP.csv
│   └── demo_data.json
└── README.md
```

