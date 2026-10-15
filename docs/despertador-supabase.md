# Despertador via Supabase (pg_cron + pg_net) — opção principal (D-008)

Um projeto Supabase (o "despertador") chama, a cada 1 minuto, o endpoint do monitor na Vercel:

```
POST https://<seu-dominio>/api/cron/check-projects
Authorization: Bearer <CRON_SECRET>
```

A Vercel roda as checagens vencidas (mesma rotina do cron/worker: lock, isolamento, SSRF,
criptografia) e grava o histórico. Nada precisa ficar rodando fora da Vercel e do Supabase.
A rota aceita GET e POST; o corpo é ignorado.

## Passo a passo

### 1. Vercel (Project Settings > Environment Variables, ambiente Production)
| Variável | Valor |
|---|---|
| `CRON_SECRET` | valor longo e aleatório (`openssl rand -hex 32`) |
| `SCHEDULER_TICK_MINUTES` | `1` |
| `SCHEDULER_TICK_OFFSET_MINUTES` | `0` |

Depois faça **Redeploy** (variáveis só valem em um novo deploy). Com isso o painel passa a
oferecer intervalos a partir de 5 min.

### 2. Supabase (projeto despertador) > SQL Editor
1. Abra `sql/supabase-despertador.sql`, cole no SQL Editor.
2. No bloco 2, troque **somente no editor** os dois placeholders `<...>`:
   - URL completa: `https://<seu-dominio>/api/cron/check-projects`
   - o mesmo valor do `CRON_SECRET` da Vercel.
3. Execute (Run). O script é idempotente: pode rodar de novo para trocar URL/segredo.
   Alternativa: crie os secrets `monitor_cron_url` e `monitor_cron_secret` pelo painel
   (Project Settings > Vault) e execute só os blocos 1 e 3.
4. Não salve a consulta com o segredo preenchido (ou apague-o depois).

### 3. Verificar (alguns minutos depois)
Use as consultas comentadas no fim do SQL:
- `cron.job` → job `monitor-uptime-tick` com `active = true`.
- `cron.job_run_details` → execuções a cada minuto com `succeeded` (isso só indica que a
  requisição foi enfileirada).
- `net._http_response` → **status_code 200** e corpo `{"ok":true,...}`.
  `401` = segredo diferente; `timed_out`/`error_msg` = URL errada ou demora.
- No painel do monitor: "Última execução" dos projetos atualizando conforme o intervalo.
- Na Vercel: Logs da função `/api/cron/check-projects`.

## Desligar
```sql
select cron.unschedule('monitor-uptime-tick');
-- ou pausar: update cron.job set active = false where jobname = 'monitor-uptime-tick';
```
Para impedir qualquer chamada externa, troque/remova `CRON_SECRET` na Vercel (a rota responde 401).

## Limitações e cuidados

### Pausa do plano Free do Supabase
Política atual (docs "Project Pausing" e página de preços, consultadas em 14/10/2026):
projetos Free são pausados após **7 dias com pouca "atividade de usuário" no banco**
("a few user requests to the database each day" costuma bastar); planos pagos nunca pausam.
O Supabase envia e-mail de aviso ~1 semana antes.

**O tráfego do pg_cron conta?** A documentação **não diz** que jobs internos (pg_cron/pg_net)
contam como atividade de usuário, e relatos da comunidade indicam que é preciso tráfego vindo
de fora. Portanto **não conte** com o próprio despertador para se manter acordado. Se ele
pausar, as checagens param.

Mitigações (escolha ao menos uma):
1. **Cadastre o próprio projeto despertador no monitor** (rodando `sql/supabase_healthcheck_migration.sql`
   nele). O monitor fará leituras REST externas regulares nele, que são atividade de usuário.
2. Mantenha o **cron diário da Vercel** como reserva (`vercel.ts`): ele roda a rotina 1x/dia
   mesmo que o despertador pare, e com a mitigação 1 também "acorda" o despertador.
3. Use um projeto em plano pago como despertador (nunca pausa).
4. Fique atento ao e-mail de aviso de pausa.

### Limite de tempo da Vercel
A função tem `maxDuration = 60 s` e a rotina usa no máximo 45 s por chamada; projetos vencidos
que não couberem ficam para a chamada seguinte (1 min depois). O `timeout_milliseconds` do
pg_net está em 60 000. Se uma chamada ainda estiver rodando quando a próxima chegar, o lock por
projeto impede checagem dupla.

### Coexistência com outros agendadores
Despertador, cron diário da Vercel e worker próprio (Railway/pm2, `docs/agendador-proprio.md`)
podem rodar juntos: o lock só é concedido se `lastRunAt` não mudou desde a leitura, então o
mesmo vencimento nunca é checado duas vezes. O cron diário da Vercel pode continuar como reserva;
o worker passa a ser opcional (alternativa se não quiser depender do Supabase).

### Outros
- pg_net guarda as respostas por cerca de 6 horas.
- O despertador gera ~1 440 requisições/dia à Vercel; dentro dos limites do Hobby para uso normal,
  mas acompanhe o uso em Vercel > Usage.
