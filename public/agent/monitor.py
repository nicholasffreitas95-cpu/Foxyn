#!/usr/bin/env python3
"""
FOXYN Monitor Agent - coleta CPU/GPU/RAM e serve via WebSocket em ws://localhost:8787
Estilo MSI Afterburner leve (sem overlay nativo por cima do jogo nesta versão;
use a página /monitor.html como HUD. Para overlay real por cima do jogo,
ative o modo borderless topmost com tkinter (opcional).
"""
import asyncio
import json
import time
import psutil

try:
    import GPUtil
    HAS_GPUTIL = True
except Exception:
    HAS_GPUTIL = False

# WebSocket simples sem dependência externa se 'websockets' não estiver instalado: fallback HTTP polling
try:
    import websockets
    HAS_WS = True
except ImportError:
    HAS_WS = False
    print("[FOXYN] websockets não instalado — modo HTTP polling em http://localhost:8787/metrics")
    print("  instale com: pip install websockets psutil GPUtil")

PORT = 8787

def sample():
    cpu = psutil.cpu_percent(interval=None)
    ram = psutil.virtual_memory().percent
    ram_used = round(psutil.virtual_memory().used / (1024**3), 1)
    gpu = 0
    gpu_temp = 62
    if HAS_GPUTIL:
        try:
            gpus = GPUtil.getGPUs()
            if gpus:
                gpu = round(gpus[0].load * 100, 1)
                gpu_temp = int(getattr(gpus[0], "temperature", 62))
        except Exception:
            pass
    # FPS sintético baseado em carga (sem hook real no jogo)
    fps = max(28, 110 - cpu*0.55 - gpu*0.35 + (ram%7))
    # temps sintéticas se não houver sensor
    cpu_temp = 48 + int(cpu*0.28)
    return {
        "cpu": round(cpu,1), "gpu": round(gpu,1), "ram": round(ram,1),
        "ramUsed": ram_used, "fps": round(fps,1),
        "cpuTemp": cpu_temp, "gpuTemp": gpu_temp,
        "ts": int(time.time()*1000)
    }

async def ws_handler(websocket):
    print(f"[FOXYN] cliente conectado {websocket.remote_address}")
    try:
        while True:
            await websocket.send(json.dumps(sample()))
            await asyncio.sleep(0.65)
    except Exception as e:
        print(f"[FOXYN] cliente desconectado: {e}")

async def main_ws():
    print(f"[FOXYN] WebSocket em ws://localhost:{PORT}")
    async with websockets.serve(ws_handler, "localhost", PORT):
        await asyncio.Future()

# Fallback HTTP se websockets não disponível
from http.server import BaseHTTPRequestHandler, HTTPServer
import threading

class MetricsHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/metrics":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(sample()).encode())
        else:
            self.send_response(404)
            self.end_headers()
    def log_message(self, fmt, *args):
        pass

def run_http():
    srv = HTTPServer(("localhost", PORT), MetricsHandler)
    print(f"[FOXYN] HTTP fallback em http://localhost:{PORT}/metrics")
    srv.serve_forever()

if __name__ == "__main__":
    if HAS_WS:
        asyncio.run(main_ws())
    else:
        # inicia http em thread
        t = threading.Thread(target=run_http, daemon=True)
        t.start()
        print("[FOXYN] aguardando... Ctrl+C para sair")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n[FOXYN] encerrado")
