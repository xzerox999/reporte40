"""
Módulo de Actualización Interactivo de Producción Diaria (DATA_DIARIO)
=====================================================================
Flujo exacto:
  1. Te pide seleccionar el archivo Excel.
  2. Lee e identifica los bloques de meses presentes en la hoja 'ipress personal x dia'.
  3. Te muestra los meses detectados con su cantidad de profesionales.
  4. Te pregunta: "¿Qué mes deseas procesar ahora?".
  5. Extrae la producción diaria completa (01 al 31) del mes que elegiste.
  6. Te muestra el resumen detallado (registros reemplazados y nuevos agregados).
  7. Te pregunta: "¿Deseas subir este mes directamente a Google Sheets?".
  8. Te pregunta: "¿Deseas procesar otro mes?".
     - Si dices SÍ: vuelve a preguntarte el mes.
     - Si dices NO: finaliza el programa limpiamente.

Autor: hecho por xzerox99
"""

import os
import sys
import json
import csv
import time
import urllib.request
import urllib.parse
from collections import defaultdict
from datetime import datetime
import openpyxl

MONTH_NAME_MAP = {
    'enero': 'ENE', 'febrero': 'FEB', 'marzo': 'MAR', 'abril': 'ABR',
    'mayo': 'MAY', 'junio': 'JUN', 'julio': 'JUL', 'agosto': 'AGO',
    'setiembre': 'SET', 'septiembre': 'SET', 'octubre': 'OCT',
    'noviembre': 'NOV', 'diciembre': 'DIC'
}

MONTH_KEY_TO_NAME = {
    'ENE': 'enero', 'FEB': 'febrero', 'MAR': 'marzo', 'ABR': 'abril',
    'MAY': 'mayo', 'JUN': 'junio', 'JUL': 'julio', 'AGO': 'agosto',
    'SET': 'setiembre', 'OCT': 'octubre', 'NOV': 'noviembre', 'DIC': 'diciembre'
}

MESES_ORDEN = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
               'JUL', 'AGO', 'SET', 'OCT', 'NOV', 'DIC']


def seleccionar_archivo_excel():
    """Abre un diálogo nativo de Windows para seleccionar el archivo Excel."""
    if len(sys.argv) > 1 and os.path.exists(sys.argv[1]):
        return os.path.abspath(sys.argv[1])

    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        archivo = filedialog.askopenfilename(
            title="Selecciona el archivo Excel del Reporte 40",
            filetypes=[("Archivos Excel", "*.xlsx *.xlsm *.xls"), ("Todos los archivos", "*.*")]
        )
        root.destroy()
        if archivo and os.path.exists(archivo):
            return os.path.abspath(archivo)
    except Exception as e:
        print(f"[!] Aviso al abrir selector gráfico: {e}")

    default_path = r"E:\Otros\reporte40\REPORTE 40 2026.xlsx"
    if os.path.exists(default_path):
        return os.path.abspath(default_path)
    return None


def obtener_api_url():
    """Lee la API_URL desde config.js."""
    config_path = r"E:\Otros\reporte40\js\config.js"
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                for line in f:
                    if "API_URL:" in line:
                        parts = line.split(":", 1)
                        if len(parts) > 1:
                            val = parts[1].replace('"', '').replace("'", '').replace(',', '').strip()
                            if val.startswith("http"):
                                return val
        except Exception:
            pass
    return "https://script.google.com/macros/s/AKfycbyt8ijYhPLtgBQxiAUNNaUxGvj09un1CjzzrbtL7EkzbMMHy1eNrojbi8Rz27ba3fFI/exec"


def subir_a_google_sheets(rows_to_upload, mes_key):
    """
    Sube los datos diarios directamente a Google Sheets mediante Google Apps Script.
    Envía en paquetes de 400 filas para garantizar estabilidad y evitar timeouts.
    """
    api_url = obtener_api_url()
    admin_dni = "46638223"
    mes_nombre = MONTH_KEY_TO_NAME.get(mes_key, mes_key).upper()

    print("\n" + "=" * 70)
    print(f"   ENVIANDO PRODUCCIÓN DE {mes_nombre} ({mes_key}) A GOOGLE SHEETS")
    print("=" * 70)
    print(f"  Endpoint: {api_url[:65]}...")
    print(f"  Filas a sincronizar: {len(rows_to_upload)}")
    print("-" * 70)

    chunk_size = 400
    total_chunks = (len(rows_to_upload) + chunk_size - 1) // chunk_size

    for idx in range(total_chunks):
        start = idx * chunk_size
        end = min(start + chunk_size, len(rows_to_upload))
        chunk_rows = rows_to_upload[start:end]

        payload = {
            "action": "adminSyncDiario",
            "adminDni": admin_dni,
            "replaceMonths": [mes_key] if idx == 0 else [],
            "rows": chunk_rows
        }

        print(f"  -> Enviando paquete {idx + 1} de {total_chunks} ({len(chunk_rows)} filas)...", end="", flush=True)

        try:
            req_data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                api_url,
                data=req_data,
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                resp_text = resp.read().decode("utf-8")
                try:
                    res_json = json.loads(resp_text)
                    if res_json.get("success"):
                        print(" [OK]")
                    else:
                        print(f" [AVISO: {res_json.get('message', 'Desconocido')}]")
                except Exception:
                    print(" [OK (Recibido)]")
        except Exception as e:
            print(f"\n  [!] Error de conexión enviando lote {idx + 1}: {e}")
            return False

        time.sleep(0.4)

    print(f"\n  [✓] ¡Mes {mes_nombre} sincronizado exitosamente en Google Sheets!")
    return True


def escanear_bloques_de_meses(excel_path):
    """
    Escanea la hoja 'ipress personal x dia' y extrae todos los bloques de meses
    junto con sus filas de datos, sin cargar todo en memoria a la vez.
    """
    wb = openpyxl.load_workbook(excel_path, read_only=True, data_only=True)
    if 'ipress personal x dia' not in wb.sheetnames:
        wb.close()
        return None, {}

    ws = wb['ipress personal x dia']

    # Estructura: mes_key -> { 'header_days': [...], 'day_cols': [...], 'filas_personal': [(dni, nom, r_raw)] }
    bloques_mes = {}
    current_m_key = None
    day_cols = []
    header_days_saved = None

    for r_raw in ws.iter_rows(values_only=True):
        if not r_raw or not any(r_raw):
            continue

        c0 = str(r_raw[0]).strip() if r_raw[0] is not None else ""
        c1 = str(r_raw[1]).strip() if len(r_raw) > 1 and r_raw[1] is not None else ""

        # Detección de celda de mes (ej: mes | agosto o mes | setiembre)
        if c0.lower() == 'mes' and c1:
            m_l = c1.lower()
            current_m_key = MONTH_NAME_MAP.get(m_l, m_l.upper()[:3])
            day_cols = []
            header_days_saved = None
            if current_m_key not in bloques_mes:
                bloques_mes[current_m_key] = {
                    'mes_nombre': c1,
                    'day_cols': [],
                    'personal': []
                }
            continue

        # Detección de cabecera de números de días (01, 02, ..., 31)
        if current_m_key and not day_cols and not header_days_saved:
            r_strs = [str(x).strip() if x is not None else '' for x in r_raw]
            nums_found = [x for x in r_strs if x.isdigit() and 1 <= int(x) <= 31]
            if len(nums_found) >= 5:
                header_days_saved = r_strs
                continue

        # Detección de fila de subtipos ATC / ATD
        if current_m_key and header_days_saved and not day_cols:
            r_strs = [str(x).strip() if x is not None else '' for x in r_raw]
            if any('ATC' in x.upper() or 'ATD' in x.upper() for x in r_strs):
                for idx in range(2, len(r_raw)):
                    d_val = header_days_saved[idx] if idx < len(header_days_saved) else ''
                    t_val = r_strs[idx] if idx < len(r_strs) else ''

                    if d_val.isdigit():
                        d_norm = d_val.zfill(2)
                    else:
                        d_norm = d_val

                    t_norm = 'atc' if 'ATC' in t_val.upper() else ('atd' if 'ATD' in t_val.upper() else '')
                    if d_norm and t_norm:
                        day_cols.append((idx, d_norm, t_norm))
                    elif d_val and ('Total' in d_val or 'TOTAL' in d_val):
                        if 'ATC' in d_val.upper() or 'ATC' in t_val.upper():
                            day_cols.append((idx, 'TOTAL', 'atc'))
                        elif 'ATD' in d_val.upper() or 'ATD' in t_val.upper():
                            day_cols.append((idx, 'TOTAL', 'atd'))
                header_days_saved = None
                bloques_mes[current_m_key]['day_cols'] = list(day_cols)
                continue

        # Filas de personal
        if current_m_key and day_cols and c0 and 'Total' not in c0 and 'Numero' not in c0:
            d_dni = c0.replace('.0', '').replace(',', '').strip()
            if d_dni.isdigit() and len(d_dni) >= 6:
                d_nombre = c1
                bloques_mes[current_m_key]['personal'].append((d_dni, d_nombre, r_raw))

    wb.close()
    return ws.title, bloques_mes


def procesar_un_mes(bloque_data, m_key):
    """Parsea las filas del bloque seleccionado a la estructura diaria (01 al 31)."""
    day_cols = bloque_data['day_cols']
    filas_personal = bloque_data['personal']
    registros = {}

    for d_dni, d_nombre, r_raw in filas_personal:
        dias_dict = {str(d).zfill(2): {'atc': 0, 'atd': 0, 'citas': 0, 'triajes': 0} for d in range(1, 32)}
        tot_atc = 0
        tot_atd = 0

        for c_idx, d_str, t_str in day_cols:
            v = r_raw[c_idx] if c_idx < len(r_raw) and r_raw[c_idx] is not None else 0
            try:
                v_int = int(round(float(v)))
            except (ValueError, TypeError):
                v_int = 0

            if d_str == 'TOTAL':
                if t_str == 'atc':
                    tot_atc = v_int
                else:
                    tot_atd = v_int
            elif d_str in dias_dict:
                dias_dict[d_str][t_str] = v_int

        if tot_atc == 0:
            tot_atc = sum(v['atc'] for v in dias_dict.values())
        if tot_atd == 0:
            tot_atd = sum(v['atd'] for v in dias_dict.values())

        registros[d_dni] = (d_nombre, {
            'mes': m_key,
            'dias': dias_dict,
            'total_atc': tot_atc,
            'total_atd': tot_atd
        })

    return registros


def guardar_archivos_locales(diario_existente, nombres_por_dni, existing_bundle,
                             diario_csv_path, demo_json_path, demo_js_path):
    """Guarda DATA_DIARIO.csv, demo_data.json y demo_data.js."""
    diario_header = ["mes", "dni", "personal"]
    for d_num in range(1, 32):
        d_tag = str(d_num).zfill(2)
        diario_header.append(f"d{d_tag}_atc")
        diario_header.append(f"d{d_tag}_atd")
    diario_header.append("total_atc")
    diario_header.append("total_atd")

    diario_rows = []
    for d_dni, m_dict in diario_existente.items():
        d_nom = nombres_por_dni.get(d_dni, f"PERSONAL {d_dni}")
        for m_k, m_val in m_dict.items():
            csv_r = [m_k, d_dni, d_nom]
            for d_int in range(1, 32):
                d_t = str(d_int).zfill(2)
                d_obj = m_val['dias'].get(d_t, {'atc': 0, 'atd': 0})
                csv_r.append(d_obj.get('atc', 0))
                csv_r.append(d_obj.get('atd', 0))
            csv_r.append(m_val['total_atc'])
            csv_r.append(m_val['total_atd'])
            diario_rows.append(csv_r)

    diario_rows.sort(key=lambda r: (MESES_ORDEN.index(r[0]) if r[0] in MESES_ORDEN else 99, r[1]))

    with open(diario_csv_path, "w", newline="", encoding="utf-8") as f_csv:
        writer = csv.writer(f_csv)
        writer.writerow(diario_header)
        writer.writerows(diario_rows)

    existing_bundle["diario"] = dict(diario_existente)
    existing_bundle["updated_diario_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with open(demo_json_path, "w", encoding="utf-8") as f_json:
        json.dump(existing_bundle, f_json, ensure_ascii=False, indent=2)

    with open(demo_js_path, "w", encoding="utf-8") as f_js:
        f_js.write("window.DEMO_DATA = " + json.dumps(existing_bundle, ensure_ascii=False) + ";\n")

    return diario_rows


def main():
    print("=" * 70)
    print("   ACTUALIZADOR INTERACTIVO DE PRODUCCIÓN DIARIA (DATA_DIARIO)")
    print("                     hecho por xzerox99")
    print("=" * 70)

    # 1. Seleccionar archivo Excel
    excel_path = seleccionar_archivo_excel()
    if not excel_path:
        print("\n[X] No se seleccionó ningún archivo. Operación cancelada.")
        return

    print(f"\n[+] Archivo seleccionado: {os.path.basename(excel_path)}")
    print(f"    Ruta: {excel_path}")

    base_dir = r"E:\Otros\reporte40"
    data_dir = os.path.join(base_dir, "data")
    demo_json_path = os.path.join(data_dir, "demo_data.json")
    demo_js_path = os.path.join(data_dir, "demo_data.js")
    diario_csv_path = os.path.join(data_dir, "DATA_DIARIO.csv")

    # 2. Cargar base de datos acumulada
    existing_bundle = {}
    diario_existente = defaultdict(dict)
    nombres_por_dni = {}

    if os.path.exists(demo_json_path):
        try:
            with open(demo_json_path, "r", encoding="utf-8") as f:
                existing_bundle = json.load(f)
                if "diario" in existing_bundle:
                    for d_k, m_d in existing_bundle["diario"].items():
                        diario_existente[d_k].update(m_d)
                if "usuarios" in existing_bundle:
                    for u_dni, u_data in existing_bundle["usuarios"].items():
                        nombres_por_dni[u_dni] = u_data.get("nombre", "")
        except Exception as e:
            print(f"[!] Aviso leyendo demo_data.json: {e}")

    if os.path.exists(diario_csv_path):
        try:
            with open(diario_csv_path, "r", encoding="utf-8") as f_csv:
                reader = csv.reader(f_csv)
                next(reader, None)
                for row in reader:
                    if len(row) >= 3:
                        r_dni = row[1].strip()
                        r_nom = row[2].strip()
                        if r_dni and r_nom and r_dni not in nombres_por_dni:
                            nombres_por_dni[r_dni] = r_nom
        except Exception:
            pass

    # 3. Escanear bloques de meses disponibles en el Excel
    print("\n[+] Analizando hoja 'ipress personal x dia'...")
    sheet_title, bloques_mes = escanear_bloques_de_meses(excel_path)

    if not sheet_title:
        print("\n[X] No se encontró la hoja 'ipress personal x dia' en el archivo.")
        return

    if not bloques_mes:
        print("\n[!] No se encontraron datos diarios en el Excel.")
        return

    meses_previos = set()
    for dni_k, m_map in diario_existente.items():
        for m_key in m_map.keys():
            meses_previos.add(m_key)
    meses_prev_sorted = sorted(meses_previos, key=lambda x: MESES_ORDEN.index(x) if x in MESES_ORDEN else 99)

    # 4. Bucle interactivo: Preguntar mes -> Procesar -> Subir a Sheets -> Preguntar otro mes
    meses_procesados_sesion = []

    while True:
        print("\n" + "=" * 70)
        print("                 SELECCIÓN DE MES A PROCESAR")
        print("=" * 70)
        print(f"  Meses ya guardados en tu base de datos: {', '.join(meses_prev_sorted) if meses_prev_sorted else 'Ninguno'}")
        print("\n  Meses encontrados en este archivo Excel:")
        opciones_meses = []
        for idx_opc, (m_k, b_info) in enumerate(bloques_mes.items(), 1):
            m_nom = MONTH_KEY_TO_NAME.get(m_k, m_k).upper()
            n_pers = len(b_info['personal'])
            print(f"    [{idx_opc}] {m_nom} ({m_k}) — {n_pers} profesionales disponibles")
            opciones_meses.append(m_k)

        print("    [S] Salir / Terminar proceso")
        print("-" * 70)

        eleccion = input("\n  >>> ¿Qué mes deseas procesar?: ").strip().lower()
        if eleccion in ('s', 'salir', 'no', 'exit', 'q'):
            break

        # Resolver el mes elegido
        mes_elegido = None
        if eleccion.isdigit():
            idx_num = int(eleccion)
            if 1 <= idx_num <= len(opciones_meses):
                mes_elegido = opciones_meses[idx_num - 1]
        else:
            # Por nombre o código (ej: agosto, ago, setiembre, set, etc.)
            cand = MONTH_NAME_MAP.get(eleccion, eleccion.upper()[:3])
            if cand in bloques_mes:
                mes_elegido = cand

        if not mes_elegido:
            print("  [!] Opción no válida. Por favor ingresa el número o nombre del mes.")
            continue

        # Procesar el mes seleccionado
        bloque_elegido = bloques_mes[mes_elegido]
        mes_nom_display = MONTH_KEY_TO_NAME.get(mes_elegido, mes_elegido).upper()

        print(f"\n[+] Extrayendo datos día a día (01 al 31) de {mes_nom_display}...")
        registros_mes = procesar_un_mes(bloque_elegido, mes_elegido)

        reemplazados = 0
        nuevos = 0
        for d_dni, (d_nom, entry) in registros_mes.items():
            if d_nom:
                nombres_por_dni[d_dni] = d_nom
            if d_dni in diario_existente and mes_elegido in diario_existente[d_dni]:
                reemplazados += 1
            else:
                nuevos += 1
            diario_existente[d_dni][mes_elegido] = entry

        meses_procesados_sesion.append(mes_elegido)
        if mes_elegido not in meses_previos:
            meses_previos.add(mes_elegido)
            meses_prev_sorted = sorted(meses_previos, key=lambda x: MESES_ORDEN.index(x) if x in MESES_ORDEN else 99)

        print("\n" + "-" * 60)
        print(f"  RESUMEN DE EXTRACCIÓN — MES: {mes_nom_display} ({mes_elegido})")
        print("-" * 60)
        print(f"  • Total profesionales procesados:        {len(registros_mes)}")
        print(f"  • Registros existentes actualizados:    {reemplazados} (reemplazados sin duplicar)")
        print(f"  • Nuevos profesionales agregados:       {nuevos}")
        print("-" * 60)

        # Guardar localmente
        diario_rows = guardar_archivos_locales(
            diario_existente, nombres_por_dni, existing_bundle,
            diario_csv_path, demo_json_path, demo_js_path
        )
        print(f"  [✓] Archivos locales actualizados ('data/DATA_DIARIO.csv', 'demo_data.js').")

        # Preguntar si desea subir a Google Sheets de una vez
        print("\n" + "-" * 60)
        subir_resp = input(f"  >>> ¿Deseas subir {mes_nom_display} directo a Google Sheets ahora? (si/no): ").strip().lower()
        if subir_resp in ('si', 's', 'sí', 'yes', 'y'):
            filas_mes = [r for r in diario_rows if r[0] == mes_elegido]
            subir_a_google_sheets(filas_mes, mes_elegido)
        else:
            print(f"  [i] Subida a Google Sheets omitida para {mes_nom_display} (guardado localmente).")

        # Preguntar si desea procesar otro mes
        print("\n" + "-" * 60)
        otro = input("  >>> ¿Deseas procesar otro mes? (si/no): ").strip().lower()
        if otro not in ('si', 's', 'sí', 'yes', 'y'):
            break

    # Cierre final
    print("\n" + "=" * 70)
    print("                    SESIÓN FINALIZADA")
    print("=" * 70)
    print(f"  Meses procesados en esta sesión: {', '.join(set(meses_procesados_sesion)) if meses_procesados_sesion else 'Ninguno'}")
    print(f"  Meses totales en tu base de datos: {', '.join(meses_prev_sorted)}")
    print(f"  Total profesionales registrados: {len(diario_existente)}")
    print("=" * 70)


if __name__ == "__main__":
    main()
