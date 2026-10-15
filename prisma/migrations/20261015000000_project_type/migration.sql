-- Tipo de projeto (SUPABASE | HTTP) e campos da checagem HTTP.
-- APLICADA no banco de controle de produção (Neon) em 14/10/2026 23:21 BRT.
-- Projetos existentes ficam como SUPABASE (default).

CREATE TYPE "ProjectType" AS ENUM ('SUPABASE', 'HTTP');

ALTER TABLE "projects"
  ADD COLUMN "type" "ProjectType" NOT NULL DEFAULT 'SUPABASE',
  ADD COLUMN "httpMethod" TEXT NOT NULL DEFAULT 'GET',
  ADD COLUMN "expectedStatus" INTEGER;
