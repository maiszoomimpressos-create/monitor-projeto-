-- Tipo de projeto (SUPABASE | HTTP) e campos da checagem HTTP.
-- NÃO aplicada em nenhum banco. Aplicar no Neon (npm run db:migrate:deploy)
-- ANTES do deploy desta versão, com autorização do usuário.
-- Projetos existentes ficam como SUPABASE (default).

CREATE TYPE "ProjectType" AS ENUM ('SUPABASE', 'HTTP');

ALTER TABLE "projects"
  ADD COLUMN "type" "ProjectType" NOT NULL DEFAULT 'SUPABASE',
  ADD COLUMN "httpMethod" TEXT NOT NULL DEFAULT 'GET',
  ADD COLUMN "expectedStatus" INTEGER;
