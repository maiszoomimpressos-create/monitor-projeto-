import { prisma } from "@/lib/db";
import type { SweepSummary } from "@/lib/sweep";

// Retenção: só as 250 execuções mais recentes (o que vier primeiro já cobre
// o uso de 1x/min do despertador — guarda pouco mais de 4 h).
const MAX_CRON_RUNS = 250;

type CronRunInput = ({ ok: true } & SweepSummary) | { ok: false; errorMessage: string };

export async function recordCronRun(input: CronRunInput): Promise<void> {
  await prisma.cronRun.create({
    data:
      input.ok
        ? { ok: true, checked: input.checked, skipped: input.skipped, failed: input.failed, deferred: input.deferred, total: input.total }
        : { ok: false, checked: 0, skipped: 0, failed: 0, deferred: 0, total: 0, errorMessage: input.errorMessage },
  });

  const excess = await prisma.cronRun.findMany({
    orderBy: { ranAt: "desc" },
    skip: MAX_CRON_RUNS,
    select: { id: true },
  });
  if (excess.length > 0) {
    await prisma.cronRun.deleteMany({ where: { id: { in: excess.map((e) => e.id) } } });
  }
}
