-- =============================================================================
-- Despertador do Monitor de Disponibilidade (D-008)
-- Executar no SQL Editor de UM projeto Supabase (o "despertador").
-- A cada 1 minuto, pg_cron + pg_net chamam o endpoint da Vercel:
--   POST https://<seu-dominio>/api/cron/check-projects
--   Authorization: Bearer <CRON_SECRET>
-- Idempotente: pode ser executado de novo sem duplicar o job.
-- NÃO coloque segredos reais neste arquivo nem no Git. Troque os placeholders
-- apenas no SQL Editor (ou crie os secrets pelo painel: Project Settings > Vault).
-- Guia: docs/despertador-supabase.md
-- =============================================================================

-- 1) Extensões --------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2) Secrets no Vault (cria ou atualiza) ------------------------------------
-- Substitua os dois valores entre <> antes de executar.
do $$
declare
  v_url    text := '<URL_COMPLETA, ex.: https://meu-app.vercel.app/api/cron/check-projects>';
  v_secret text := '<MESMO_VALOR_DO_CRON_SECRET_DA_VERCEL>';
  v_id     uuid;
begin
  if v_url like '<%' or v_secret like '<%' then
    raise exception 'Substitua os placeholders <...> de URL e CRON_SECRET antes de executar.';
  end if;

  select id into v_id from vault.secrets where name = 'monitor_cron_url';
  if v_id is null then
    perform vault.create_secret(v_url, 'monitor_cron_url', 'Endpoint do monitor (Vercel)');
  else
    perform vault.update_secret(v_id, v_url);
  end if;

  select id into v_id from vault.secrets where name = 'monitor_cron_secret';
  if v_id is null then
    perform vault.create_secret(v_secret, 'monitor_cron_secret', 'CRON_SECRET do monitor');
  else
    perform vault.update_secret(v_id, v_secret);
  end if;
end $$;

-- 3) Job a cada minuto (cron.schedule com o mesmo nome substitui o anterior) --
select cron.schedule(
  'monitor-uptime-tick',
  '* * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'monitor_cron_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'monitor_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $job$
);

-- =============================================================================
-- VERIFICAÇÃO (execute separadamente)
-- =============================================================================
-- Job cadastrado:
--   select jobid, jobname, schedule, active from cron.job where jobname = 'monitor-uptime-tick';
--
-- Últimas execuções do pg_cron (o job só enfileira a requisição; status "succeeded"
-- não significa que a Vercel respondeu 200):
--   select start_time, status, return_message
--   from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'monitor-uptime-tick')
--   order by start_time desc limit 10;
--
-- Respostas HTTP recebidas (pg_net guarda por ~6 h). Esperado: status_code 200
-- e corpo {"ok":true,...}; 401 = CRON_SECRET diferente; null + error_msg = timeout/rede:
--   select id, created, status_code, left(content::text, 200) as corpo, error_msg, timed_out
--   from net._http_response order by created desc limit 10;
--
-- Secrets existentes (sem mostrar o valor):
--   select name, description, updated_at from vault.secrets where name like 'monitor_cron_%';

-- =============================================================================
-- DESLIGAR (execute separadamente)
-- =============================================================================
--   select cron.unschedule('monitor-uptime-tick');
-- Pausar sem apagar:
--   update cron.job set active = false where jobname = 'monitor-uptime-tick';
-- Remover também os secrets:
--   delete from vault.secrets where name in ('monitor_cron_url', 'monitor_cron_secret');
