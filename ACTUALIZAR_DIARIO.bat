@echo off
chcp 65001 > nul
title Actualizador de Produccion Diaria (Reporte 40)
color 0B

echo ======================================================================
echo    ACTUALIZADOR INTERACTIVO DE PRODUCCION DIARIA (DATA_DIARIO)
echo                       hecho por xzerox99
echo ======================================================================
echo.

:: Cambiar a la carpeta raiz del proyecto
cd /d "%~dp0"

:: Si se paso o arrastro un archivo
if not "%~1"=="" (
    echo [i] Archivo detectado: "%~nx1"
    echo.
    python scripts\actualizar_diario.py "%~1"
) else (
    python scripts\actualizar_diario.py
)

if errorlevel 1 (
    echo.
    echo [X] Ocurrio un error durante la ejecucion.
)

pause
