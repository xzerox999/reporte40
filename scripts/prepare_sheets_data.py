# -*- coding: utf-8 -*-
"""
ETL Script: Extrae y consolida datos de 'REPORTE 40 2026.xlsx' y archivos del SIHCE
(Citas Reservadas de Admisión y Reporte de Triajes de Enfermería)
Maneja profesionales con múltiples establecimientos (rotaciones/destaques)
Genera:
1. data/USUARIOS.csv (Con establecimiento principal de mayor producción)
2. data/DATA_ATD_ATC.csv (Filas mensuales originales con adición SIHCE)
3. data/DATA_APP.csv (Filas mensuales originales)
4. data/DATA_DIARIO.csv (Filas diarias día a día del 01 al 31)
5. data/DATA_SIHCE.csv (Detalle exclusivo de Citas y Triajes SIHCE)
6. data/demo_data.json y data/demo_data.js (Con consolidados, desglose por IPRESS, producción diaria y SIHCE)
"""

import openpyxl
import csv
import json
import hashlib
import os
import glob
from datetime import datetime
from collections import defaultdict

EXCEL_PATH = r"E:\Otros\reporte40\REPORTE 40 2026.xlsx"
OUTPUT_DIR = r"E:\Otros\reporte40\data"
os.makedirs(OUTPUT_DIR, exist_ok=True)

MESES_KEYS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SET", "OCT", "NOV"]
MONTH_NAME_MAP = {
    'enero': 'ENE', 'febrero': 'FEB', 'marzo': 'MAR', 'abril': 'ABR',
    'mayo': 'MAY', 'junio': 'JUN', 'julio': 'JUL', 'agosto': 'AGO',
    'setiembre': 'SET', 'septiembre': 'SET', 'octubre': 'OCT', 'noviembre': 'NOV', 'diciembre': 'DIC'
}
MONTH_NUM_TO_KEY = {
    '01': 'ENE', '02': 'FEB', '03': 'MAR', '04': 'ABR',
    '05': 'MAY', '06': 'JUN', '07': 'JUL', '08': 'AGO',
    '09': 'SET', '10': 'OCT', '11': 'NOV', '12': 'DIC'
}

def sha256_hash(text):
    return hashlib.sha256(str(text).strip().encode('utf-8')).hexdigest()

print("1. Abriendo archivo Excel principal Reporte 40...")
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

# 2. Extracción de ATD / ATC Mensual
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

# 3. Extracción de APP Mensual
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

# 4. Extracción de Datos Diarios ('ipress personal x dia')
print("4. Procesando hoja 'ipress personal x dia' (Producción Día a Día)...")
diario_by_dni = defaultdict(dict)

if 'ipress personal x dia' in wb.sheetnames:
    ws_dia = wb['ipress personal x dia']
    current_m_key = None
    day_cols = []
    header_days_saved = None

    for r_raw in ws_dia.iter_rows(values_only=True):
        if not r_raw or not any(r_raw):
            continue

        c0 = str(r_raw[0]).strip() if r_raw[0] is not None else ""
        c1 = str(r_raw[1]).strip() if len(r_raw) > 1 and r_raw[1] is not None else ""

        # Detección de cabecera de mes
        if c0.lower() == 'mes' and c1:
            m_l = c1.lower()
            current_m_key = MONTH_NAME_MAP.get(m_l, m_l.upper()[:3])
            day_cols = []
            header_days_saved = None
            continue

        # Fila de números de días (01, 02, ..., 31)
        if current_m_key and not day_cols and not header_days_saved:
            r_strs = [str(x).strip() if x is not None else '' for x in r_raw]
            if any(x.isdigit() and 1 <= int(x) <= 31 for x in r_strs if x):
                header_days_saved = r_strs
                continue

        # Fila de subtipos ATC / ATD
        if current_m_key and header_days_saved and not day_cols:
            r_strs = [str(x).strip() if x is not None else '' for x in r_raw]
            if any('ATC' in x.upper() or 'ATD' in x.upper() for x in r_strs):
                for idx in range(2, len(r_raw)):
                    d_val = header_days_saved[idx] if idx < len(header_days_saved) else ''
                    t_val = r_strs[idx] if idx < len(r_strs) else ''

                    if d_val.isdigit():
                        d_norm = str(int(d_val)).zfill(2)
                    else:
                        d_norm = d_val

                    t_norm = 'atc' if 'ATC' in t_val.upper() else ('atd' if 'ATD' in t_val.upper() else '')
                    if d_norm and t_norm:
                        day_cols.append((idx, d_norm, t_norm))
                    elif 'Total' in d_val or 'TOTAL' in d_val:
                        if 'ATC' in d_val.upper():
                            day_cols.append((idx, 'TOTAL', 'atc'))
                        elif 'ATD' in d_val.upper():
                            day_cols.append((idx, 'TOTAL', 'atd'))
                header_days_saved = None
                continue

        # Fila de datos por DNI
        if current_m_key and day_cols and c0 and 'Total' not in c0:
            d_dni = c0.replace('.0', '').strip()
            if d_dni.isdigit() or (len(d_dni) >= 6 and d_dni[:-1].isdigit()):
                d_nombre = c1
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

                entry = {
                    'mes': current_m_key,
                    'dias': dias_dict,
                    'total_atc': tot_atc,
                    'total_atd': tot_atd
                }
                diario_by_dni[d_dni][current_m_key] = entry

wb.close()
print(f"   -> Datos diarios HIS procesados para {len(diario_by_dni)} profesionales.")

# 4.5. Integración de Producción SIHCE (Citas de Admisión y Triajes de Enfermería)
print("4.5. Buscando y procesando archivos del sistema SIHCE (Admisión y Triaje)...")
citas_files = glob.glob(r"E:\Otros\reporte40\*citas*.xlsx") + glob.glob(r"E:\Otros\reporte40\data\*citas*.xlsx")
triaje_files = glob.glob(r"E:\Otros\reporte40\*triaje*.xlsx") + glob.glob(r"E:\Otros\reporte40\data\*triaje*.xlsx") + glob.glob(r"E:\Otros\reporte40\*Triajes*.xlsx")

sihce_summary = {"citas": {}, "triajes": {}}
sihce_csv_rows = []

# A. Procesar Citas Reservadas
for c_path in set(citas_files):
    print(f"   -> Leyendo archivo de Citas SIHCE: {os.path.basename(c_path)}")
    wb_c = openpyxl.load_workbook(c_path, read_only=True, data_only=True)
    ws_c = wb_c.active
    for r in ws_c.iter_rows(min_row=2, values_only=True):
        staff_raw = str(r[35]).strip() if len(r) > 35 and r[35] is not None else ""
        if not staff_raw or not staff_raw[0].isdigit():
            continue
        dni = staff_raw.replace('.0', '').strip()
        estab = str(r[1]).strip() if len(r) > 1 and r[1] else "SAN SEBASTIAN"

        f_str = str(r[10]).strip() if len(r) > 10 and r[10] else ""
        if not f_str or len(f_str) < 10:
            f_str = str(r[16]).strip() if len(r) > 16 and r[16] else ""

        if len(f_str) >= 10:
            if f_str[4] == '-' and f_str[7] == '-':
                m_num = f_str[5:7]
                d_num = f_str[8:10]
            elif '/' in f_str:
                parts = f_str.split('/')
                d_num = parts[0].zfill(2)
                m_num = parts[1].zfill(2)
            else:
                continue

            m_key = MONTH_NUM_TO_KEY.get(m_num)
            if not m_key:
                continue

            if dni not in sihce_summary["citas"]:
                sihce_summary["citas"][dni] = defaultdict(lambda: defaultdict(int))
            sihce_summary["citas"][dni][m_key][d_num] += 1

            # Si no existe en dni_meta, crear registro
            if dni not in dni_meta:
                dni_meta[dni] = {
                    "dni": dni,
                    "nombre": f"PERSONAL ADMISIÓN DNI {dni}",
                    "establecimientos": set([estab]),
                    "microred": "CUSCO",
                    "colegio": "ADMISIÓN SIHCE"
                }
            else:
                dni_meta[dni]["establecimientos"].add(estab)
    wb_c.close()

# B. Procesar Triajes
for t_path in set(triaje_files):
    print(f"   -> Leyendo archivo de Triajes SIHCE: {os.path.basename(t_path)}")
    wb_t = openpyxl.load_workbook(t_path, read_only=True, data_only=True)
    ws_t = wb_t.active

    estab_triaje = "SAN SEBASTIAN"
    for r in ws_t.iter_rows(min_row=1, max_row=10, values_only=True):
        if r and len(r) > 1 and 'ESTABLECIMIENTO' in str(r[0]).upper():
            estab_triaje = str(r[1]).strip()

    for r in ws_t.iter_rows(min_row=14, values_only=True):
        staff_raw = str(r[22]).strip() if len(r) > 22 and r[22] is not None else ""
        dni = "".join(ch for ch in staff_raw if ch.isdigit())
        if not dni or len(dni) < 6:
            continue

        f_str = str(r[21]).strip() if len(r) > 21 and r[21] else ""
        if '/' in f_str and len(f_str) >= 10:
            parts = f_str[:10].split('/')
            d_num = parts[0].zfill(2)
            m_num = parts[1].zfill(2)
            m_key = MONTH_NUM_TO_KEY.get(m_num)
            if not m_key:
                continue

            if dni not in sihce_summary["triajes"]:
                sihce_summary["triajes"][dni] = defaultdict(lambda: defaultdict(int))
            sihce_summary["triajes"][dni][m_key][d_num] += 1

            if dni not in dni_meta:
                dni_meta[dni] = {
                    "dni": dni,
                    "nombre": f"PERSONAL TRIAJE DNI {dni}",
                    "establecimientos": set([estab_triaje]),
                    "microred": "CUSCO",
                    "colegio": "ENFERMERÍA / TRIAJE"
                }
            else:
                dni_meta[dni]["establecimientos"].add(estab_triaje)
    wb_t.close()

# C. Fusionar datos SIHCE en diario_by_dni y atd_by_dni
all_sihce_dnis = set(sihce_summary["citas"].keys()) | set(sihce_summary["triajes"].keys())
print(f"   -> Fusionando producción de {len(all_sihce_dnis)} profesionales de Admisión y Triaje...")

for dni in all_sihce_dnis:
    citas_months = sihce_summary["citas"].get(dni, {})
    triajes_months = sihce_summary["triajes"].get(dni, {})
    all_months = set(citas_months.keys()) | set(triajes_months.keys())

    for m_key in all_months:
        c_days = citas_months.get(m_key, {})
        t_days = triajes_months.get(m_key, {})

        # Asegurar estructura diaria
        if m_key not in diario_by_dni[dni]:
            diario_by_dni[dni][m_key] = {
                'mes': m_key,
                'dias': {str(d).zfill(2): {'atc': 0, 'atd': 0, 'citas': 0, 'triajes': 0} for d in range(1, 32)},
                'total_atc': 0,
                'total_atd': 0
            }

        m_entry = diario_by_dni[dni][m_key]
        added_to_month = 0

        for d_int in range(1, 32):
            d_str = str(d_int).zfill(2)
            c_val = c_days.get(d_str, 0)
            t_val = t_days.get(d_str, 0)

            if d_str not in m_entry['dias']:
                m_entry['dias'][d_str] = {'atc': 0, 'atd': 0, 'citas': 0, 'triajes': 0}

            m_entry['dias'][d_str]['citas'] = c_val
            m_entry['dias'][d_str]['triajes'] = t_val
            m_entry['dias'][d_str]['atc'] += (c_val + t_val)
            added_to_month += (c_val + t_val)

        m_entry['total_atc'] += added_to_month
        m_entry['total_triajes'] = sum(t_days.values())
        m_entry['total_citas'] = sum(c_days.values())

        # Asegurar integración en atd_by_dni (totales mensuales)
        if dni not in atd_by_dni:
            estab_p = list(dni_meta[dni]["establecimientos"])[0]
            atd_by_dni[dni].append({
                "establecimiento": estab_p,
                "meses": {m: {"atc": 0, "atd": 0} for m in MESES_KEYS},
                "total_atc": 0,
                "total_atd": 0
            })

        # Sumar a su establecimiento principal en atd_by_dni
        reg = atd_by_dni[dni][0]
        if m_key in reg["meses"]:
            reg["meses"][m_key]["atc"] += added_to_month
            reg["total_atc"] += added_to_month

# Generar filas para DATA_DIARIO.csv aplanando la información
diario_rows = []
for d_dni, m_dict in diario_by_dni.items():
    d_nom = dni_meta.get(d_dni, {}).get("nombre", "")
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

# 5. Consolidación y Determinación del Establecimiento Principal
print("5. Consolidando datos y calculando totales por profesional...")

consolidado_atd = {}
for dni_k, registros in atd_by_dni.items():
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
        "personal": dni_meta.get(dni_k, {}).get("nombre", ""),
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
        "personal": dni_meta.get(dni_k, {}).get("nombre", ""),
        "consolidado": {
            "meses": cons_meses,
            "total": tot_app_sum
        },
        "por_establecimiento": por_estab
    }

# Asegurar que usuarios con o sin ceros iniciales tengan acceso a sus datos diarios
diario_consolidado = {}
for dni_k, meses_data in diario_by_dni.items():
    diario_consolidado[dni_k] = meses_data
    stripped = dni_k.lstrip('0')
    if stripped and stripped != dni_k and stripped not in diario_consolidado:
        diario_consolidado[stripped] = meses_data
    if len(dni_k) < 8 and dni_k.isdigit():
        padded = dni_k.zfill(8)
        if padded not in diario_consolidado:
            diario_consolidado[padded] = meses_data

# 6. Generar USUARIOS.csv
print("6. Generando USUARIOS.csv...")
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

# 7. Guardar archivos CSV
print("7. Guardando archivos CSV...")
# Generar filas consolidadas de ATD/ATC incluyendo producción SIHCE
final_atd_rows = []
for dni_k, estab_list in atd_by_dni.items():
    nombre_p = dni_meta.get(dni_k, {}).get("nombre", f"PERSONAL {dni_k}")
    for est_data in estab_list:
        row = [est_data["establecimiento"], dni_k, nombre_p]
        for m_k in MESES_KEYS:
            m_info = est_data["meses"].get(m_k, {"atc": 0, "atd": 0})
            row.append(m_info["atc"])
            row.append(m_info["atd"])
        row.append(est_data["total_atc"])
        row.append(est_data["total_atd"])
        final_atd_rows.append(row)

with open(os.path.join(OUTPUT_DIR, "DATA_ATD_ATC.csv"), "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow([
        "establecimiento", "dni", "personal",
        "ene_atc", "ene_atd", "feb_atc", "feb_atd", "mar_atc", "mar_atd",
        "abr_atc", "abr_atd", "may_atc", "may_atd", "jun_atc", "jun_atd",
        "jul_atc", "jul_atd", "ago_atc", "ago_atd", "set_atc", "set_atd",
        "oct_atc", "oct_atd", "nov_atc", "nov_atd", "total_atc", "total_atd"
    ])
    writer.writerows(final_atd_rows)

with open(os.path.join(OUTPUT_DIR, "DATA_APP.csv"), "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow([
        "microred", "establecimiento", "dni", "personal",
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "setiembre", "octubre", "noviembre", "total"
    ])
    writer.writerows(app_rows)

# DATA_DIARIO.csv
diario_header = ["mes", "dni", "personal"]
for d_num in range(1, 32):
    d_tag = str(d_num).zfill(2)
    diario_header.append(f"d{d_tag}_atc")
    diario_header.append(f"d{d_tag}_atd")
diario_header.append("total_atc")
diario_header.append("total_atd")

with open(os.path.join(OUTPUT_DIR, "DATA_DIARIO.csv"), "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(diario_header)
    writer.writerows(diario_rows)
print(f"   -> 'DATA_DIARIO.csv' generado con {len(diario_rows)} registros diarios consolidados.")

# 8. Generar demo_data.json y demo_data.js
print("8. Generando archivos demo_data...")
demo_bundle = {
    "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    "admin": {
        "dni": admin_dni,
        "password_hash": admin_pass_hash
    },
    "usuarios": usuarios_dict,
    "atd_atc": consolidado_atd,
    "app": consolidado_app,
    "diario": diario_consolidado,
    "sihce": sihce_summary
}

json_path = os.path.join(OUTPUT_DIR, "demo_data.json")
with open(json_path, "w", encoding="utf-8") as f:
    json.dump(demo_bundle, f, ensure_ascii=False, indent=2)

js_path = os.path.join(OUTPUT_DIR, "demo_data.js")
with open(js_path, "w", encoding="utf-8") as f:
    f.write("window.DEMO_DATA = " + json.dumps(demo_bundle, ensure_ascii=False) + ";\n")

print("¡Proceso finalizado exitosamente! Reporte 40 + SIHCE Admisión y Triaje consolidados.")
