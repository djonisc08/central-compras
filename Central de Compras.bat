@echo off
REM Abre a Central de Compras: faz backup, liga o servidor e abre o navegador.
REM Crie um atalho deste arquivo na Area de Trabalho. Para desligar, feche esta janela.
cd /d "%~dp0"
title Central de Compras - NAO FECHE esta janela enquanto estiver usando
call npm run --silent backup
start "" cmd /c "timeout /t 6 >nul & start http://localhost:3000"
call npm run dev
