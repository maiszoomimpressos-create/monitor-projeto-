import { prisma } from "@/lib/db";
import { runCheckForProject } from "@/lib/runCheck";
import { getScheduleConfig, isProjectDue } from "@/lib/schedule";

const MAX_CONCURRENT_CHECKS = 5;

// Pior caso de um projeto: 2 tentativas × 8 s de timeout + espera entre elas + gravação.
// Só iniciamos um novo lote se ainda houver essa folga até o fim do maxDuration.
const WORST_CASE_PROJECT_MS = 20_000;

export interface SweepSummary {
  checked: number;
  skipped: number;
  failed: number;
  deferred: number; // vencidos que não couberam no tempo deste tick (ficam para o próximo)
  total: number;
}

/**
 * Verifica os projetos ativos (de todos os usuários) cujo intervalo venceu.
 * - Mais atrasados primeiro (lastRunAt mais antigo / nunca verificados).
 * - Lotes de até 5 em paralelo; falha de um projeto não afeta os demais.
 * - Para de iniciar lotes antes de estourar o tempo da função (budgetMs).
 * - O lock por projeto (runCheckForProject) impede execução duplicada.
 */
export async function sweepDueProjects(budgetMs: number, now: Date = new Date()): Promise<SweepSummary> {
  const startedAt = Date.now();
  const config = getScheduleConfig();
  const projects = await prisma.project.findMany({
    where: { enabled: true },
    orderBy: [{ lastRunAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
  });
  const due = projects.filter((p) => isProjectDue(p, now, config));

  let checked = 0;
  let skipped = 0;
  let failed = 0;
  let processed = 0;

  for (let i = 0; i < due.length; i += MAX_CONCURRENT_CHECKS) {
    if (Date.now() - startedAt + WORST_CASE_PROJECT_MS > budgetMs) break;
    const batch = due.slice(i, i + MAX_CONCURRENT_CHECKS);
    processed += batch.length;
    const results = await Promise.allSettled(batch.map((p) => runCheckForProject(p, "cron")));

    for (const result of results) {
      if (result.status === "rejected") {
        failed += 1;
        console.error("Falha isolada ao verificar projeto:", result.reason);
      } else if (result.value.skipped) {
        skipped += 1;
      } else {
        checked += 1;
      }
    }
  }

  return { checked, skipped, failed, deferred: due.length - processed, total: due.length };
}
