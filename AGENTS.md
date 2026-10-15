# AGENTS.md — Monitor de Disponibilidade Supabase (handoff para IAs)

**Antes de trabalhar, leia nesta ordem:** `STATUS.md` → `HANDOFF.md` → `DECISIONS.md`.

## Objetivo do sistema
**Keep-alive:** manter acordados sistemas em planos gratuitos que pausam/congelam por inatividade (Supabase Free, sites/apps free), gerando atividade periódica com **leituras leves** (sem login, sem inserção) — D-009. Tipos de projeto: **Supabase** (leitura via PostgREST) e **Site/URL** (GET/HEAD https). **A frequência de acesso a cada projeto é definida pelo cliente** (D-001). Agendamento principal: despertador Supabase pg_cron → Vercel (D-008).

## Stack (conferida no código em 14/10/2026)
Next.js 16.4 (App Router, `src/proxy.ts`) · React 19.3 · Prisma 6.19 + PostgreSQL (banco de controle, previsto Neon) · Zod 4 · Tailwind 4 · Vercel + Vercel Cron Jobs (`vercel.ts`).

## Estrutura essencial
```
D:\PROJETOS ON LINE\SIMULAÇAO HUMANO\
  vercel.ts                               config Vercel + cron (fonte de verdade do agendamento)
  prisma/schema.prisma                    modelo do banco de controle
  prisma/migrations/20261013000000_init/  migration do banco de controle (escrita à mão, não aplicada/confirmada)
  sql/supabase_healthcheck_migration.sql  SQL para cada projeto Supabase monitorado
  src/lib/                                lógica (check, runCheck, sweep, ssrf, crypto, auth, cleanup)
  src/app/admin/                          painel
  src/app/api/                            rotas admin + /api/cron/check-projects
  .env.example                            nomes de variáveis (valores fictícios)
```

## Comandos
```bash
npm run dev                 # desenvolvimento local
npm run lint                # eslint (aprovado em 14/10/2026)
npx tsc --noEmit            # tipos (aprovado em 14/10/2026)
npm run build               # build (NÃO confirmado)
npm run db:migrate:deploy   # aplica migrations — só com autorização explícita do usuário
```
Não existe script de testes.

## Regras para qualquer IA
1. Ler `STATUS.md`, `HANDOFF.md` e `DECISIONS.md` antes de trabalhar.
2. Trabalhar em etapas pequenas e commits pequenos.
3. **Ao concluir cada etapa (ou encontrar bloqueio), atualizar `STATUS.md` e `HANDOFF.md`** e, se houver decisão nova, `DECISIONS.md`.
4. Nunca registrar segredos (nem em docs, nem em commits). Citar só nomes de variáveis.
5. Não descartar alterações existentes; não usar `git reset --hard`/force-push sem autorização.
6. Deploy, migrations, acesso a bancos reais e push só com autorização explícita do usuário.
7. Não declarar build/lint/testes aprovados sem evidência (comando + data + resultado).
8. Não presumir que bancos (Neon ou Supabase monitorados) estão configurados só porque o código os referencia.
