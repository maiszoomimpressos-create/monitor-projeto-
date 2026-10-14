// Laço do agendador próprio, sem dependência de banco (testado em loop.test.ts).
// - Um ciclo por vez: o próximo só é agendado depois que o atual termina
//   (sem sobreposição), mantendo o ritmo de `intervalMs` entre inícios.
// - Erro em um ciclo é registrado e o laço continua.
// - stop() espera o ciclo em andamento terminar (shutdown gracioso).

export interface LoopLogger {
  info(msg: string, extra?: Record<string, unknown>): void;
  error(msg: string, extra?: Record<string, unknown>): void;
}

export interface LoopState {
  running: boolean;
  cycles: number;
  failures: number;
  lastStartedAt: Date | null;
  lastFinishedAt: Date | null;
  lastError: string | null;
}

export interface LoopOptions {
  intervalMs: number;
  runCycle: () => Promise<void>;
  logger: LoopLogger;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface Loop {
  start(): void;
  stop(): Promise<void>;
  state(): Readonly<LoopState>;
}

export function createLoop(opts: LoopOptions): Loop {
  const now = opts.now ?? Date.now;
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as NodeJS.Timeout));

  const st: LoopState = {
    running: false,
    cycles: 0,
    failures: 0,
    lastStartedAt: null,
    lastFinishedAt: null,
    lastError: null,
  };
  let stopping = false;
  let timer: unknown = null;
  let current: Promise<void> | null = null;

  async function cycle() {
    timer = null;
    if (stopping) return;
    const started = now();
    st.running = true;
    st.lastStartedAt = new Date(started);
    try {
      await opts.runCycle();
      st.lastError = null;
    } catch (error) {
      st.failures += 1;
      const raw = error instanceof Error ? error.message : String(error);
      // Mensagens do Prisma são longas: guarda só a última linha (a causa).
      st.lastError = raw.trim().split("\n").filter(Boolean).pop() ?? raw;
      opts.logger.error("Ciclo falhou; o próximo será executado normalmente.", { erro: st.lastError });
    } finally {
      st.running = false;
      st.cycles += 1;
      st.lastFinishedAt = new Date(now());
    }
    if (!stopping) {
      const wait = Math.max(0, opts.intervalMs - (now() - started));
      timer = setTimer(run, wait);
    }
  }

  function run() {
    current = cycle();
  }

  return {
    start() {
      if (current || timer) return;
      stopping = false;
      run();
    },
    async stop() {
      stopping = true;
      if (timer) {
        clearTimer(timer);
        timer = null;
      }
      if (current) await current;
    },
    state: () => ({ ...st }),
  };
}
