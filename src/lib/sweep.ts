import { prisma } from "@/lib/db";
import { isProjectDue, runCheckForProject } from "@/lib/runCheck";

const MAX_CONCURRENT_CHECKS = 5;

export interface SweepSummary {
  checked: number;
  skipped: number;
  failed: number;
  total: number;
}

/**
 * Verifica todos os projetos habilitados cujo intervalo já venceu.
 * Cada projeto é isolado: a falha (ou exceção) de um não impede a checagem dos demais.
 */
export async function sweepDueProjects(): Promise<SweepSummary> {
  const projects = await prisma.project.findMany({ where: { enabled: true } });
  const due = projects.filter((p) => isProjectDue(p));

  let checked = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < due.length; i += MAX_CONCURRENT_CHECKS) {
    const batch = due.slice(i, i + MAX_CONCURRENT_CHECKS);
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

  return { checked, skipped, failed, total: due.length };
}
