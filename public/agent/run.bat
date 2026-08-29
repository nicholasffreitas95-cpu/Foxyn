@echo off
echo [FOXYN] Iniciando agente monitor...
python monitor.py
if errorlevel 1 (
  echo Tentando com py...
  py monitor.py
)
pause
