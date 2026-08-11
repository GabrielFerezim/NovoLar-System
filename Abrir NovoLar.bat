@echo off
title Novo Lar - Sistema

echo.
echo  ====================================
echo   Novo Lar - Iniciando o sistema...
echo  ====================================
echo.

cd /d "%~dp0"

echo  Construindo o app...
call npm run build

echo.
echo  Abrindo o sistema...
start "" npx electron .

exit
