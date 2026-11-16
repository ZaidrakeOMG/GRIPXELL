@echo off
cd /d "%~dp0"
node -e "require('dotenv').config();const u=process.env.SUPABASE_URL||'';const s=process.env.SUPABASE_SECRET_KEY||'';console.log('Carpeta:',process.cwd());console.log('URL valida:',/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(u));console.log('Clave configurada:',s.startsWith('sb_secret_'));console.log('Las claves no se muestran.');"
pause
