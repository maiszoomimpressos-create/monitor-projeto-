-- Migration do BANCO DE CONTROLE (control-plane) deste monitor.
-- Este banco é diferente dos projetos Supabase monitorados: aqui ficam apenas
-- o cadastro dos projetos e o histórico de execuções das checagens.
--
-- Gerado manualmente porque nenhuma DATABASE_URL estava disponível neste ambiente
-- para rodar `prisma migrate dev`. Antes de aplicar em produção, revise e rode:
--   npx prisma migrate deploy

CREATE TYPE "CheckStatus" AS ENUM (
  'SUCESSO',
  'FALHA_CONEXAO',
  'FALHA_AUTENTICACAO',
  'FALHA_CONFIGURACAO',
  'POSSIVEL_PAUSA',
  'ERRO_DESCONHECIDO'
);

CREATE TABLE "projects" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "supabaseUrl" TEXT NOT NULL,
  "healthcheckTable" TEXT NOT NULL DEFAULT '_uptime_healthcheck',
  "encryptedKey" TEXT NOT NULL,
  "keyLastFour" TEXT NOT NULL,
  "intervalMinutes" INTEGER NOT NULL DEFAULT 360,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastRunAt" TIMESTAMP(3),
  "lastSuccessAt" TIMESTAMP(3),
  "isRunning" BOOLEAN NOT NULL DEFAULT false,
  "runningSince" TIMESTAMP(3),
  "consecutiveConnFailures" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE "executions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "status" "CheckStatus" NOT NULL,
  "httpStatus" INTEGER,
  "message" TEXT,
  "triggeredBy" TEXT NOT NULL DEFAULT 'cron',
  CONSTRAINT "executions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "executions_projectId_startedAt_idx" ON "executions"("projectId", "startedAt");
