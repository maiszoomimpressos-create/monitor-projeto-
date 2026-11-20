import { Client } from "pg";

// Mesmo conteúdo de sql/supabase_healthcheck_migration.sql — mantido em sincronia manualmente.
// Idempotente: pode rodar de novo sem duplicar nada.
export const HEALTHCHECK_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS public._uptime_healthcheck (
  id smallint PRIMARY KEY DEFAULT 1,
  checked_note text NOT NULL DEFAULT 'uptime healthcheck row — do not edit',
  CONSTRAINT _uptime_healthcheck_singleton CHECK (id = 1)
);

INSERT INTO public._uptime_healthcheck (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

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
`;

export class HealthcheckMigrationError extends Error {}

/**
 * Cria a tabela de verificação no projeto Supabase do cliente, usando a
 * connection string do Postgres fornecida por ele no cadastro.
 * A connection string NUNCA é persistida — só usada aqui, na hora, e descartada.
 */
export async function runHealthcheckMigration(connectionString: string): Promise<void> {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 8000,
    query_timeout: 8000,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    await client.query(HEALTHCHECK_MIGRATION_SQL);
  } catch {
    // Nunca inclui a connection string (pode conter a senha) na mensagem de erro.
    throw new HealthcheckMigrationError(
      "Não foi possível criar a tabela automaticamente. Confira a connection string (Project Settings > Database no Supabase) ou rode o SQL manualmente no SQL Editor.",
    );
  } finally {
    await client.end().catch(() => {});
  }
}
