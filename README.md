# Monitor de Disponibilidade Supabase

Painel web + agendamento no servidor para checar periodicamente se os seus
projetos Supabase continuam respondendo, através de uma leitura real e leve
no banco (via API REST/PostgREST) — sem navegador aberto, sem celular ligado,
sem simular usuário.

> **Limite importante:** estas checagens **não garantem** que um projeto no
> plano gratuito do Supabase deixará de ser pausado por inatividade. Elas
> apenas avisam, com evidência, quando um projeto já cadastrado parece
> inacessível — a restauração continua sendo manual, pelo painel do Supabase.

## Arquitetura

- **Next.js (App Router)**, pensado para deploy no Vercel.
- **Banco de controle** separado (Postgres, ex.: via Vercel Marketplace/Neon)
  guardando apenas: cadastro dos projetos monitorados e histórico de
  execuções. Isto é diferente dos projetos Supabase monitorados.
- **Vercel Cron Jobs** (`vercel.ts`) chama `GET /api/cron/check-projects` em
  um servidor fora de qualquer projeto Supabase monitorado — a pausa de um
  deles não afeta o agendamento dos outros.
- Cada checagem faz uma leitura mínima (`select=id&limit=1`) na tabela
  dedicada `_uptime_healthcheck` do projeto monitorado, usando a **chave anon**
  (não a `service_role`).

## O que foi implementado

### 1. Cadastro de projetos (`/admin`, `/admin/novo`, `/admin/projetos/[id]`)
- Nome, URL, chave de API, tabela de verificação, intervalo (minutos) e
  ativar/desativar — tudo em português.
- A URL é validada (precisa ser `https://*.supabase.co|.in|.net`) e o
  hostname é resolvido e checado contra faixas de IP privadas/internas antes
  de qualquer chamada (`src/lib/ssrf.ts`) — proteção contra SSRF, inclusive
  revalidada a cada execução (não só no cadastro).
- A chave de API é criptografada com AES-256-GCM (`src/lib/crypto.ts`) antes
  de ir para o banco; a chave de criptografia (`ENCRYPTION_KEY`) só existe em
  variável de ambiente do servidor, nunca no banco. O frontend só recebe os
  últimos 4 caracteres mascarados.

### 2. Consulta real ao banco (`src/lib/check.ts`)
- `GET {supabaseUrl}/rest/v1/{tabela}?select=id&limit=1` com `apikey` +
  `Authorization: Bearer`. Isso atravessa o PostgREST e chega ao Postgres —
  não é só a página inicial do site.
- Nunca insere/atualiza/deleta nada.
- Timeout (8s) via `AbortController` + até 2 tentativas, mas **somente** para
  falhas consideradas temporárias (conexão/timeout/5xx). Erros de
  autenticação (401/403) e de configuração (404 — tabela ausente) não são
  repetidos.

### 3. Migration da tabela de verificação (`sql/supabase_healthcheck_migration.sql`)
A ser aplicada **em cada projeto Supabase que você quer monitorar** (não no
banco de controle deste painel):
- Cria `public._uptime_healthcheck` com **uma única linha fixa** (`id = 1`,
  `CHECK (id = 1)`), sem dados de negócio.
- Habilita RLS + `FORCE ROW LEVEL SECURITY`.
- Revoga tudo de `PUBLIC`/`anon`/`authenticated` e concede **apenas SELECT**
  para `anon`. Nenhuma política de INSERT/UPDATE/DELETE é criada — essas
  operações continuam bloqueadas por padrão do RLS para qualquer papel.
- Idempotente (pode rodar de novo sem duplicar a linha ou as policies).

### 4. Agendamento (`vercel.ts` + `src/app/api/cron/check-projects/route.ts`)
- Vercel Cron Jobs chama `/api/cron/check-projects` uma vez por dia, às
  09:00 UTC / 06:00 BRT (`0 9 * * *`), limite do plano Hobby.
- O endpoint exige `Authorization: Bearer <CRON_SECRET>` — sem o segredo
  correto, responde 401. Se a variável `CRON_SECRET` estiver configurada no
  projeto Vercel, a própria plataforma já envia esse header automaticamente
  nas chamadas de cron.
- **Lock por projeto** (`src/lib/runCheck.ts`): antes de checar, tenta um
  `UPDATE ... WHERE isRunning = false OR runningSince < agora-10min`
  atômico. Se 0 linhas forem afetadas, outra execução já está em andamento e
  esta é pulada (sem duplicar). O lock expira sozinho após 10 min para o
  caso de uma função ter travado/crashado.
- **Isolamento de falhas** (`src/lib/sweep.ts`): cada projeto roda dentro de
  `Promise.allSettled`; uma exceção ou falha em um projeto não impede os
  demais de serem verificados na mesma varredura.
- Limpeza de histórico automática a cada execução do cron
  (`src/lib/cleanup.ts`): mantém no máximo 200 execuções por projeto e
  remove registros com mais de 30 dias.

### 5. Painel (`/admin`)
- Lista de projetos com: última execução, última consulta com sucesso,
  próxima execução prevista, intervalo, status atual.
- Botão **"Verificar agora"** por projeto (`POST /api/admin/projects/:id/check`),
  sujeito ao mesmo lock do agendamento.
- Página de detalhe por projeto com histórico (até 200 execuções), duração
  em ms, origem (agendado/manual) e mensagem de erro compreensível.
- Classificação de status diferenciando: `SUCESSO`, `FALHA_CONEXAO`,
  `FALHA_AUTENTICACAO`, `FALHA_CONFIGURACAO` (tabela/migration ausente),
  `POSSIVEL_PAUSA` e `ERRO_DESCONHECIDO`.
- **"Possível pausa"** só é exibido depois de **3 falhas de conexão
  consecutivas** (`src/lib/runCheck.ts`) — nunca após uma falha isolada — e o
  texto sempre orienta a confirmar e restaurar pelo painel do Supabase, nunca
  promete fazer isso automaticamente.

### 6. Segurança
- `/admin/*` e `/api/admin/*` protegidos por sessão de administrador
  (`src/proxy.ts` + `src/lib/auth.ts`): cookie `HttpOnly`, assinado com HMAC
  (`ADMIN_SESSION_SECRET`), senha única comparada em tempo constante
  (`ADMIN_PASSWORD`). Cada rota de API também revalida a sessão
  (`src/lib/requireAdmin.ts`), em defesa de profundidade além do proxy.
- Nenhuma credencial é devolvida ao navegador, logada ou commitada —
  `encryptedKey` é removido antes de qualquer resposta
  (`src/lib/serialize.ts`).
- `/api/cron/check-projects` é o único endpoint sem sessão de admin, e exige
  o `CRON_SECRET` em vez disso.

## O que ainda depende de você

Nenhum deploy ou migration foi aplicado em produção nesta etapa — faltam
credenciais reais. Para colocar em funcionamento:

1. **Banco de controle**: provisione um Postgres (ex.: `vercel integration add neon`
   ou outro Postgres gerenciado) e defina `DATABASE_URL`. Depois rode:
   ```bash
   npx prisma migrate deploy
   ```
   (a migration inicial já está em `prisma/migrations/20261013000000_init/`).
2. **Projeto(s) Supabase monitorado(s)**: no SQL Editor de cada projeto que
   você quer monitorar, execute `sql/supabase_healthcheck_migration.sql`.
   Depois, cadastre no painel a URL do projeto e a chave **anon** (em
   *Project Settings → API*).
3. **Variáveis de ambiente** (veja `.env.example`): `DATABASE_URL`,
   `CRON_SECRET`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `ENCRYPTION_KEY`.
   Configure-as no projeto Vercel (`vercel env add ...` ou pelo dashboard).
4. **Plano do Vercel para o cron**: o projeto usa o plano Hobby, que limita
   Cron Jobs a 1 execução por dia; por isso o `schedule` em `vercel.ts` é
   `"0 9 * * *"` (06:00 BRT). Frequências maiores exigem o plano Pro.
5. **Deploy**: `vercel deploy --prod` (não executado por mim nesta etapa).

## Variáveis de ambiente

Veja `.env.example` para o modelo completo, sem segredos reais. Resumo:

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | Postgres do banco de controle (projetos + histórico) |
| `CRON_SECRET` | Autoriza o Vercel Cron a chamar `/api/cron/check-projects` |
| `ADMIN_PASSWORD` | Senha única do administrador do painel |
| `ADMIN_SESSION_SECRET` | Assina o cookie de sessão do painel (HMAC) |
| `ENCRYPTION_KEY` | Criptografa as chaves de API dos projetos monitorados (32 bytes base64) |

## Testes realizados nesta etapa

Sem acesso a um projeto Supabase real nem a um Postgres de produção, a
validação foi feita contra servidores/bases locais temporárias (não fazem
parte do repositório):

- **Classificação de resultado** (`performCheckWithRetry`): testada contra um
  servidor HTTP local simulando sucesso (200), falha de autenticação (401),
  tabela ausente (404), timeout e conexão recusada — todos os 5 casos
  classificados corretamente, com retentativa aplicada apenas nos casos
  transitórios (timeout/conexão), nunca em 401/404.
- **Proteção SSRF**: confirmado que `http://` é rejeitado, domínios fora de
  `*.supabase.co/.in/.net` são rejeitados, e `localhost`/`127.0.0.1` são
  bloqueados na resolução de DNS.
- **Criptografia**: round-trip `encryptSecret`/`decryptSecret` preserva o
  valor original e o valor armazenado nunca contém o segredo em texto puro.
- **Lock anti-duplicação**: duas chamadas concorrentes para o mesmo projeto
  resultam em exatamente 1 execução real e 1 "pulada"; o lock é liberado ao
  final.
- **Isolamento de falhas no sweep**: com um projeto em estado de erro
  (credencial corrompida) e outro saudável, ambos aparecem no resumo da
  varredura — o erro de um não impede a checagem do outro, e nenhuma
  exceção crua escapa do processo.
- **Autorização do cron**: requisição sem o header correto é rejeitada;
  com o `CRON_SECRET` correto, é aceita.
- `npx next build` e `npx eslint .` executados sem erros.

**Não testado** (requer as credenciais reais que ainda não tenho): uma
consulta de ponta a ponta contra um projeto Supabase de produção seu, e o
disparo real do Vercel Cron Job em um deployment ativo. Depois do deploy,
você pode validar manualmente chamando:
```bash
curl -H "Authorization: Bearer SEU_CRON_SECRET" https://seu-dominio/api/cron/check-projects
```

## Estrutura de pastas relevante

```
prisma/schema.prisma                         modelo do banco de controle
prisma/migrations/20261013000000_init/       migration do banco de controle
sql/supabase_healthcheck_migration.sql       migration p/ projetos monitorados
src/lib/                                     lógica (crypto, ssrf, check, lock, auth...)
src/app/api/admin/...                        CRUD de projetos + login (admin)
src/app/api/cron/check-projects/route.ts     endpoint chamado pelo Vercel Cron
src/app/admin/...                            painel (dashboard, cadastro, detalhe)
src/proxy.ts                                 protege /admin e /api/admin
vercel.ts                                    configuração do projeto + cron
.env.example                                 modelo de variáveis de ambiente
```
