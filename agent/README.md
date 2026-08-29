# FOXYN Monitor Agent

Coleta CPU / GPU / RAM e serve para `public/monitor.html` em `ws://localhost:8787`.

## Como usar no Windows (corrigido)

**Não cole o código no PowerShell.** Salve o arquivo baixado e execute com Python:

1. Instale Python 3.10+ em https://www.python.org (marque **Add to PATH**)
2. Baixe `monitor.py` pelo botão **Baixar agente** em `https://foxyn.onrender.com/monitor.html`
3. Salve em uma pasta, ex: `C:\FOXYN\agent\monitor.py`
4. Abra **PowerShell** nessa pasta e rode:
   ```
   python monitor.py
   ```
   Se `python` não funcionar, tente `py monitor.py` ou `python3 monitor.py`.
5. Sem dependências já funciona em modo simulado. Para dados reais:
   ```
   python -m pip install psutil GPUtil websockets
   python monitor.py
   ```
   Verá: `[FOXYN] HTTP fallback em http://localhost:8787/metrics` ou `WebSocket em ws://localhost:8787`.
6. Abra `https://foxyn.onrender.com/monitor.html` e clique **Conectar ao agente**.

Sem o agente, a página roda em **modo simulação** (dados sintéticos + rAF) — já visível ao abrir a página.

## Teste rápido
```
python -c "import psutil; print(psutil.cpu_percent())"
```
Se der `ModuleNotFoundError`, instale as dependências do passo 5.
