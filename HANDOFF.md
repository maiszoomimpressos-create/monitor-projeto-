# HANDOFF.md

_Última sessão: 14/10/2026 — Grok Bot (branch `feat/telas-auth`)._

## Sessão 2 — telas e multiusuário (branch `feat/telas-auth`, PR para `main`)
Feito:
- Landing `/`, login `/entrar`, cadastro `/cadastro` (`AuthForm.tsx`); `/admin/login` redireciona para `/entrar`.
- Modelo `User` + `Project.ownerId` (opcional) e migration `prisma/migrations/20261014000000_users_ownership` (**só arquivo, não aplicada**).
- Senha com scrypt nativo (`src/lib/password.ts`); sessão HMAC reaproveitada, agora com `uid` e nome (`src/lib/auth.ts`, cookie `session`).
- Rate limit em memória (`src/lib/rateLimit.ts`).
- Todas as rotas de projetos filtram por `ownerId` do usuário logado.
- `/admin` agora mostra apenas barra flutuante + botão "Novo projeto" (→ `/admin/novo`). `Dashboard.tsx` não é mais usado pela página (mantido para reaproveitar a listagem depois).
- lint, tsc e build passaram (ver `STATUS.md`).

Não feito / pendente:
- Aplicar a migration no banco de controle (autorização do usuário).
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
