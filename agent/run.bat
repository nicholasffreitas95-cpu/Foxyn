@echo off
echo [FOXYN] Iniciando agente monitor...
echo Tentando python...
python --version >nul 2>&1
if %errorlevel%==0 (
  python monitor.py
  goto :end
)
echo "python" nao encontrado, tentando py...
py --version >nul 2>&1
if %errorlevel%==0 (
  py monitor.py
  goto :end
)
echo "py" nao encontrado, tentando python3...
python3 --version >nul 2>&1
if %errorlevel%==0 (
  python3 monitor.py
  goto :end
)
echo.
echo [ERRO] Nenhum Python encontrado no PATH.
echo 1) Instale Python 3.10+ em https://www.python.org  (marque ADD TO PATH)
echo 2) Ou instale via winget: winget install Python.Python.3.12
echo 3) Feche e reabra o PowerShell e tente novamente.
echo 4) Teste: python --version  / py --version  / where python
:end
pause
