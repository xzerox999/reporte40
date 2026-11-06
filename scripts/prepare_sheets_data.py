# -*- coding: utf-8 -*-
"""
ETL Script: Extrae y consolida datos de 'REPORTE 40 2026.xlsx'
Maneja profesionales con múltiples establecimientos (rotaciones/destaques)
Genera:
1. data/USUARIOS.csv (Con establecimiento principal de mayor producción)
2. data/DATA_ATD_ATC.csv (Filas originales)
3. data/DATA_APP.csv (Filas originales)
4. data/demo_data.json y data/demo_data.js (Con consolidados y desglose por IPRESS)
"""

import openpyxl
import csv
import json
import hashlib
import os
from datetime import datetime
from collections import defaultdict

EXCEL_PATH = r"E:\Otros\reporte40\REPORTE 40 2026.xlsx"
OUTPUT_DIR = r"E:\Otros\reporte40\data"
os.makedirs(OUTPUT_DIR, exist_ok=True)

MESES_KEYS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SET", "OCT", "NOV"]

def sha256_hash(text):
    return hashlib.sha256(str(text).strip().encode('utf-8')).hexdigest()

print("1. Abriendo archivo Excel...")
wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True, data_only=True)

# 1. Mapeo de Colegios desde Hoja1
colegio_map = {}
if 'Hoja1' in wb.sheetnames:
    ws_h1 = wb['Hoja1']
    for r in ws_h1.iter_rows(min_row=2, values_only=True):
        if r and len(r) > 6 and r[4]:
            dni_k = str(r[4]).strip()
            colegio = r[6] if len(r) > 6 and r[6] else ""
            if colegio:
                colegio_map[dni_k] = str(colegio).strip()

# 2. Extracción de ATD / ATC
print("2. Procesando hoja 'ipress personal x mes (2)' (ATD / ATC)...")
ws_atd = wb['ipress personal x mes (2)']
atd_rows = []
atd_by_dni = defaultdict(list)
dni_meta = {}

for r in ws_atd.iter_rows(min_row=11, values_only=True):
    estab = r[0]
    dni = r[1]
    nombre = r[2]

    if not estab or not dni or not nombre:
        continue
    if 'Total' in str(estab) or 'Total' in str(dni) or 'Total' in str(nombre):
        continue

    dni_str = str(dni).strip()
    nombre_str = str(nombre).strip()
    estab_str = str(estab).strip()

    row_data = [estab_str, dni_str, nombre_str]
    for c_idx in range(3, 27):
        val = r[c_idx] if c_idx < len(r) and r[c_idx] is not None else 0
        try:
            val_int = int(round(float(val)))
        except (ValueError, TypeError):
            val_int = 0
        row_data.append(val_int)

    atd_rows.append(row_data)

    # Organizar por DNI
    meses_dict = {}
    for i, m_key in enumerate(MESES_KEYS):
        atc_v = row_data[3 + (i * 2)]
        atd_v = row_data[4 + (i * 2)]
        meses_dict[m_key] = {"atc": atc_v, "atd": atd_v}

    tot_atc = row_data[25]
    tot_atd = row_data[26]

    atd_by_dni[dni_str].append({
        "establecimiento": estab_str,
        "meses": meses_dict,
        "total_atc": tot_atc,
        "total_atd": tot_atd
    })

    if dni_str not in dni_meta:
        dni_meta[dni_str] = {
            "dni": dni_str,
            "nombre": nombre_str,
            "establecimientos": set([estab_str]),
            "microred": "",
            "colegio": colegio_map.get(dni_str, "")
        }
    else:
        dni_meta[dni_str]["establecimientos"].add(estab_str)

# 3. Extracción de APP
print("3. Procesando hoja 'v_reporte40_APP' (APP)...")
ws_app = wb['v_reporte40_APP']
app_rows = []
app_by_dni = defaultdict(list)

for r in ws_app.iter_rows(min_row=8, values_only=True):
    microred = r[0]
    estab = r[1]
    dni = r[2]
    nombre = r[3]

    if not estab or not dni or not nombre:
        continue
    if 'Total' in str(estab) or 'Total' in str(dni) or 'Total' in str(nombre):
        continue

    microred_str = str(microred).strip() if microred else ""
    estab_str = str(estab).strip()
    dni_str = str(dni).strip()
    nombre_str = str(nombre).strip()

    row_data = [microred_str, estab_str, dni_str, nombre_str]
    for c_idx in range(4, 16):
        val = r[c_idx] if c_idx < len(r) and r[c_idx] is not None else 0
        try:
            val_int = int(round(float(val)))
        except (ValueError, TypeError):
            val_int = 0
        row_data.append(val_int)

    app_rows.append(row_data)

    meses_app_dict = {}
    for i, m_key in enumerate(MESES_KEYS):
        meses_app_dict[m_key] = row_data[4 + i]

    app_by_dni[dni_str].append({
        "microred": microred_str,
        "establecimiento": estab_str,
        "meses": meses_app_dict,
        "total": row_data[15]
    })

    if dni_str in dni_meta:
        if not dni_meta[dni_str]["microred"] and microred_str:
            dni_meta[dni_str]["microred"] = microred_str
        dni_meta[dni_str]["establecimientos"].add(estab_str)
    else:
        dni_meta[dni_str] = {
            "dni": dni_str,
            "nombre": nombre_str,
            "establecimientos": set([estab_str]),
            "microred": microred_str,
            "colegio": colegio_map.get(dni_str, "")
        }

wb.close()

# 4. Consolidación y Determinación del Establecimiento Principal
print("4. Consolidando datos y calculando totales por profesional...")

consolidado_atd = {}
for dni_k, registros in atd_by_dni.items():
    # Sumar todos los establecimientos para el consolidado
    cons_meses = {m: {"atc": 0, "atd": 0} for m in MESES_KEYS}
    tot_atc_sum = 0
    tot_atd_sum = 0
    por_estab = {}

    estab_con_mas_produccion = registros[0]["establecimiento"]
    max_prod = -1

    for reg in registros:
        est = reg["establecimiento"]
        por_estab[est] = {
            "meses": reg["meses"],
            "total_atc": reg["total_atc"],
            "total_atd": reg["total_atd"]
        }
        tot_atc_sum += reg["total_atc"]
        tot_atd_sum += reg["total_atd"]

        if reg["total_atc"] > max_prod:
            max_prod = reg["total_atc"]
            estab_con_mas_produccion = est

        for m in MESES_KEYS:
            cons_meses[m]["atc"] += reg["meses"][m]["atc"]
            cons_meses[m]["atd"] += reg["meses"][m]["atd"]

    consolidado_atd[dni_k] = {
        "dni": dni_k,
        "personal": dni_meta[dni_k]["nombre"],
        "establecimiento_principal": estab_con_mas_produccion,
        "establecimientos": list(por_estab.keys()),
        "consolidado": {
            "meses": cons_meses,
            "total_atc": tot_atc_sum,
            "total_atd": tot_atd_sum
        },
        "por_establecimiento": por_estab
    }

consolidado_app = {}
for dni_k, registros in app_by_dni.items():
    cons_meses = {m: 0 for m in MESES_KEYS}
    tot_app_sum = 0
    por_estab = {}

    for reg in registros:
        est = reg["establecimiento"]
        por_estab[est] = {
            "microred": reg["microred"],
            "meses": reg["meses"],
            "total": reg["total"]
        }
        tot_app_sum += reg["total"]
        for m in MESES_KEYS:
            cons_meses[m] += reg["meses"][m]

    consolidado_app[dni_k] = {
        "dni": dni_k,
        "personal": dni_meta[dni_k]["nombre"],
        "consolidado": {
            "meses": cons_meses,
            "total": tot_app_sum
        },
        "por_establecimiento": por_estab
    }

# 5. Generar USUARIOS.csv
print("5. Generando USUARIOS.csv...")
admin_dni = "46638223"
admin_pass_hash = sha256_hash("comatose")

usuarios_dict = {}
usuarios_csv_path = os.path.join(OUTPUT_DIR, "USUARIOS.csv")
with open(usuarios_csv_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow([
        "dni", "nombre", "password_hash", "rol", 
        "establecimiento", "microred", "colegio", 
        "fecha_creacion", "ultimo_acceso"
    ])
    
    # Fila Admin
    writer.writerow([
        admin_dni, "ADMINISTRADOR DEL SISTEMA", admin_pass_hash, "admin",
        "SEDE RED CUSCO SUR", "RED CUSCO SUR", "DIRECCIÓN EJECUTIVA",
        datetime.now().strftime("%Y-%m-%d %H:%M:%S"), ""
    ])

    for dni_k, meta in sorted(dni_meta.items()):
        if dni_k == admin_dni:
            continue
        p_hash = sha256_hash(dni_k)
        
        # Establecimiento principal
        estab_princ = consolidado_atd.get(dni_k, {}).get("establecimiento_principal")
        if not estab_princ:
            estab_princ = list(meta["establecimientos"])[0] if meta["establecimientos"] else "NO ESPECIFICADO"

        all_estabs_list = list(meta["establecimientos"])

        usuarios_dict[dni_k] = {
            "dni": dni_k,
            "nombre": meta["nombre"],
            "establecimiento": estab_princ,
            "establecimientos": all_estabs_list,
            "microred": meta["microred"],
            "colegio": meta["colegio"]
        }

        writer.writerow([
            dni_k, meta["nombre"], p_hash, "usuario",
            estab_princ, meta["microred"], meta["colegio"],
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"), ""
        ])

# 6. Guardar DATA_ATD_ATC.csv y DATA_APP.csv originales
print("6. Guardando DATA_ATD_ATC.csv y DATA_APP.csv...")
with open(os.path.join(OUTPUT_DIR, "DATA_ATD_ATC.csv"), "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow([
        "establecimiento", "dni", "personal",
        "ene_atc", "ene_atd", "feb_atc", "feb_atd", "mar_atc", "mar_atd",
        "abr_atc", "abr_atd", "may_atc", "may_atd", "jun_atc", "jun_atd",
        "jul_atc", "jul_atd", "ago_atc", "ago_atd", "set_atc", "set_atd",
        "oct_atc", "oct_atd", "nov_atc", "nov_atd", "total_atc", "total_atd"
    ])
    writer.writerows(atd_rows)

with open(os.path.join(OUTPUT_DIR, "DATA_APP.csv"), "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow([
        "microred", "establecimiento", "dni", "personal",
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "setiembre", "octubre", "noviembre", "total"
    ])
    writer.writerows(app_rows)

# 7. Generar demo_data.json y demo_data.js
print("7. Generando archivos demo_data...")
demo_bundle = {
    "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    "admin": {
        "dni": admin_dni,
        "password_hash": admin_pass_hash
    },
    "usuarios": usuarios_dict,
    "atd_atc": consolidado_atd,
    "app": consolidado_app
}

json_path = os.path.join(OUTPUT_DIR, "demo_data.json")
with open(json_path, "w", encoding="utf-8") as f:
    json.dump(demo_bundle, f, ensure_ascii=False, indent=2)

js_path = os.path.join(OUTPUT_DIR, "demo_data.js")
with open(js_path, "w", encoding="utf-8") as f:
    f.write("window.DEMO_DATA = " + json.dumps(demo_bundle, ensure_ascii=False) + ";\n")

print("¡Proceso finalizado exitosamente! Datos consolidados y listos.")
