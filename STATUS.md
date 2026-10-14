# STATUS.md

_Última atualização: 14/10/2026 (apuração somente leitura + organização da documentação)._
Relatório completo da apuração: `C:\Users\Free\Desktop\CONTINUIDADE-SUPABASE\apuracao-grok.md` (fora do repositório).

Legenda: ✅ implementado e validado · 🟡 implementado, não validado · 🟠 parcial · ❌ ausente/não confirmado

## Funcionalidades
| Item | Estado | Onde |
|---|---|---|
| Cadastro / edição / ativação / exclusão de projetos | 🟡 | `src/app/admin/novo/page.tsx`, `src/app/admin/projetos/[id]/ProjectDetail.tsx`, `src/app/api/admin/projects/**` |
| Consulta real: `GET /rest/v1/{tabela}?select=id&limit=1`, headers `apikey` + `Bearer`, timeout 8 s, até 2 tentativas (só conexão/5xx/desconhecido) | 🟡 | `src/lib/check.ts` |
| "Possível pausa" após 3 falhas de conexão consecutivas | 🟡 | `src/lib/runCheck.ts` |
| Agendamento (Vercel Cron `0 */6 * * *` → `/api/cron/check-projects`, `Bearer CRON_SECRET`) | 🟠 inconsistências abaixo | `vercel.ts`, `src/app/api/cron/check-projects/route.ts` |
| Lock por projeto (update atômico, expira em 10 min) | 🟡 | `src/lib/runCheck.ts` |
| Isolamento de falhas (lotes de 5, `Promise.allSettled`) | 🟡 | `src/lib/sweep.ts` |
| Histórico + limpeza (30 dias / 200 por projeto) | 🟡 (UI mostra 50) | `src/lib/cleanup.ts`, `projetos/[id]/page.tsx` |
| Login admin (senha única, cookie HMAC 12 h) | 🟡 (sem limite de tentativas) | `src/lib/auth.ts`, `src/proxy.ts` |
| Criptografia AES-256-GCM das chaves | 🟡 | `src/lib/crypto.ts` |
| Proteção SSRF (https, `*.supabase.co/.in/.net`, DNS sem IP privado) | 🟠 (fetch segue redirects; faixas IPv6 incompletas) | `src/lib/ssrf.ts` |
| Testes automatizados | ❌ não existem | — |

## Validações com evidência
- `eslint .` → exit 0, sem avisos (14/10/2026, apuração).
- `tsc --noEmit --incremental false` → exit 0 (14/10/2026, apuração).
- **Build: NÃO confirmado.** Há `.next/BUILD_ID` de 13/10/2026 10:02 (indício, não prova).
- **Sem testes automatizados.** Os testes descritos no README foram manuais/temporários e não estão no repositório.

## Inconsistências conhecidas do agendamento (NÃO corrigidas)
1. Cron a cada 6 h, mas o painel oferece "a cada 1 hora" (`novo/page.tsx`) e o Zod aceita mínimo de 5 min (`validation.ts`) → frequências menores que 6 h nunca ocorrem; "próxima execução prevista" fica errada.
2. `isProjectDue` (`runCheck.ts`) não tem tolerância: com intervalo = período do cron, a diferença de segundos pode fazer o projeto rodar só a cada 12 h.
3. Plano da Vercel não confirmado: no Hobby, cron é limitado a 1 execução/dia.
4. Execução manual atualiza `lastRunAt` e adia a próxima automática.
5. `maxDuration = 60 s` pode estourar com ~15+ projetos vencidos ao mesmo tempo.

## Bancos e configurações externas — NÃO confirmados
- **Banco de controle (Neon):** `.env.local` local contém nomes de variáveis de Postgres/Neon preenchidas, mas **não foi verificado** se o banco existe, está acessível ou se a migration foi aplicada.
- **Projetos Supabase monitorados:** **não confirmado** que o SQL `sql/supabase_healthcheck_migration.sql` foi aplicado em algum projeto.
- **Variáveis na Vercel:** não verificadas (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `CRON_SECRET`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `ENCRYPTION_KEY`).
- **Deploy:** nunca realizado. Projeto local vinculado à Vercel (`.vercel/`, ignorado no Git).

## Git
- Commits locais iniciais (implementação + documentação). Sem remote/push.

## Bloqueios
- Definir como o cliente escolhe a frequência (D-001) e confirmar plano de hospedagem antes de corrigir o agendamento.
