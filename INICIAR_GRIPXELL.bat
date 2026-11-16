@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
 echo Debes instalar Node.js LTS: https://nodejs.org/
 pause
 exit /b 1
)
if not exist "node_modules\astro" (
 echo Instalando dependencias de GRIPXELL...
 call npm.cmd install
 if errorlevel 1 (pause & exit /b 1)
)
echo GRIPXELL disponible en http://localhost:4321
call npm.cmd run dev
pause
