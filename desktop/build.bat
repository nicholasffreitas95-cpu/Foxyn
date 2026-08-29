@echo off
echo [FOXYN] Build app local .exe
REM tenta Python 3.11 primeiro (compativel com PyInstaller), se nao achar usa python atual
py -3.11 --version >nul 2>&1
if %errorlevel%==0 (
  echo Usando Python 3.11 para build...
  set PY=py -3.11
) else (
  set PY=python
)
%PY% -m pip install -r requirements.txt
if errorlevel 1 (
  echo Falha ao instalar deps, tentando com --user
  %PY% -m pip install --user -r requirements.txt
)
%PY% --version | findstr "3.14" >nul
if %errorlevel%==0 (
  echo [AVISO] Python 3.14 detectado - PyInstaller 6.22 ainda nao suporta 3.14, vai dar ordinal 380 / python314.dll
  echo Instale Python 3.11: winget install Python.Python.3.11
  echo Tentando mesmo assim...
)
echo [FOXYN] Gerando exe com PyInstaller...
if exist foxyn.ico (
  %PY% -m PyInstaller --noconfirm --clean --windowed --name FOXYN --icon foxyn.ico --add-data "..\public;public" app.py
) else (
  %PY% -m PyInstaller --noconfirm --clean --windowed --name FOXYN --add-data "..\public;public" app.py
)
if exist "C:\Program Files (x86)\NSIS\makensis.exe" (
  echo [FOXYN] Gerando instalador NSIS...
  "C:\Program Files (x86)\NSIS\makensis.exe" installer.nsi
  echo Instalador em FOXYN-Installer.exe
) else (
  echo [FOXYN] NSIS nao encontrado - instale em https://nsis.sourceforge.io ou use FOXYN_portable.bat
)
echo.
echo [FOXYN] EXE em desktop\dist\FOXYN\FOXYN.exe  (ou dist\FOXYN.exe se --onefile)
echo Para instalador, use NSIS ou Inno Setup apontando para dist\FOXYN
pause
