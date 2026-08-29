# FOXYN Monitor Agent

Coleta CPU / GPU / RAM e serve para `public/monitor.html` em `ws://localhost:8787`.

## Uso
```
pip install -r requirements.txt
python monitor.py
```
Abra `http://localhost:3000/monitor.html` e clique **Conectar ao agente**.

Sem o agente, a página roda em **modo simulação** (dados sintéticos + rAF).
