# DECISIONS.md

Registro de decisões do projeto. Novas decisões: adicionar no fim, com data, quem decidiu e impacto.

## D-001 — Frequência de acesso definida pelo cliente (14/10/2026, decisão do usuário)
**Decisão:** a frequência e a quantidade de acessos que o sistema faz a cada projeto Supabase monitorado devem ser **definidas pelo cliente (configuráveis)**, não fixadas pelo sistema.

**Diretrizes para a correção do agendamento:**
- O intervalo é configurado por projeto no painel; o sistema não deve impor um valor fixo único.
- O agendador do servidor precisa rodar com período **menor ou igual** ao menor intervalo que o cliente puder escolher; os limites oferecidos no painel devem refletir o que a hospedagem realmente suporta (e informar isso ao cliente).
- O painel deve exibir a próxima execução real, coerente com o agendador.
- Ainda a definir com o usuário: formato da escolha (presets ou valor livre), mínimos/máximos, se a execução manual reinicia a contagem.

**Situação:** NÃO implementado. Hoje o cron é fixo em 6 h (`vercel.ts`) e o painel oferece 1 h / aceita 5 min (ver `STATUS.md`).

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
