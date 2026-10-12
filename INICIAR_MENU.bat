@echo off
chcp 65001 >nul
title Pousada Aconchego - Servidor Local
color 0A

:MENU
cls
echo.
echo  ============================================
echo   🏡 POUSADA ACONCHEGO - SERVIDOR LOCAL
echo  ============================================
echo.
echo  [1] Iniciar Servidor (Producao)
echo  [2] Iniciar Servidor (Desenvolvimento - auto-reload)
echo  [3] Abrir Admin no Navegador
echo  [4] Abrir Site no Navegador
echo  [5] Ver IP da Rede (para acesso pelo celular)
echo  [6] Parar Servidor (se estiver rodando)
echo  [7] Sair
echo.
echo  ============================================
set /p OPCAO=Escolha uma opcao [1-7]: 

if "%OPCAO%"=="1" goto INICIAR
if "%OPCAO%"=="2" goto DEV
if "%OPCAO%"=="3" goto ABRIR_ADMIN
if "%OPCAO%"=="4" goto ABRIR_SITE
if "%OPCAO%"=="5" goto VER_IP
if "%OPCAO%"=="6" goto PARAR
if "%OPCAO%"=="7" goto FIM
goto MENU

:INICIAR
cls
echo.
echo  ============================================
echo   🚀 INICIANDO SERVIDOR - PRODUCAO
echo  ============================================
echo.
cd /d "F:\APLICAÇÕES WEB\POUSADA-ACONCHEGO\server"
echo  Servidor rodando em: http://localhost:3010
echo  Admin: http://localhost:3010/admin.html
echo  Site:  http://localhost:3010/
echo.
echo  Pressione CTRL+C para parar
echo  ============================================
node server.js
pause
goto MENU

:DEV
cls
echo.
echo  ============================================
echo   🔧 INICIANDO SERVIDOR - DESENVOLVIMENTO
echo  ============================================
echo.
echo  Instalando nodemon se necessario...
npm list nodemon >nul 2>&1 || npm install -g nodemon
cd /d "F:\APLICAÇÕES WEB\POUSADA-ACONCHEGO\server"
echo  Servidor com auto-reload: http://localhost:3010
echo  Pressione CTRL+C para parar
echo  ============================================
nodemon server.js
pause
goto MENU

:ABRIR_ADMIN
start "" "http://localhost:3010/admin.html"
goto MENU

:ABRIR_SITE
start "" "http://localhost:3010/"
goto MENU

:VER_IP
cls
echo.
echo  ============================================
echo   📱 ACESSO PELO CELULAR (mesma rede Wi-Fi)
echo  ============================================
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /r /c:"IPv4"') do set IP=%%a
set IP=%IP: =%
echo  IP do seu computador: %IP%
echo.
echo  No celular (mesmo Wi-Fi), acesse:
echo    Admin:  http://%IP%:3010/admin.html
echo    Site:   http://%IP%:3010/
echo.
echo  Logins:
echo    Consulte o administrador do sistema (credenciais nao ficam no repositorio)
echo  ============================================
pause
goto MENU

:PARAR
cls
echo.
echo  Parando servidor na porta 3010...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3010 ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
    echo  Processo %%a finalizado.
)
echo  Servidor parado.
pause
goto MENU

:FIM
exit