@echo off
setlocal
title Enviar Pousada Aconchego para o servidor

rem Usa o Git do GitHub Desktop se o "git" nao estiver no PATH
set "GIT=git"
for /d %%D in ("%LOCALAPPDATA%\GitHubDesktop\app-*") do (
  if exist "%%D\resources\app\git\cmd\git.exe" set "GIT=%%D\resources\app\git\cmd\git.exe"
)

echo =========================================
echo  Enviando atualizacoes para o servidor...
echo =========================================
cd /d "%~dp0"

"%GIT%" add .
"%GIT%" commit -m "Atualizacao de codigo"
"%GIT%" push origin main

echo.
echo =========================================
echo  Pronto! O servidor aplica em ate 2 minutos.
echo =========================================
pause
