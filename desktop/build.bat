@echo off
echo [FOXYN] Build app local .exe
python -m pip install -r requirements.txt
if errorlevel 1 (
  echo Falha ao instalar deps, tentando com --user
  python -m pip install --user -r requirements.txt
)
echo [FOXYN] Gerando exe com PyInstaller...
python -m PyInstaller --noconfirm --windowed --name FOXYN --add-data "..\public;public" --icon "..\public\assets\foxyn-mark.svg" app.py
echo.
echo [FOXYN] EXE em desktop\dist\FOXYN\FOXYN.exe  (ou dist\FOXYN.exe se --onefile)
echo Para instalador, use NSIS ou Inno Setup apontando para dist\FOXYN
pause
