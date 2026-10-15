# DECISIONS.md

Registro de decisões do projeto. Novas decisões: adicionar no fim, com data, quem decidiu e impacto.

## D-001 — Frequência de acesso definida pelo cliente (14/10/2026, decisão do usuário)
**Decisão:** a frequência e a quantidade de acessos que o sistema faz a cada projeto Supabase monitorado devem ser **definidas pelo cliente (configuráveis)**, não fixadas pelo sistema.

**Diretrizes para a correção do agendamento:**
- O intervalo é configurado por projeto no painel; o sistema não deve impor um valor fixo único.
- O agendador do servidor precisa rodar com período **menor ou igual** ao menor intervalo que o cliente puder escolher; os limites oferecidos no painel devem refletir o que a hospedagem realmente suporta (e informar isso ao cliente).
- O painel deve exibir a próxima execução real, coerente com o agendador.
- Ainda a definir com o usuário: formato da escolha (presets ou valor livre), mínimos/máximos, se a execução manual reinicia a contagem.

**Situação:** implementado na branch `feat/rotina-checagem` (ver D-006). Antes: cron diário `0 9 * * *` (06:00 BRT) por decisão do usuário (ficar no Vercel Hobby, 14/10/2026); painel e validação alinhados a mínimo de 1 dia.

## D-002 — Leitura leve via PostgREST com chave anon (herdada da implementação inicial)
Checagem por `GET /rest/v1/_uptime_healthcheck?select=id&limit=1` usando a chave **anon**, em tabela dedicada com RLS só-leitura (`sql/supabase_healthcheck_migration.sql`). Nunca usar `service_role`.

## D-003 — Banco de controle separado (herdada)
Cadastro e histórico ficam em um Postgres próprio (previsto Neon via Vercel), separado dos projetos monitorados. Credenciais cifradas com AES-256-GCM (`ENCRYPTION_KEY` só em variável de ambiente).

## D-004 — Segredos fora do Git (14/10/2026)
`.env*` (exceto `.env.example`), `.vercel/`, `.next/`, `node_modules/`, logs e arquivos de credenciais são ignorados. `.env.example` contém só nomes e valores fictícios.

## D-005 — Multiusuário com cadastro aberto (14/10/2026, pedido do usuário)
**Decisão:** substituir o login de administrador único (`ADMIN_PASSWORD`) por cadastro/login de usuários com e-mail e senha. Cada projeto pertence a um usuário (`ownerId`) e cada usuário só vê/edita/verifica os próprios projetos.
**Detalhes:** senha com scrypt nativo do Node (sem dependência nova); sessão em cookie HMAC (`ADMIN_SESSION_SECRET`) com `uid`; rate limit simples em memória. O cron continua verificando todos os projetos ativos, de qualquer usuário.
**Impacto:** exige aplicar a migration `20261014000000_users_ownership`; projetos antigos sem dono ficam invisíveis até atribuição manual.

## D-006 — Agendador configurável e compatível com o plano (14/10/2026)
**Contexto:** Vercel Hobby confirmado (cron só 1x/dia; deploy com `0 */6 * * *` recusado).
**Decisão:**
- Vercel Cron diário `0 9 * * *` (06:00 BRT) funciona em qualquer plano e é o padrão.
- O período do agendador ativo é declarado em `SCHEDULER_TICK_MINUTES` (padrão 1440) e `SCHEDULER_TICK_OFFSET_MINUTES` (padrão 540). O painel só oferece intervalos ≥ esse período (presets de 5 min a 7 dias) e a API recusa os demais.
- Para intervalos menores: agendador externo chamando a mesma rota com `Bearer CRON_SECRET` (workflow GitHub Actions a cada 15 min incluído, desligado por padrão; ou cron-job.org). No Pro, pode-se trocar o cron da Vercel para `*/15 * * * *`.
- Projeto vence quando falta menos de meio período do agendador; "próxima execução" é o próximo disparo em que estará vencido.
- Execução limitada a 45 s por chamada; projetos excedentes ficam para o próximo disparo.
**Impacto:** sem mudança de banco (nenhuma migration nova).

## D-007 — Agendador próprio independente da Vercel (14/10/2026, decisão do usuário)
**Decisão:** as checagens passam a ser disparadas por um processo Node de longa duração (`src/worker`), hospedado no Railway/Fly.io ou em máquina própria (pm2). Ele consulta o banco de controle a cada `WORKER_TICK_SECONDS` (padrão 60 s) e reaproveita a lógica de `src/lib` (sweep, lock, isolamento, crypto, SSRF). A Vercel fica só com as telas/API.
**Detalhes:** com o worker, `SCHEDULER_TICK_MINUTES=1` (worker e Vercel); intervalo mínimo oferecido ao cliente: **5 min** (evita carga desnecessária nos projetos monitorados e respeita a duração das checagens, até ~20 s). O cron diário da Vercel pode continuar como reserva: o lock compara `lastRunAt`, impedindo checagem dupla.
**Impacto:** novo serviço a hospedar e manter (custo/plano do Railway ou máquina ligada); sem mudança de banco.

## D-008 — Despertador via Supabase pg_cron como opção principal (14/10/2026, decisão do usuário)
**Decisão:** um projeto Supabase chama a cada 1 min `POST /api/cron/check-projects` na Vercel via pg_cron + pg_net, com `Authorization: Bearer CRON_SECRET` lido do Supabase Vault (`sql/supabase-despertador.sql`). Vercel com `SCHEDULER_TICK_MINUTES=1` e `SCHEDULER_TICK_OFFSET_MINUTES=0` (intervalos a partir de 5 min).
**Reserva:** cron diário da Vercel continua ativo. **Alternativa:** worker próprio (D-007), não obrigatório.
**Riscos:** no plano Free o projeto despertador pode ser pausado após 7 dias sem atividade de usuário (pg_cron não é documentado como atividade) → cadastrar o próprio despertador no monitor; limite de 60 s por chamada na Vercel (rotina usa 45 s; sobra vai para o minuto seguinte). Lock impede checagem dupla entre agendadores.

## D-009 — Objetivo real: keep-alive com leitura leve (14/10/2026, decisão do usuário)
**Decisão:** o produto existe para **manter acordados** sistemas em planos gratuitos que pausam/congelam por inatividade, gerando atividade periódica. A atividade é sempre uma **leitura leve**: nada de login automatizado, envio de formulário ou inserção de dados.
**Implementação:** dois tipos de projeto (`Project.type`):
- `SUPABASE` — leitura PostgREST de 1 linha (como antes, restrito a `*.supabase.co/.in/.net`).
- `HTTP` — GET (ou HEAD) em URL https pública; timeout 30 s; 1 retentativa se houver tempo; sucesso = 2xx/3xx ou status esperado; no máximo 3 redirects; lê no máximo 64 KB; User-Agent `MonitorKeepAlive/1.0`; SSRF: só https na porta 443, bloqueio de IPs privados/loopback/link-local/metadata/NAT64 e nomes internos, DNS validado no momento da conexão (lookup próprio) e em cada redirect.
**Impacto:** migration `20261015000000_project_type` (precisa ser aplicada no Neon antes do deploy). Rotina passou a usar pool de 8 checagens com prazo final; HTTP só inicia se restarem ≥ 32 s do orçamento de 45 s.
