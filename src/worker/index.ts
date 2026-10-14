// Agendador próprio (D-007): processo Node de longa duração, independente da Vercel.
// A cada WORKER_TICK_SECONDS (padrão 60) roda as checagens vencidas de todos os
// usuários, reaproveitando sweep/lock/isolamento/crypto/SSRF de src/lib.
//
// Uso: npm run worker   (ou npm run worker:local para ler .env.local)
import { createServer, type Server } from "node:http";
import { prisma } from "@/lib/db";
import { sweepDueProjects } from "@/lib/sweep";
import { cleanupHistory } from "@/lib/cleanup";
import { createLoop, type LoopLogger } from "./loop";

function intEnv(name: string, fallback: number, min: number): number {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n >= min ? n : fallback;
}

const TICK_SECONDS = intEnv("WORKER_TICK_SECONDS", 60, 10);
const SWEEP_BUDGET_MS = intEnv("WORKER_SWEEP_BUDGET_SECONDS", 300, 30) * 1000;
const CLEANUP_EVERY_MS = 60 * 60 * 1000;

const logger: LoopLogger = {
  info: (msg, extra) => console.log(`[worker ${new Date().toISOString()}] ${msg}`, extra ? JSON.stringify(extra) : ""),
  error: (msg, extra) => console.error(`[worker ${new Date().toISOString()}] ERRO ${msg}`, extra ? JSON.stringify(extra) : ""),
};

function checkEnv() {
  const missing = ["DATABASE_URL", "ENCRYPTION_KEY"].filter((k) => !process.env[k]);
  if (missing.length) {
    logger.error(`Variáveis obrigatórias ausentes: ${missing.join(", ")}. Encerrando.`);
    process.exit(1);
  }
  if (process.env.SCHEDULER_TICK_MINUTES !== "1") {
    logger.info(
      "Aviso: SCHEDULER_TICK_MINUTES não é 1 neste processo. Configure SCHEDULER_TICK_MINUTES=1 e SCHEDULER_TICK_OFFSET_MINUTES=0 também na Vercel para o painel oferecer intervalos a partir de 5 min.",
    );
  }
}

let lastCleanup = 0;

async function runCycle() {
  const t0 = Date.now();
  const summary = await sweepDueProjects(SWEEP_BUDGET_MS);
  if (summary.total > 0) {
    logger.info("Ciclo concluído", { ...summary, ms: Date.now() - t0 });
  }
  if (Date.now() - lastCleanup >= CLEANUP_EVERY_MS) {
    lastCleanup = Date.now();
    try {
      await cleanupHistory();
      logger.info("Limpeza do histórico concluída");
    } catch (error) {
      logger.error("Falha na limpeza do histórico", { erro: error instanceof Error ? error.message : String(error) });
    }
  }
}

function startHealthServer(loop: ReturnType<typeof createLoop>): Server | null {
  const port = Number(process.env.PORT);
  if (!port) return null;
  const server = createServer((req, res) => {
    const s = loop.state();
    const stale = s.lastFinishedAt ? Date.now() - s.lastFinishedAt.getTime() > TICK_SECONDS * 1000 * 5 + SWEEP_BUDGET_MS : false;
    const healthy = !stale;
    res.writeHead(healthy ? 200 : 503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: healthy, tickSeconds: TICK_SECONDS, ...s }));
  });
  server.listen(port, () => logger.info(`Health check em http://0.0.0.0:${port}/`));
  return server;
}

async function main() {
  checkEnv();
  logger.info(`Iniciando agendador próprio: ciclo a cada ${TICK_SECONDS}s, orçamento por ciclo ${SWEEP_BUDGET_MS / 1000}s.`);

  const loop = createLoop({ intervalMs: TICK_SECONDS * 1000, runCycle, logger });
  const server = startHealthServer(loop);
  loop.start();

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} recebido: aguardando o ciclo atual terminar...`);
    const force = setTimeout(() => {
      logger.error("Tempo de desligamento esgotado; encerrando à força (locks expiram em 10 min).");
      process.exit(1);
    }, 60_000);
    force.unref();
    await loop.stop();
    server?.close();
    await prisma.$disconnect().catch(() => null);
    logger.info("Encerrado.");
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

void main();
