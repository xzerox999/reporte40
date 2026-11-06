# 🚀 Guía de Despliegue de Backend (Google Sheets + Apps Script)

Esta guía te explica cómo tener tu API gratuita lista en 3 minutos.

---

## Paso 1: Crear el Google Sheet

1. Abre tu navegador y ve a [sheets.new](https://sheets.new).
2. Ponle de título arriba: **`BD_REPORTE_40`**.

---

## Paso 2: Importar los datos del Excel

En la carpeta `e:\Otros\reporte40\data\` ya se crearon los archivos listos:

1. **Hoja 1: `USUARIOS`**
   - En tu Google Sheet, renombra la primera hoja a **`USUARIOS`**.
   - Menú: **Archivo > Importar > Subir**.
   - Selecciona el archivo `data/USUARIOS.csv`.
   - Tipo de importación: **Reemplazar la hoja actual** (separador detectado automáticamente).
   - ¡Listo! Tendrás a todos los usuarios con su DNI y el Administrador (`46638223` / clave `comatose`).

2. **Hoja 2: `DATA_ATD_ATC`**
   - Crea una nueva hoja abajo haciendo clic en el signo **`+`** y llámala **`DATA_ATD_ATC`**.
   - Menú: **Archivo > Importar > Subir**.
   - Selecciona el archivo `data/DATA_ATD_ATC.csv`.
   - Tipo de importación: **Reemplazar la hoja actual**.

3. **Hoja 3: `DATA_APP`**
   - Crea otra hoja llamada **`DATA_APP`**.
   - Menú: **Archivo > Importar > Subir**.
   - Selecciona el archivo `data/DATA_APP.csv`.
   - Tipo de importación: **Reemplazar la hoja actual**.

4. **Hoja 4: `LOG_DESCARGAS`**
   - Crea una hoja llamada **`LOG_DESCARGAS`**.
   - En la fila 1 escribe los encabezados:
     `id` | `timestamp` | `dni` | `personal` | `establecimiento` | `meses` | `tipo_reporte` | `ip`

5. **Hoja 5: `CONFIG`**
   - Crea una hoja llamada **`CONFIG`**.
   - En la fila 1: `clave` | `valor` | `descripcion`
   - En la fila 2: `hoja_atd_atc` | `DATA_ATD_ATC` | `Nombre de hoja de atenciones`
   - En la fila 3: `hoja_app` | `DATA_APP` | `Nombre de hoja de APP`
   - En la fila 4: `hoja_usuarios` | `USUARIOS` | `Nombre de hoja de usuarios`
   - En la fila 5: `hoja_logs` | `LOG_DESCARGAS` | `Nombre de hoja de logs`

*(Si algún día cambias los nombres de las hojas, solo actualizas la columna "valor" en esta hoja CONFIG)*

---

## Paso 3: Pegar el código Apps Script

1. En tu Google Sheet, ve al menú: **Extensiones > Apps Script**.
2. Borra cualquier código que aparezca en el editor (`myFunction`).
3. Abre el archivo `google-apps-script/Code.gs` de tu computadora, copia **TODO** su contenido y pégalo en el editor de Apps Script.
4. Haz clic en el icono del disquete **Guardar proyecto** (o `Ctrl + S`).

---

## Paso 4: Desplegar como Web App (API pública)

1. En la esquina superior derecha de Apps Script, haz clic en el botón azul **Implementar** > **Nueva implementación**.
2. Haz clic en el icono de engranaje ⚙️ al lado izquierdo y selecciona **Aplicación web**.
3. Completa los campos:
   - **Descripción**: `API Reporte 40`
   - **Ejecutar como**: `Yo (tu correo de Google)`
   - **Quién tiene acceso**: **`Cualquier persona`** (Anyone)  *(Esto es indispensable para que la página de GitHub Pages pueda comunicarse sin pedir inicio de sesión de Google)*.
4. Haz clic en **Implementar**.
5. Google te pedirá "Autorizar acceso". Haz clic en **Revisar permisos** > Selecciona tu cuenta > Haz clic en **Configuración avanzada** (Advanced) > Haz clic en **Ir a Proyecto (no seguro)** > Haz clic en **Permitir**.
6. Se abrirá una ventana con la **URL de la aplicación web**:
   Ejemplo: `https://script.google.com/macros/s/AKfycbx.../exec`
7. **¡Copia esa URL!**

---https://script.google.com/macros/s/AKfycbyt8ijYhPLtgBQxiAUNNaUxGvj09un1CjzzrbtL7EkzbMMHy1eNrojbi8Rz27ba3fFI/exec

## Paso 5: Conectar con el Frontend

1. Abre el archivo `js/config.js` en tu proyecto.
2. Pega tu URL en la variable `API_URL`:
   ```javascript
   const CONFIG = {
     API_URL: "https://script.google.com/macros/s/AKfycbx.../exec",
     DEMO_MODE: false // Cambiar a false para usar Google Sheets real
   };
   ```
3. Guarda el archivo. ¡Y listo! Todo tu sistema ya estará conectado en tiempo real.

