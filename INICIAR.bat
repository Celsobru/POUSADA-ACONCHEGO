@echo off
chcp 65001 >nul
title Pousada Aconchego - Servidor
color 0A

cd /d "F:\APLICAÇÕES WEB\POUSADA-ACONCHEGO\server"

echo.
echo  ============================================
echo   POUSADA ACONCHEGO - SERVIDOR
echo  ============================================
echo.
echo  Encerrando servidores antigos na porta 3010...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3010 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)
echo  OK.
echo.
echo  Iniciando o servidor em http://localhost:3010 ...
echo  O navegador vai abrir automaticamente em alguns segundos.
echo.
echo  PARA PARAR o servidor: feche esta janela ou pressione CTRL+C.
echo  ============================================
echo.

rem Abre o navegador automaticamente depois de 3 segundos (em segundo plano)
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:3010/admin.html'"

node server.js

echo.
echo  Servidor encerrado.
pause
