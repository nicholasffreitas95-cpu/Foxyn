#!/usr/bin/env python3
# FOXYN Desktop v1 - app local sem depender do site
# Carrega public/ via http local + webview, métricas via psutil, dados em ./data.json
import os
import sys
import json
import time
import threading
import random
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, HTTPServer
from functools import partial

APP_NAME = "FOXYN"
PORT = 5173

if getattr(sys, "frozen", False):
    # PyInstaller bundle
    base = Path(sys.executable).resolve().parent
    # tenta dist\FOXYN\public e também _MEIPASS\public
    cand1 = base / "public"
    cand2 = Path(getattr(sys, "_MEIPASS", str(base))) / "public"
    PUBLIC = cand1 if cand1.exists() else cand2
    ROOT = base
else:
    ROOT = Path(__file__).resolve().parent
    PUBLIC = (ROOT.parent / "public").resolve()
DATA_FILE = ROOT / "data.json"

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False
    psutil = None

def load_data():
    if DATA_FILE.exists():
        try:
            return json.loads(DATA_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"simulations": [], "monitor_log": []}

def save_data(d):
    try:
        DATA_FILE.write_text(json.dumps(d, indent=2, ensure_ascii=False), encoding="utf-8")
    except Exception as e:
        print(f"[FOXYN] save fail {e}")

def sample():
    if HAS_PSUTIL:
        try:
            cpu = float(psutil.cpu_percent(interval=None) or 0)
            vm = psutil.virtual_memory()
            ram = float(vm.percent)
            ram_used = round(vm.used / (1024**3), 1)
        except Exception:
            cpu, ram, ram_used = 35.0, 48.0, 8.2
    else:
        t = time.time()
        cpu = 32 + (t % 7) * 2.1 + random.random()*5
        ram = 46 + (t % 5) * 1.2 + random.random()*3
        ram_used = round(7.6 + (t % 3)*0.4, 1)
        cpu = max(5, min(95, cpu))
        ram = max(10, min(92, ram))
    gpu = 42 + (time.time() % 6) * 1.5 + random.random()*6
    gpu = max(5, min(98, gpu))
    fps = max(28, 110 - cpu*0.55 - gpu*0.35 + (ram % 7))
    return {
        "cpu": round(cpu,1), "gpu": round(gpu,1), "ram": round(ram,1),
        "ramUsed": float(ram_used), "fps": round(fps,1),
        "cpuTemp": 48 + int(cpu*0.28), "gpuTemp": 60 + int(gpu*0.18),
        "ts": int(time.time()*1000)
    }

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC), **kwargs)
    def do_GET(self):
        if self.path == "/api/metrics":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(sample()).encode())
            return
        if self.path == "/api/data":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(load_data()).encode())
            return
        return super().do_GET()
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
    def log_message(self, format, *args):
        pass

def start_server():
    srv = HTTPServer(("127.0.0.1", PORT), Handler)
    print(f"FOXYN local http://localhost:{PORT}  public={PUBLIC}")
    srv.serve_forever()

def start_webview():
    url = f"http://localhost:{PORT}/index.html"
    print(f"FOXYN abrindo {url}")
    # tenta pywebview, se não houver abre navegador padrão
    try:
        import webview
        webview.create_window("FOXYN", url, width=1280, height=800, min_size=(1024,640))
        webview.start()
        return
    except Exception as e:
        print(f"pywebview indisponivel ({e}), abrindo navegador padrao...")
        import webbrowser
        webbrowser.open(url)

if __name__ == "__main__":
    if not PUBLIC.exists():
        print(f"ERRO public nao encontrado: {PUBLIC}")
        sys.exit(1)
    t = threading.Thread(target=start_server, daemon=True)
    t.start()
    time.sleep(0.6)
    try:
        start_webview()
        # se webview fechar, mantém servidor até Ctrl+C
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nFOXYN encerrado")
        sys.exit(0)
