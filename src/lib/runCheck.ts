import { CheckStatus, Project } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { performCheckWithRetry } from "@/lib/check";
import { assertHostResolvesToPublicIp, assertWellFormedSupabaseUrl, UnsafeUrlError } from "@/lib/ssrf";

// Se uma execução ficar "em andamento" por mais tempo que isso, consideramos que o
// processo anterior travou/crashou e liberamos o lock para uma nova tentativa.
const STALE_LOCK_MS = 10 * 60 * 1000;

// Número de falhas de conexão consecutivas para sinalizar "possível pausa" do projeto.
// Evidência exige múltiplas execuções ao longo do tempo, não uma única falha isolada.
const CONSECUTIVE_FAILURES_FOR_PAUSE_HINT = 3;

export type TriggerSource = "cron" | "manual";

export interface RunCheckResult {
  skipped: boolean;
  reason?: string;
  status?: CheckStatus;
  message?: string;
  durationMs?: number;
}

/**
 * Tenta adquirir o lock de execução de um projeto de forma atômica.
 * Retorna false se outra execução já estiver em andamento (e não estiver obsoleta).
 */
async function tryAcquireLock(projectId: string): Promise<boolean> {
  const staleCutoff = new Date(Date.now() - STALE_LOCK_MS);
  const result = await prisma.project.updateMany({
    where: {
      id: projectId,
      OR: [{ isRunning: false }, { runningSince: { lt: staleCutoff } }],
    },
    data: { isRunning: true, runningSince: new Date() },
  });
  return result.count === 1;
}

async function releaseLock(projectId: string) {
  await prisma.project.updateMany({
    where: { id: projectId },
    data: { isRunning: false, runningSince: null },
  });
}

export async function runCheckForProject(
  project: Project,
  triggeredBy: TriggerSource
): Promise<RunCheckResult> {
  const locked = await tryAcquireLock(project.id);
  if (!locked) {
    return { skipped: true, reason: "já existe uma verificação em andamento para este projeto" };
  }

  try {
    let outcome: Awaited<ReturnType<typeof performCheckWithRetry>>;
    try {
      const url = assertWellFormedSupabaseUrl(project.supabaseUrl);
      await assertHostResolvesToPublicIp(url.hostname);

      const apiKey = decryptSecret(project.encryptedKey);
      outcome = await performCheckWithRetry({
        supabaseUrl: project.supabaseUrl,
        apiKey,
        table: project.healthcheckTable,
      });
    } catch (error) {
      if (error instanceof UnsafeUrlError) {
        outcome = {
          status: CheckStatus.FALHA_CONFIGURACAO,
          httpStatus: null,
          message: `URL do projeto bloqueada por segurança: ${error.message}`,
          durationMs: 0,
          attempts: 0,
        };
      } else {
        outcome = {
          status: CheckStatus.ERRO_DESCONHECIDO,
          httpStatus: null,
          message: "Erro inesperado ao preparar a verificação.",
          durationMs: 0,
          attempts: 0,
        };
      }
    }

    const isConnFailure = outcome.status === CheckStatus.FALHA_CONEXAO;
    const newConsecutiveFailures = isConnFailure ? project.consecutiveConnFailures + 1 : 0;

    const finalStatus =
      isConnFailure && newConsecutiveFailures >= CONSECUTIVE_FAILURES_FOR_PAUSE_HINT
        ? CheckStatus.POSSIVEL_PAUSA
        : outcome.status;

    const finalMessage =
      finalStatus === CheckStatus.POSSIVEL_PAUSA
        ? `${outcome.message} Isso ocorreu em ${newConsecutiveFailures} verificações consecutivas — pode indicar que o projeto está pausado. Confirme e restaure pelo painel do Supabase.`
        : outcome.message;

    const now = new Date();
    await prisma.$transaction([
      prisma.execution.create({
        data: {
          projectId: project.id,
          status: finalStatus,
          httpStatus: outcome.httpStatus,
          message: finalMessage,
          durationMs: outcome.durationMs,
          finishedAt: now,
          triggeredBy,
        },
      }),
      prisma.project.update({
        where: { id: project.id },
        data: {
          lastRunAt: now,
          lastSuccessAt: outcome.status === CheckStatus.SUCESSO ? now : project.lastSuccessAt,
          consecutiveConnFailures: newConsecutiveFailures,
          isRunning: false,
          runningSince: null,
        },
      }),
    ]);

    return {
      skipped: false,
      status: finalStatus,
      message: finalMessage,
      durationMs: outcome.durationMs,
    };
  } catch (error) {
    // Garante que o lock nunca fique travado por um erro inesperado.
    await releaseLock(project.id);
    throw error;
  }
}
