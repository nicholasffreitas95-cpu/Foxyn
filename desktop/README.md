# FOXYN Desktop — app local com instalador

Roda **sem depender do site** (`https://foxyn.onrender.com`). Carrega `public/` local em `http://localhost:5173` e mede CPU/RAM/FPS direto via `psutil` (sem `ws://localhost:8787`).

## Rodar sem build (dev)
```
cd desktop
pip install -r requirements.txt
python app.py
```
Abre janela FOXYN (pywebview) ou navegador em `http://localhost:5173`.

API local:
- `http://localhost:5173/api/metrics` → `{cpu,gpu,ram,FPS}`
- `http://localhost:5173/api/data` → `data.json` local

## Gerar .exe + instalador
```
cd desktop
build.bat
```
Saída em `desktop/dist/FOXYN/` . Para instalador, empacote com **NSIS** (`makensis installer.nsi`) ou **Inno Setup**.

Dados ficam em `desktop/data.json` ao lado do exe (não no `data/foxyn-data.json` do server).
