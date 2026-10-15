# STATUS.md

_Última atualização: 15/10/2026 ~19:45 BRT (branch `feat/email-conta`)._
Relatório completo da apuração: `C:\Users\Free\Desktop\CONTINUIDADE-SUPABASE\apuracao-grok.md` (fora do repositório).

Legenda: ✅ implementado e validado · 🟡 implementado, não validado · 🟠 parcial · ❌ ausente/não confirmado

## Objetivo
Keep-alive de sistemas em planos gratuitos com leitura leve (D-009). Tipos: Supabase e Site/URL.

## Funcionalidades
| Item | Estado | Onde |
|---|---|---|
| Cadastro / edição / ativação / exclusão de projetos | 🟡 | `src/app/admin/novo/page.tsx`, `src/app/admin/projetos/[id]/ProjectDetail.tsx`, `src/app/api/admin/projects/**` |
| Consulta real: `GET /rest/v1/{tabela}?select=id&limit=1`, headers `apikey` + `Bearer`, timeout 8 s, até 2 tentativas (só conexão/5xx/desconhecido) | 🟡 | `src/lib/check.ts` |
| "Possível pausa" após 3 falhas de conexão consecutivas | 🟡 | `src/lib/runCheck.ts` |
| Agendamento: Vercel Cron diário `0 9 * * *` (Hobby) → `/api/cron/check-projects` (`Bearer CRON_SECRET`, comparação em tempo constante); agendador externo opcional (GitHub Actions a cada 15 min, desligado por padrão) | 🟡 testes unitários da lógica; sem execução real | `vercel.ts`, `docs/agendador-externo.github-actions.yml` (copiar para `.github/workflows/`), `src/app/api/cron/check-projects/route.ts` |
| Intervalo por projeto escolhido pelo cliente (D-001), painel só oferece intervalos ≥ período do agendador ativo (`SCHEDULER_TICK_MINUTES`); API recusa incompatíveis; "próxima execução" = próximo disparo real do agendador | 🟡 testado (unitário) | `src/lib/schedule.ts`, `src/app/admin/novo/**`, `ProjectDetail.tsx` |
| Despertador via Supabase pg_cron + pg_net (POST a cada 1 min com `Bearer CRON_SECRET`) — opção principal (D-008) | 🟠 SQL e guia prontos; **não executado** em nenhum projeto Supabase | `sql/supabase-despertador.sql`, `docs/despertador-supabase.md` |
| Agendador próprio (worker Node, ciclo a cada 60 s, sem sobreposição, shutdown gracioso, health opcional em `PORT`), reaproveitando `sweep.ts` | 🟡 testes do laço com mocks; iniciado localmente sem banco (falha graciosa); sem deploy | `src/worker/**`, `Dockerfile.worker`, `railway.json`, `fly.toml`, `ecosystem.config.cjs`, `docs/agendador-proprio.md` |
| Projeto tipo **Site/URL** (HTTP GET/HEAD, timeout 30 s, 1 retry, ≤3 redirects, ≤64 KB, status esperado opcional, SSRF com DNS na conexão) | 🟡 testes unitários (URL/SSRF/classificação); **requisição real não testada** (DNS do box devolve 198.18.x, bloqueado pelo próprio SSRF) | `src/lib/httpCheck.ts`, `src/lib/ssrf.ts`, `src/lib/httpCheck.test.ts`, formulários |
| Rotina: pool de 8 checagens com prazo final; HTTP só inicia com ≥ 32 s restantes, Supabase com ≥ 10 s | 🟡 | `src/lib/sweep.ts` |
| Edição parcial (PATCH) não reaplica mais defaults (antes, alternar "ativo" redefinia intervalo e tabela) | 🟡 | `src/lib/validation.ts` |
| `/admin`: barra flutuante + "Novo projeto" + lista dos projetos do usuário (nome, tipo, ativo, intervalo, último resultado com HTTP/latência/horário, próxima execução, link p/ detalhe); estado vazio | 🟡 build ok; render testado com dados fictícios | `src/app/admin/page.tsx`, `src/app/admin/ProjectList.tsx` |
| Datas exibidas sempre em America/Sao_Paulo (servidor roda em UTC) | 🟡 | `src/lib/statusLabels.ts` |
| Campo opcional "E-mail da conta" (referência, nunca usado para acesso) em criar/editar, detalhe e lista | 🟡 build ok; validação testada | `prisma/schema.prisma`, `src/lib/validation.ts`, formulários, `ProjectList.tsx` |
| Botão de olho na chave anon (`SecretInput`) | 🟡 | `src/components/SecretInput.tsx` |
| Lock agendado compara `lastRunAt` lido (worker + cron da Vercel não checam 2x o mesmo vencimento) | 🟡 | `src/lib/runCheck.ts` |
| `isProjectDue` com tolerância de meio período do agendador | ✅ testes unitários | `src/lib/schedule.ts`, `src/lib/schedule.test.ts` |
| Rotina respeita tempo da função (orçamento 45 s de 60 s; vencidos que não couberem ficam para o próximo disparo, mais atrasados primeiro) | 🟡 | `src/lib/sweep.ts` |
| Lock por projeto (update atômico, expira em 10 min) | 🟡 | `src/lib/runCheck.ts` |
| Isolamento de falhas (lotes de 5, `Promise.allSettled`) | 🟡 | `src/lib/sweep.ts` |
| Histórico + limpeza (30 dias / 200 por projeto) | 🟡 (UI mostra 50) | `src/lib/cleanup.ts`, `projetos/[id]/page.tsx` |
| Landing page (`/`) com Entrar / Criar conta | 🟡 build ok, não testada no navegador | `src/app/page.tsx` |
| Cadastro e login por e-mail/senha (`/cadastro`, `/entrar`), senha com scrypt nativo, cookie HMAC 12 h com `uid` | 🟡 build ok; hash/sessão testados com tsx; sem banco real | `src/lib/password.ts`, `src/lib/auth.ts`, `src/app/api/auth/**`, `src/components/AuthForm.tsx` |
| Rate limit no login (5/e-mail e 20/IP por 15 min) e cadastro (10/IP por hora) — em memória, por instância | 🟡 | `src/lib/rateLimit.ts` |
| Projetos por usuário (`ownerId`), todas as rotas/páginas filtram pelo usuário logado | 🟡 | `src/app/api/admin/projects/**`, `src/app/admin/projetos/[id]/page.tsx` |
| Página pós-login: só barra flutuante (nome + Sair) e botão "Novo projeto" | 🟡 | `src/app/admin/page.tsx`, `src/app/admin/FloatingNav.tsx` |
| Criptografia AES-256-GCM das chaves | 🟡 | `src/lib/crypto.ts` |
| Proteção SSRF (https, `*.supabase.co/.in/.net`, DNS sem IP privado) | 🟠 (fetch segue redirects; faixas IPv6 incompletas) | `src/lib/ssrf.ts` |
| Testes automatizados | 🟠 20 testes (`npm test`): agendamento, laço do worker, SSRF/classificação HTTP | `src/lib/*.test.ts`, `src/worker/loop.test.ts` |

## Validações com evidência
- Branch `feat/email-conta` (15/10/2026, box, variáveis fictícias, sem banco): `prisma validate` ok; lint exit 0; tsc exit 0; `npm test` 20/20; build exit 0.
- Branch `feat/checagem-http` (14/10/2026, box, variáveis fictícias, sem banco): lint exit 0; tsc exit 0; `npm test` 19/19; build exit 0. Após a lista de projetos: lint, tsc, testes 19/19 e build novamente ok.
- Branch `feat/despertador-supabase` (14/10/2026, box, variáveis fictícias): lint exit 0; tsc exit 0; `npm test` 13/13; build exit 0. O SQL do despertador **não foi executado** (sem acesso a banco).
- Branch `feat/agendador-proprio` (14/10/2026, box, variáveis fictícias, sem banco): lint exit 0; tsc exit 0; `npm test` 13/13; `npm run build` exit 0; `npm run worker` iniciou, registrou falha de conexão por ciclo sem cair, respondeu ao health em `PORT` e encerrou com SIGTERM/SIGINT; sem `DATABASE_URL` sai com código 1 e mensagem clara. Docker não disponível no box: `Dockerfile.worker` **não foi construído**.
- Branch `feat/rotina-checagem` (14/10/2026, box, variáveis fictícias, sem banco): `npm run lint` → exit 0; `npx tsc --noEmit --incremental false` → exit 0; `npm test` → 8 passaram, 0 falharam; `npm run build` → exit 0.
- Branch `feat/telas-auth` (14/10/2026, no box do Grok Bot, `npm ci` + variáveis fictícias, sem banco): `npm run lint` → exit 0; `npx tsc --noEmit --incremental false` → exit 0 (após o build gerar os tipos de rota; antes do build falha com `LayoutProps` não encontrado, pois esses tipos são gerados pelo Next); `npm run build` → exit 0; `prisma validate` → válido.
- `eslint .` → exit 0, sem avisos (14/10/2026, apuração).
- `tsc --noEmit --incremental false` → exit 0 (14/10/2026, apuração).
- **Build: NÃO confirmado.** Há `.next/BUILD_ID` de 13/10/2026 10:02 (indício, não prova).
- **Sem testes automatizados.** Os testes descritos no README foram manuais/temporários e não estão no repositório.

## Agendamento — situação
- D-008: principal = despertador Supabase (pg_cron a cada 1 min → Vercel). Reserva = cron diário da Vercel. Alternativa = worker próprio (D-007). Pendente: executar o SQL, configurar variáveis na Vercel e redeploy.
- Risco: projeto despertador no plano Free pode ser pausado (pg_cron não é garantido como "atividade"); mitigação em `docs/despertador-supabase.md`.
0. Decisão D-007: agendador próprio (worker) passa a ser o principal; cron diário da Vercel vira reserva opcional. Worker ainda **não implantado**.
1. ✅ Plano Vercel **Hobby confirmado** (comentário do `vercel[bot]` no PR #1: cron limitado a 1x/dia). Cron mantido em `0 9 * * *` (06:00 BRT, pode disparar até 06:59).
2. ✅ Frequência efetiva padrão: 1x/dia → intervalos oferecidos: 1, 2, 3 e 7 dias.
3. Opcional: agendador externo a cada 15 min (GitHub Actions) → intervalos a partir de 15 min, se configurado (ver HANDOFF).
4. Execução manual atualiza `lastRunAt` e adia a próxima automática (comportamento mantido; decidir com o usuário).
5. Default do `schema.prisma` (`intervalMinutes` = 360) não alterado para evitar migration; a API sempre envia o intervalo escolhido.

## Bancos e configurações externas — NÃO confirmados
- **Migration `20261015200000_project_account_email` NÃO aplicada.** Aplicar no Neon (`npm run db:migrate:deploy`, com autorização) **antes** do deploy desta versão; sem a coluna `accountEmail`, a leitura de projetos falha.
- **Migration `20261015000000_project_type` APLICADA no Neon de produção em 14/10/2026 23:21 BRT** (informado pelo usuário).
- **Migration `20261014000000_users_ownership` APLICADA no Neon de produção em 14/10/2026** (informado pelo usuário). Projetos antigos sem `ownerId` ficam invisíveis até atribuição.
- `ADMIN_PASSWORD` não é mais usada; `ADMIN_SESSION_SECRET` continua obrigatória.
- **Banco de controle (Neon):** `.env.local` local contém nomes de variáveis de Postgres/Neon preenchidas, mas **não foi verificado** se o banco existe, está acessível ou se a migration foi aplicada.
- **Projetos Supabase monitorados:** **não confirmado** que o SQL `sql/supabase_healthcheck_migration.sql` foi aplicado em algum projeto.
- **Variáveis na Vercel:** não verificadas (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `CRON_SECRET`, `ADMIN_SESSION_SECRET`, `ENCRYPTION_KEY`; opcionais `SCHEDULER_TICK_MINUTES`, `SCHEDULER_TICK_OFFSET_MINUTES`).
- **Deploy:** falhou no preview do PR #1 (14/10/2026 16:48 BRT). Comentário do Vercel no PR: conta Hobby só permite cron 1x/dia; a expressão `0 */6 * * *` é recusada. Projeto Vercel: `supabase-uptime-monitor` (neomars-projects-53c01d55). Plano Hobby **confirmado** por essa falha.

## Git
- `main` no GitHub (`maiszoomimpressos-create/monitor-projeto-`) com commit inicial + docs.
- PR #1 (`feat/telas-auth`) mesclado em `main` (9c2ce7a).
- Branch `feat/rotina-checagem` com PR aberto para `main` (não mesclado).

## Bloqueios
- Nenhum bloqueio de código. Falta configuração externa (CRON_SECRET na Vercel; agendador externo se quiser < 1 dia) e teste ponta a ponta.
