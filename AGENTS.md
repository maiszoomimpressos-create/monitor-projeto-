## Monitor de Disponibilidade Supabase - Handoff para IAs

**Antes de trabalhar:** Leia STATUS.md, HANDOFF.md e DECISIONS.md.

### Objetivo do sistema
Sistema para consultar periodicamente projetos Supabase via leitura real no banco (API REST/PostgREST), com agendamento no servidor e painel de acompanhamento.

### Estrutura essencial
```
D:\PROJETOS ON LINE\SIMULAÇAO HUMANO\
 prisma/schema.prisma              # Modelo do banco de controle
 vercel.ts                         # Configuração Vercel + Cron
 src/lib/                          # Lógica de negócio
 src/app/admin/                    # Painel administrativo (App Router)
 src/app/api/                      # Endpoints (cron + admin)
 sql/supabase_healthcheck_migration.sql  # Migration para projetos monitorados
```

### Comandos de desenvolvimento
```bash
npm run dev              # Desenvolvimento local
npm run build            # Build para produção
npm run lint             # Lint
npm run db:migrate:deploy  # Aplicar migrations
```

### Regra para qualquer IA
1. Ler STATUS.md e HANDOFF.md antes de trabalhar
2. Trabalhar em etapas pequenas
3. Atualizar STATUS.md e HANDOFF.md ao concluir etapas ou encontrar bloqueios
4. Nunca registrar segredos
5. Não descartar alterações existentes