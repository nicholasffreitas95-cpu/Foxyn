# 🦊 FOXYN

O assistente pessoal do gamer para o seu PC: benchmark, radar de preços e recomendações de upgrade — com **backend próprio** para que chaves e integrações de API fiquem **somente no servidor**.

> Projeto novo e independente (decoupled) do legado GameSpec. Frontend + API em Node.js/Express, pronto para **Render.com**.

---

## Visão geral da arquitetura

```
FOXYN/
├─ server/                # Backend Node.js/Express (deploy no Render)
│  ├─ index.js            # App Express + serve estático + middleware de segurança
│  ├─ db.js               # Armazenamento puro JS em arquivo JSON (sem módulo nativo)
│  ├─ auth-middleware.js  # JWT (login real, bcrypt)
│  ├─ plans.js            # Planos e LIMITES — validação SOMENTE no servidor
│  ├─ seed.js / auto-seed.js / seed-runner.js
│  └─ routes/
│     ├─ auth.js          # /api/auth/register|login|me
│     ├─ user.js          # pc-profile, benchmark, subscription, admin metrics
│     └─ radar.js         # /api/products (proxy de preços), history, monitor
├─ public/                # Frontend (HTML/CSS/JS + design FOXYN)
│  ├─ index.html          # Landing + login/registro
│  ├─ dashboard.html, radar-precos.html, planos.html,
│  ├─ meu-pc.html, benchmark.html, admin.html, alertas.html, foxyn-ai.html
│  ├─ js/api.js           # Cliente JWT (nunca guarda segredo)
│  ├─ js/app.js           # Layout/sidebar + sessão via /api
│  └─ css/foxyn.css       # Design system
├─ render.yaml            # Blueprint de deploy do Render
├─ .env.example
└─ package.json
```

**Princípio central:** o frontend **nunca** decide limites e **nunca** guarda chaves. Cada regra é validada no servidor; integrações externas (preços, pagamento, IA) vêm do servidor via variáveis de ambiente.

---

## 1) Rodar localmente

Pré-requisito: **Node.js 18 ou superior**.

```bash
# no diretório do projeto
npm install

# criar .env a partir do exemplo
#   (no Windows:  Copy-Item .env.example .env)
cp .env.example .env

# semear dados de demonstração + admin
npm run seed

# subir o servidor
npm start
# -> http://localhost:3000
```

**Login admin padrão:**
- Usuário: `Adm1982` (definível via `FOXYN_ADMIN_USER` no `.env`)
- Senha: `198215057040` (definível via `FOXYN_ADMIN_PASS` no `.env`)

> Altere a senha padrão antes de subir para produção!

---

## 2) Deploy no Render.com

Você pode usar o **Blueprint** (render.yaml) na criação do serviço, ou o fluxo normal:

1. Envie este repositório para o GitHub (novo repositório do FOXYN).
2. Em [render.com](https://render.com) → **New → Web Service**.
3. Conecte o repo do FOXYN.
4. **Runtime:** Node · **Build:** `npm install` · **Start:** `npm start`.
5. Em **Environment**, defina:
   - `JWT_SECRET` → valor longo e aleatório (o render.yaml já gera automaticamente).
   - Opcionais: `PRICE_API_URL`, `PRICE_API_KEY`, `PAYMENT_WEBHOOK_SECRET`, `DATABASE_URL`, `FOXYN_ADMIN_USER`, `FOXYN_ADMIN_PASS`.
6. **Deploy!** O app auto-semeia produtos de demonstração e o admin no primeiro boot.

Se abrir o `index.html` pela primeira vez sem estar logado, você será redirecionado ao login.

---

## 3) Conectando integrações externas (chaves vivem NO SERVIDOR)

Abrindo o `.env` (locl) ou as variáveis do Render (produção):

| Variável               | Uso                                                        |
|------------------------|------------------------------------------------------------|
| `PRICE_API_URL`        | URL de API real de preços. Se vazia, usa dados locais de demonstração. |
| `PRICE_API_KEY`        | Chave da API de preços (nunca vai para o frontend).        |
| `PAYMENT_WEBHOOK_SECRET` | Segredo para validar webhooks do gateway (Stripe/Pix/Mercado Pago). Sem isso, o checkout roda em modo **simulado** (nenhum valor cobrado). |
| `DATABASE_URL`         | Opcional — URL de um **PostgreSQL** gerenciado para persistência real em produção. Sem isso, o app usa um **arquivo JSON local** (`./data/`, puro JS, sem módulo nativo). |
| `FOXYN_ADMIN_USER/PASS`| Credenciais do admin inicial.                              |
| `JWT_SECRET`           | Segredo de assinatura dos tokens.                          |

> Em produção com múltiplas instâncias ou dados críticos, defina `DATABASE_URL` para persistir de forma confiável; o arquivo JSON local é ideal para dev/single-instance.

---

## 4) Limites (aplicados no servidor)

Definidos em `server/plans.js` e checados a cada requisição:

| Recurso         | FREE  | ESSENTIAL | ULTIMATE |
|-----------------|-------|-----------|----------|
| Benchmarks/mês  | 3     | ∞         | ∞        |
| Monitorados     | 2     | 20        | 100      |
| Pesquisas       | 10    | ∞         | ∞        |
| Preço           | R$0   | R$19,90   | R$39,90  |

---

## 5) Honestidade dos dados

- **Benchmark:** medição real exige o **agente local FOXYN** (ainda em desenvolvimento). Sem ele, o servidor **não fabrica números** — registra apenas a execução (marcada como *simulada*) e valida o limite.
- **Preços:** com `PRICE_API_URL` configurada, usa dados reais; senão, serve demonstração local com a origem sinalizada na interface.
- **Pagamento:** sem gateway configurado, o checkout é **modo simulado** e deixa explícito que nenhum valor é cobrado.

---

## Scripts

```bash
npm start        # produção
npm run dev      # dev com reload (node --watch)
npm run seed     # semear dados + admin (--force para reesemear)
```
