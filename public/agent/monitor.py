#!/usr/bin/env python3
# FOXYN Monitor Agent v2 - simples e robusto
# Roda sem instalar nada (valores simulados). Para dados reais: pip install psutil websockets
import asyncio
import json
import time
import random
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT_WS = 8787
PORT_HTTP = 8788

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False
    psutil = None

try:
    import websockets
    HAS_WS = True
except ImportError:
    HAS_WS = False
    websockets = None

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
    cpu_temp = 48 + int(cpu*0.28)
    gpu_temp = 60 + int(gpu*0.18)
    return {
        "cpu": round(float(cpu),1), "gpu": round(float(gpu),1), "ram": round(float(ram),1),
        "ramUsed": float(ram_used), "fps": round(float(fps),1),
        "cpuTemp": int(cpu_temp), "gpuTemp": int(gpu_temp),
        "ts": int(time.time()*1000)
    }

class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.end_headers()
    def do_GET(self):
        if self.path == "/metrics":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.end_headers()
            self.wfile.write(json.dumps(sample()).encode())
        else:
            self.send_response(404)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.end_headers()
    def log_message(self, fmt, *args):
        pass

def run_http(port):
    try:
        srv = HTTPServer(("127.0.0.1", port), Handler)
        print(f"FOXYN HTTP OK http://localhost:{port}/metrics - deixe esta janela aberta")
        srv.serve_forever()
    except OSError as e:
        print(f"FOXYN ERRO porta {port} em uso: {e}")
        print(f"Feche outro agente: netstat -ano | findstr {port}  e  Taskkill /PID <id> /F")

async def ws_handler(ws):
    try:
        while True:
            await ws.send(json.dumps(sample()))
            await asyncio.sleep(0.65)
    except Exception:
        pass

async def run_ws():
    print(f"FOXYN WS OK ws://localhost:{PORT_WS} - deixe esta janela aberta")
    async with websockets.serve(ws_handler, "127.0.0.1", PORT_WS):
        await asyncio.Future()

if __name__ == "__main__":
    print("FOXYN Agent v2 iniciado - nao feche esta janela")
    if HAS_WS:
        t = threading.Thread(target=run_http, args=(PORT_HTTP,), daemon=True)
        t.start()
        try:
            asyncio.run(run_ws())
        except KeyboardInterrupt:
            print("FOXYN encerrado")
        except OSError as e:
            print(f"FOXYN ERRO WS: {e}")
    else:
        print("FOXYN modo HTTP puro (sem websockets) - instale websockets para WS")
        print("  python -m pip install websockets")
        run_http(PORT_HTTP)
