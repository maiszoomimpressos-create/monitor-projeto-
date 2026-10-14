import { prisma } from "@/lib/db";

// Política de retenção do histórico: o que vier primeiro.
const MAX_EXECUTIONS_PER_PROJECT = 200;
const MAX_AGE_DAYS = 30;

export async function cleanupHistory(): Promise<void> {
  const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  await prisma.execution.deleteMany({ where: { startedAt: { lt: cutoff } } });

  const projects = await prisma.project.findMany({ select: { id: true } });
  for (const { id } of projects) {
    const excess = await prisma.execution.findMany({
      where: { projectId: id },
      orderBy: { startedAt: "desc" },
      skip: MAX_EXECUTIONS_PER_PROJECT,
      select: { id: true },
    });
    if (excess.length > 0) {
      await prisma.execution.deleteMany({ where: { id: { in: excess.map((e) => e.id) } } });
    }
  }
}
