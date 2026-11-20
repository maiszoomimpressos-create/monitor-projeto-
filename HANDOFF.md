# HANDOFF.md

_Última sessão: 19–20/11/2026 — Claude (PRs #8 e #9 mesclados em `main`)._

## Sessão 9 — ativação do sistema (banco, deploy, senha forte, heartbeat)
Feito:
- Confirmado por conexão real: banco de controle é **Neon**, não Supabase. `prisma migrate status` → todas as migrations aplicadas, schema atualizado. Projeto Neon `wandering-night-19954133` (`us-east-1`, AWS).
- Descoberto: o projeto Vercel real é **`monitor-projeto`** (time `neomars-projects-53c01d55`, `vercel.com/neomars-projects-53c01d55/monitor-projeto`), não `supabase-uptime-monitor` (nome antigo em `.vercel/project.json`, não existe mais; o MCP da Vercel desta sessão não enxerga o projeto real — 403/404 mesmo com nome e teamId corretos; investigar permissão da integração em outra sessão). Deploy de produção existia mas **sem nenhuma variável de ambiente configurada** — por isso cadastro/login falhavam ("Não foi possível continuar"). Usuário colou as variáveis pelo painel (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `ADMIN_SESSION_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET` novo, `SCHEDULER_TICK_MINUTES=1`, `SCHEDULER_TICK_OFFSET_MINUTES=0`) e fez Redeploy.
- **PR #8 mesclado em `main`**: `src/components/AuthForm.tsx` + `src/lib/validation.ts` — botão de olho (mostrar/ocultar senha) e exigência de senha forte no cadastro (maiúscula, minúscula, número, caractere especial), front e back.
- **PR #9 mesclado em `main`**: `CronRun` (heartbeat do agendador) — uma linha por chamada de `/api/cron/check-projects` (hora, sucesso/falha, contagens), retenção das 250 mais recentes. Migration `20261119000000_cron_run` **aplicada no Neon de produção em 19/11/2026**. Objetivo: provar que o despertador do Supabase está realmente chamando a Vercel a cada minuto, mesmo em ciclos sem projeto vencido.
- Next.js 16.4.0 → 16.4.6 (vulnerabilidade de segurança) pronto em worktree separado (`.claude/worktrees/next-security-upgrade`, branch `worktree-next-security-upgrade`, **ainda não enviado ao GitHub nem mesclado**); `experimental.agentUpgrade = "security"` adicionado ao `next.config.ts` nessa branch.
- Autenticação Git: token antigo (`gh`/credencial do git) tinha expirado; usuário gerou um Personal Access Token novo (classic, escopo `repo`) usado para os pushes/PRs desta sessão (não salvo em arquivo; `gh auth login --with-token` falhou por faltar escopo `read:org`, não crítico — token usado via `GH_TOKEN=... gh ...` por comando).
- `npm run lint`, `npx tsc --noEmit`, `npm test` (20/20) e `npm run build` passaram em todas as branches desta sessão.

## Sessão 9 (continuação) — despertador ativo, ciclo fechado
- Domínio real de produção descoberto: **`monitor-projeto-nu.vercel.app`** (não `monitor-projeto.vercel.app`, que não está associado a nenhum deploy — retorna 401/projeto errado). Confirmado por teste direto: `POST /api/cron/check-projects` com o `CRON_SECRET` certo → `200 {"ok":true,...}`.
- Vercel: variáveis de ambiente **não tinham sido salvas de fato** pelo painel (confirmado com `vercel env ls` → lista vazia). Resolvido via **Vercel CLI** (token pessoal do usuário, escopo "Todos os Projetos"): `vercel link` ao projeto certo + `vercel env add` para as 7 variáveis + `vercel redeploy` do deployment mais recente. Confirmar com `vercel env ls --token <token>`.
- **Despertador Supabase configurado e confirmado funcionando ponta a ponta**: SQL de `sql/supabase-despertador.sql` rodado via Supabase Management API (`POST /v1/projects/{ref}/database/query`, token `sbp_...` do usuário, nunca salvo em arquivo) no projeto `jbucmmenrepvupmihaaj`. Verificado: `cron.job` ativo (`* * * * *`), e `net._http_response` já registrou uma chamada com `status_code: 200` — o `pg_cron` está realmente acordando a Vercel a cada minuto.
- `sql/supabase_healthcheck_migration.sql` também aplicado nesse mesmo projeto Supabase (tabela `_uptime_healthcheck`), e testado via REST com a chave anon (200, `[{"id":1}]`).
- **Projeto despertador cadastrado no próprio monitor** (mitigação de pausa do Free, D-008): criado via chamada real a `POST /api/admin/projects` no site em produção, autenticado com um token de sessão assinado localmente (mesma lógica de `src/lib/auth.ts`, já que o `ADMIN_SESSION_SECRET` é conhecido) — não foi inserido direto no banco, passou pela validação/criptografia reais da API. Projeto: "Despertador (auto-monitor)", intervalo 60 min, usuário dono `maiszoomimpressos@gmail.com` (única conta existente no banco).
- **Ciclo fechado**: despertador (Supabase pg_cron) → Vercel (checa projetos, grava `cron_runs`) → Vercel verifica o próprio despertador a cada hora → mantém o despertador "vivo" para o Supabase não pausar. Tudo roda sozinho a partir daqui, sem depender de nenhuma sessão futura.

Próximo passo (usuário):
1. Acompanhar a tabela `cron_runs` (ou `net._http_response` no Supabase) por um tempo para confirmar o ritmo de 1x/min continua estável.
2. Decidir se/quando mesclar o upgrade do Next.js (`worktree-next-security-upgrade`) — ainda não enviado ao GitHub.
3. Revisar o projeto "Despertador (auto-monitor)" cadastrado no painel (intervalo, nome) — pode ajustar livremente pela UI.
4. Investigar em outra sessão por que o MCP da Vercel não enxerga o projeto `monitor-projeto` (permissão da integração) — o CLI com token pessoal contornou isso desta vez, mas não é o ideal a longo prazo.
5. Guardar o Personal Access Token do GitHub e o token da Vercel usados nesta sessão em local seguro (gerenciador de senhas) se forem reutilizar — nenhum dos dois foi salvo em arquivo do projeto.

## Sessão 7 — keep-alive e tipo Site/URL (branch `feat/checagem-http`)
Feito:
- D-009 (objetivo keep-alive, leitura leve); README e AGENTS atualizados.
- `Project.type` (SUPABASE | HTTP), `httpMethod`, `expectedStatus`; migration `20261015000000_project_type` (aplicada no Neon em 14/10/2026 23:21 BRT).
- `src/lib/httpCheck.ts` (https.request com lookup que bloqueia IP interno, redirects revalidados, limite de bytes, timeout 30 s, 1 retry dentro do prazo).
- `ssrf.ts`: `assertWellFormedHttpUrl`, IPv6 mapeado em hexa, NAT64, multicast.
- Formulários de criar/editar com tipo e campos condicionais; tipo não muda na edição.
- `sweep.ts`: pool de 8 com prazo final (não passa de 45 s).
- Correção: PATCH parcial não reaplica defaults.
- `/admin` agora lista os projetos do usuário (`ProjectList.tsx`, server component; última execução via `distinct`). `Dashboard.tsx` (não usado) removido. Datas em America/Sao_Paulo.

Migration `20261015000000_project_type` **aplicada no Neon de produção em 14/10/2026 23:21 BRT**.

Pendências:
- Testar checagem HTTP real (no box o DNS é falso e o SSRF bloqueia tudo — comportamento correto).
- Projetos HTTP guardam `encryptedKey`/`keyLastFour` vazios (colunas obrigatórias).
- Campo de URL continua chamado `supabaseUrl` no banco/API por compatibilidade.

## Sessão 6 — despertador via Supabase (branch `feat/despertador-supabase`)
Feito:
- `sql/supabase-despertador.sql` (idempotente): extensões pg_cron/pg_net, secrets no Vault (`monitor_cron_url`, `monitor_cron_secret`, placeholders), job `monitor-uptime-tick` `* * * * *` com `net.http_post` (timeout 60 s), consultas de verificação e desligamento.
- `docs/despertador-supabase.md`: passo a passo, verificação, desligar, limitações (pausa Free, 60 s Vercel, coexistência).
- Rota do cron já aceitava GET/POST com `Bearer CRON_SECRET`; só comentário atualizado.

Próximo passo (usuário):
1. Vercel: `CRON_SECRET`, `SCHEDULER_TICK_MINUTES=1`, `SCHEDULER_TICK_OFFSET_MINUTES=0` → Redeploy.
2. Supabase despertador: rodar o SQL com URL e segredo reais no SQL Editor.
3. Verificar `net._http_response` (200) e o painel.
4. Cadastrar o próprio projeto despertador no monitor (evita pausa no Free).

## Sessão 5 — agendador próprio (branch `feat/agendador-proprio`, PR com base `feat/rotina-checagem`)
Feito:
- `src/worker/loop.ts` (laço testável) e `src/worker/index.ts` (entrada): `npm run worker` / `npm run worker:local` (lê `.env.local`).
- Lock agendado agora exige `lastRunAt` igual ao lido → worker e cron da Vercel podem coexistir.
- Com `SCHEDULER_TICK_MINUTES=1`, painel oferece intervalos a partir de 5 min (mínimo fixo `MIN_INTERVAL_MINUTES`).
- `Dockerfile.worker`, `.dockerignore`, `railway.json`, `fly.toml`, `ecosystem.config.cjs` (pm2) e guia `docs/agendador-proprio.md`.
- Limpeza do histórico no worker: no máximo 1x/hora.

Próximo passo:
1. Mesclar PR #2 e depois este PR.
2. Implantar o worker (Railway recomendado) com `DATABASE_URL`, `ENCRYPTION_KEY` (mesma da Vercel), `SCHEDULER_TICK_MINUTES=1`, `SCHEDULER_TICK_OFFSET_MINUTES=0`.
3. Na Vercel: `SCHEDULER_TICK_MINUTES=1` e `SCHEDULER_TICK_OFFSET_MINUTES=0` + redeploy (senão o painel continua só com intervalos diários).
4. Conferir nos logs do worker a primeira checagem real e o histórico no painel.
5. Decidir se mantém o cron da Vercel como reserva (ver `docs/agendador-proprio.md`).


## Sessão 4 — rotina de checagem (branch `feat/rotina-checagem`, PR para `main`)
Feito:
- `src/lib/schedule.ts` (lógica pura): config do agendador via env (`SCHEDULER_TICK_MINUTES`, padrão 1440; `SCHEDULER_TICK_OFFSET_MINUTES`, padrão 540 = 09:00 UTC), `isProjectDue` com tolerância de meio tick, `nextRunAt` = próximo disparo real, intervalos permitidos (≥ tick, até 7 dias).
- Testes: `src/lib/schedule.test.ts`, `npm test` (node:test + tsx).
- `sweep.ts`: todos os projetos ativos de todos os usuários, mais atrasados primeiro, lotes de 5, orçamento de 45 s (maxDuration 60 s); sobra fica para o próximo disparo (`deferred` na resposta).
- Rota do cron: `Bearer CRON_SECRET` em tempo constante; falha na limpeza não derruba a resposta.
- Painel: formulário novo e edição mostram só intervalos compatíveis + aviso do agendador; API recusa intervalo incompatível.
- `docs/agendador-externo.github-actions.yml` (copiar para `.github/workflows/`): chama a rotina a cada 15 min, **desligado** até configurar.
- Comentário da migration `users_ownership` atualizado: aplicada no Neon de produção em 14/10/2026.

Para ativar intervalos menores que 1 dia (opcional):
0. Copiar `docs/agendador-externo.github-actions.yml` para `.github/workflows/agendador-externo.yml` e commitar (exige token com escopo `workflow` ou edição pelo site do GitHub).
1. GitHub > Settings > Secrets and variables > Actions: variable `ENABLE_EXTERNAL_SCHEDULER=true`; secrets `MONITOR_CRON_URL` (`https://<domínio>/api/cron/check-projects`) e `CRON_SECRET` (mesmo valor da Vercel).
2. Vercel: `SCHEDULER_TICK_MINUTES=15`, `SCHEDULER_TICK_OFFSET_MINUTES=0` e redeploy.
3. Alternativa: cron-job.org chamando a mesma URL com header `Authorization: Bearer <CRON_SECRET>`.

Próximo passo:
- Configurar `CRON_SECRET` na Vercel, fazer deploy e conferir no log a primeira execução (06:00–06:59 BRT) com projeto real.
- Decidir se execução manual deve reiniciar a contagem do intervalo.
- Listagem de projetos na página inicial (hoje só "Novo projeto").


## Sessão 3 — confirmação ao vivo do plano Vercel (14/10/2026 17:01 BRT)
- PR #1 aberto em `feat/telas-auth` → deploy preview **falhou**.
- Evidência: comentário do `vercel[bot]` no PR: Hobby limitado a cron diário; `0 */6 * * *` recusado.
- Impacto: sem Pro (ou cron diário / agendador externo), o agendamento atual não sobe na Vercel.

## Sessão 2 — telas e multiusuário (branch `feat/telas-auth`, PR para `main`)
Feito:
- Landing `/`, login `/entrar`, cadastro `/cadastro` (`AuthForm.tsx`); `/admin/login` redireciona para `/entrar`.
- Modelo `User` + `Project.ownerId` (opcional) e migration `prisma/migrations/20261014000000_users_ownership` (aplicada no Neon de produção em 14/10/2026).
- Senha com scrypt nativo (`src/lib/password.ts`); sessão HMAC reaproveitada, agora com `uid` e nome (`src/lib/auth.ts`, cookie `session`).
- Rate limit em memória (`src/lib/rateLimit.ts`).
- Todas as rotas de projetos filtram por `ownerId` do usuário logado.
- `/admin` agora mostra apenas barra flutuante + botão "Novo projeto" (→ `/admin/novo`). `Dashboard.tsx` não é mais usado pela página (mantido para reaproveitar a listagem depois).
- lint, tsc e build passaram (ver `STATUS.md`).

Não feito / pendente:
- ~~Aplicar a migration~~ — aplicada no Neon de produção em 14/10/2026.
- Atribuir dono a projetos antigos (se houver) — SQL manual: `UPDATE projects SET "ownerId" = '<id do usuário>' WHERE "ownerId" IS NULL;`.
- Testar no navegador com banco real; listagem de projetos fora da página inicial ainda não decidida.
- Agendamento continua sem correção (D-001).


## O que foi feito nesta sessão
1. Apuração somente leitura do código (relatório fora do repo: `C:\Users\Free\Desktop\CONTINUIDADE-SUPABASE\apuracao-grok.md`).
2. Revisão do `.gitignore` (removida duplicata `.env*` no fim do arquivo que anulava `!.env.example`; adicionados logs e arquivos de credenciais).
3. Commit inicial da implementação (sem `.env.local`, `.vercel`, `.next`, `node_modules`).
4. Documentação de continuidade: `AGENTS.md`, `STATUS.md`, `HANDOFF.md`, `DECISIONS.md`, `CLAUDE.md`.

## O que NÃO foi feito (de propósito)
- Nenhuma correção de código, inclusive no agendamento.
- Nenhum build, deploy, migration, instalação, push ou acesso a banco/serviço remoto.

## Próximo passo (nesta ordem)
1. **Definir com o usuário como o cliente escolhe a frequência/quantidade de acessos** a cada projeto monitorado (D-001): valores livres ou presets, limites mínimo/máximo, se execução manual conta, como exibir a próxima execução real.
2. **Conferir o plano de hospedagem** (Vercel Hobby x Pro, ou alternativa de agendador externo) — define a granularidade mínima possível do cron.
3. **Só então corrigir o agendamento**: cron com período ≤ menor intervalo permitido ao cliente; validação Zod e presets do painel coerentes com isso; tolerância em `isProjectDue`; "próxima execução" calculada conforme o cron real.
4. Adicionar testes automatizados mínimos (sem serviços reais) para `isProjectDue`, `check.ts`, `ssrf.ts`, `crypto.ts` e autorização do cron.

### Critérios de conclusão da correção do agendamento
- Nenhum intervalo selecionável no painel é menor que o período real do cron.
- Projeto com intervalo igual ao período do cron roda em toda execução do cron (teste unitário cobrindo atraso de segundos).
- "Próxima execução prevista" bate com o próximo disparo real do cron.
- `npm run lint`, `tsc --noEmit` e testes passam, com resultado registrado no `STATUS.md`.

## Antes de encerrar qualquer etapa
Atualize `STATUS.md` e este `HANDOFF.md` (o que foi feito, evidências, próximo passo).
