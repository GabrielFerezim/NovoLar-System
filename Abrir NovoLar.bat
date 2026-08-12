@echo off
title Novo Lar - Sistema

echo.
echo  ====================================
echo   Novo Lar - Iniciando o sistema...
echo  ====================================
echo.

cd /d "%~dp0"

start "" "node_modules\electron\dist\electron.exe" .

exit
