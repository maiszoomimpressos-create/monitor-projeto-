import { ProjectType, type Project } from "@prisma/client";
import { prisma } from "@/lib/db";
import { runCheckForProject } from "@/lib/runCheck";
import { getScheduleConfig, isProjectDue } from "@/lib/schedule";

// Até 8 checagens em paralelo (pool). Cada uma recebe o prazo final (deadline) e
// encurta timeouts/retentativas para nunca passar dele.
const MAX_CONCURRENT_CHECKS = 8;

// Tempo mínimo restante para INICIAR um projeto, conforme o tipo:
// Supabase: 1 tentativa de 8 s + folga. HTTP: 1 tentativa de 30 s (sites free demoram a acordar) + folga.
export function minStartMs(type: ProjectType): number {
  return type === ProjectType.HTTP ? 32_000 : 10_000;
}

export interface SweepSummary {
  checked: number;
  skipped: number;
  failed: number;
  deferred: number; // vencidos que não couberam no tempo deste disparo (ficam para o próximo)
  total: number;
}

/**
 * Verifica os projetos ativos (de todos os usuários) cujo intervalo venceu.
 * - Mais atrasados primeiro (lastRunAt mais antigo / nunca verificados).
 * - Pool de até 8 em paralelo; falha de um projeto não afeta os demais.
 * - Só inicia um projeto se couber no orçamento (budgetMs); o resto fica para o próximo disparo.
 * - O lock por projeto (runCheckForProject) impede execução duplicada.
 */
export async function sweepDueProjects(budgetMs: number, now: Date = new Date()): Promise<SweepSummary> {
  const deadline = Date.now() + budgetMs;
  const config = getScheduleConfig();
  const projects = await prisma.project.findMany({
    where: { enabled: true },
    orderBy: [{ lastRunAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
  });
  const queue: Project[] = projects.filter((p) => isProjectDue(p, now, config));
  const total = queue.length;

  let checked = 0;
  let skipped = 0;
  let failed = 0;

  async function lane() {
    for (;;) {
      const remaining = deadline - Date.now();
      const idx = queue.findIndex((p) => remaining >= minStartMs(p.type));
      if (idx === -1) return;
      const [project] = queue.splice(idx, 1);
      try {
        const result = await runCheckForProject(project, "cron", { deadline });
        if (result.skipped) skipped += 1;
        else checked += 1;
      } catch (error) {
        failed += 1;
        console.error("Falha isolada ao verificar projeto:", error);
      }
    }
  }

  await Promise.all(Array.from({ length: MAX_CONCURRENT_CHECKS }, lane));
  return { checked, skipped, failed, deferred: queue.length, total };
}
