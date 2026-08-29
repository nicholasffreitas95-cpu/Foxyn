@echo off
title FOXYN Portable
echo [FOXYN] Iniciando app local...
cd /d "%~dp0"
python --version >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERRO] Python nao encontrado. Instale Python 3.10+ em https://www.python.org e marque ADD TO PATH
  pause
  exit /b
)
python -m pip show pywebview >nul 2>&1
if %errorlevel% neq 0 (
  echo [FOXYN] Instalando deps (primeira vez)...
  python -m pip install -r requirements.txt
)
python app.py
pause
