-- Heartbeat do agendador: uma linha por chamada de /api/cron/check-projects,
-- independente de ter algum projeto vencido. Retenção: 250 mais recentes
-- (aplicada em src/lib/cronLog.ts, não neste SQL).
-- NÃO aplicada no banco de controle de produção (Neon) ainda — aplicar com
-- autorização explícita do usuário (npm run db:migrate:deploy).

CREATE TABLE "cron_runs" (
    "id" TEXT NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ok" BOOLEAN NOT NULL,
    "checked" INTEGER NOT NULL,
    "skipped" INTEGER NOT NULL,
    "failed" INTEGER NOT NULL,
    "deferred" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "errorMessage" TEXT,

    CONSTRAINT "cron_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cron_runs_ranAt_idx" ON "cron_runs"("ranAt");
