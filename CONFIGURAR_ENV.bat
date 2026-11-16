@echo off
cd /d "%~dp0"
if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  echo Se creo .env junto a package.json
) else (
  echo Ya existe .env. No se ha modificado.
)
echo Coloca tu clave privada de Supabase en SUPABASE_SECRET_KEY.
echo La URL debe terminar en supabase.co SIN /rest/v1/.
notepad .env
