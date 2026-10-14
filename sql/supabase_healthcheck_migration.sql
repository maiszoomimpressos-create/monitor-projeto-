-- =============================================================================
-- Migration a ser aplicada em CADA PROJETO SUPABASE QUE VOCÊ QUER MONITORAR
-- (não é o banco deste painel — é o(s) projeto(s) alvo da checagem).
--
-- Cria uma tabela mínima e dedicada para a checagem de disponibilidade:
--   - Um único registro, sem dados sensíveis ou de negócio.
--   - RLS habilitada, liberando apenas SELECT para a chave pública (anon).
--   - Nenhuma permissão de INSERT/UPDATE/DELETE é concedida — nem para anon,
--     nem para authenticated — então mesmo que a chave seja exposta, não é
--     possível alterar dados através dela.
--   - Nenhuma outra tabela do projeto é afetada.
--
-- Como aplicar: cole este script no SQL Editor do Supabase (Dashboard do
-- projeto > SQL Editor) e execute. É seguro executar mais de uma vez
-- (idempotente).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public._uptime_healthcheck (
  id smallint PRIMARY KEY DEFAULT 1,
  checked_note text NOT NULL DEFAULT 'uptime healthcheck row — do not edit',
  -- Restringe a tabela a um único registro possível.
  CONSTRAINT _uptime_healthcheck_singleton CHECK (id = 1)
);

COMMENT ON TABLE public._uptime_healthcheck IS
  'Tabela dedicada para checagens leves de disponibilidade. Não armazena dados de negócio.';

-- Garante exatamente uma linha, sem duplicar em reexecuções da migration.
INSERT INTO public._uptime_healthcheck (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Habilita RLS e remove qualquer permissão herdada antes de conceder o mínimo necessário.
ALTER TABLE public._uptime_healthcheck ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._uptime_healthcheck FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public._uptime_healthcheck FROM PUBLIC;
REVOKE ALL ON public._uptime_healthcheck FROM anon;
REVOKE ALL ON public._uptime_healthcheck FROM authenticated;

GRANT SELECT ON public._uptime_healthcheck TO anon;

DROP POLICY IF EXISTS "uptime_healthcheck_select_anon" ON public._uptime_healthcheck;
CREATE POLICY "uptime_healthcheck_select_anon"
  ON public._uptime_healthcheck
  FOR SELECT
  TO anon
  USING (true);

-- Nenhuma política de INSERT/UPDATE/DELETE é criada: por padrão, o RLS nega
-- essas operações para todos os papéis, inclusive para quem tiver a chave anon.

-- Credencial recomendada para cadastrar no painel: a chave pública "anon" deste
-- projeto (Project Settings > API). NÃO use a service_role key aqui — ela tem
-- acesso irrestrito ao banco e é desnecessária para esta checagem de leitura.
