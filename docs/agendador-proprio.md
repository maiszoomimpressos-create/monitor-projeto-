# Agendador próprio (worker)

Processo Node que roda o tempo todo, independente da Vercel (decisão D-007). A cada
`WORKER_TICK_SECONDS` (padrão 60 s) ele consulta o banco de controle (Neon), executa as
checagens vencidas de todos os usuários e grava o histórico. O site na Vercel fica só
com as telas e a API.

Código: `src/worker/index.ts` (entrada) e `src/worker/loop.ts` (laço). A lógica de
checagem é a mesma do site: `src/lib/sweep.ts`, `runCheck.ts`, `check.ts`, `ssrf.ts`, `crypto.ts`.

## Variáveis
| Variável | Onde | Obrigatória | Observação |
|---|---|---|---|
| `DATABASE_URL` | worker e Vercel | sim | mesmo banco de controle (Neon) |
| `ENCRYPTION_KEY` | worker e Vercel | sim | **o mesmo valor** da Vercel, senão as chaves não decifram |
| `SCHEDULER_TICK_MINUTES=1` | worker **e Vercel** | recomendado | na Vercel faz o painel oferecer intervalos a partir de 5 min |
| `SCHEDULER_TICK_OFFSET_MINUTES=0` | worker e Vercel | recomendado | |
| `WORKER_TICK_SECONDS` | worker | não | padrão 60 (mínimo 10) |
| `WORKER_SWEEP_BUDGET_SECONDS` | worker | não | tempo máximo por ciclo, padrão 300 |
| `PORT` | worker | não | se definida, abre health check HTTP (`GET /` → 200/503) |

Não são necessárias no worker: `ADMIN_SESSION_SECRET`, `CRON_SECRET`, `DATABASE_URL_UNPOOLED`.

## Railway
1. New Project → Deploy from GitHub repo → `monitor-projeto-` (branch `main` após o merge).
2. O `railway.json` já usa `Dockerfile.worker` e reinício automático.
3. Em Variables, adicione `DATABASE_URL`, `ENCRYPTION_KEY`, `SCHEDULER_TICK_MINUTES=1`, `SCHEDULER_TICK_OFFSET_MINUTES=0`.
4. Deploy. Nos logs deve aparecer `Iniciando agendador próprio...`. Mantenha 1 réplica.

## Fly.io
1. `fly launch --no-deploy` (reaproveite o `fly.toml`; ajuste o nome do app).
2. `fly secrets set DATABASE_URL=... ENCRYPTION_KEY=...`
3. `fly deploy` e `fly scale count 1`.

## Máquina própria (Windows) com pm2
```powershell
cd "D:\PROJETOS ON LINE\SIMULAÇAO HUMANO"
npm install
# .env.local precisa ter DATABASE_URL, ENCRYPTION_KEY, SCHEDULER_TICK_MINUTES=1, SCHEDULER_TICK_OFFSET_MINUTES=0
npm run worker:local          # teste no terminal (Ctrl+C encerra com segurança)
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 logs supabase-uptime-worker
```
Para iniciar com o Windows: `npm install -g pm2-windows-startup` e `pm2-startup install`.
O computador precisa ficar ligado e conectado.

## Coexistência com o cron da Vercel
O cron diário (`vercel.ts`) pode continuar ligado como reserva: o lock por projeto
compara `lastRunAt` com o valor lido, então o mesmo vencimento nunca é checado duas vezes.
Para desligar: remova o item `crons` de `vercel.ts` (e faça deploy) ou deixe `CRON_SECRET`
sem valor na Vercel (a rota responde 401).

## Rodar mais de um worker
Possível sem checagem duplicada (mesmo lock), mas desnecessário: use 1 instância.
