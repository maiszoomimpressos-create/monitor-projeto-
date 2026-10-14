// Regras de agendamento puras (sem banco), testadas em schedule.test.ts.
//
// O agendador ("tick") chama /api/cron/check-projects periodicamente. Cada
// projeto tem seu intervalo (definido pelo cliente, D-001); a cada tick a rotina
// verifica os projetos cujo intervalo venceu.
//
// Configuração por variáveis de ambiente (servidor):
// - SCHEDULER_TICK_MINUTES: período do agendador ativo. Padrão 1440 (Vercel Hobby:
//   cron 1x/dia, `vercel.ts`). Com agendador externo (GitHub Actions/cron-job.org)
//   chamando a cada 15 min, defina 15.
// - SCHEDULER_TICK_OFFSET_MINUTES: minuto do dia (UTC) em que os ticks se alinham.
//   Padrão 540 (09:00 UTC = 06:00 BRT, horário do cron da Vercel).

const MINUTE_MS = 60 * 1000;
const DAY_MINUTES = 1440;

export interface ScheduleConfig {
  tickMinutes: number;
  offsetMinutes: number;
}

export interface SchedulableProject {
  enabled: boolean;
  intervalMinutes: number;
  lastRunAt: Date | null;
}

export const DEFAULT_TICK_MINUTES = DAY_MINUTES;
export const DEFAULT_OFFSET_MINUTES = 9 * 60;
export const MIN_TICK_MINUTES = 1;
// Menor intervalo oferecido ao cliente, mesmo com o worker rodando a cada 1 min.
export const MIN_INTERVAL_MINUTES = 5;
export const MAX_INTERVAL_MINUTES = 7 * DAY_MINUTES;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function getScheduleConfig(env: Record<string, string | undefined> = process.env): ScheduleConfig {
  const tick = Math.max(parsePositiveInt(env.SCHEDULER_TICK_MINUTES, DEFAULT_TICK_MINUTES), MIN_TICK_MINUTES);
  const offsetRaw = Number(env.SCHEDULER_TICK_OFFSET_MINUTES);
  const offset = Number.isInteger(offsetRaw) && offsetRaw >= 0 ? offsetRaw : DEFAULT_OFFSET_MINUTES;
  return { tickMinutes: Math.min(tick, DAY_MINUTES), offsetMinutes: offset % DAY_MINUTES };
}

/** Tolerância: metade do tick. Absorve atrasos do agendador (o Hobby dispara em qualquer minuto da hora). */
export function toleranceMs(config: ScheduleConfig): number {
  return (config.tickMinutes * MINUTE_MS) / 2;
}

export function isProjectDue(project: SchedulableProject, now: Date, config: ScheduleConfig): boolean {
  if (!project.enabled) return false;
  if (!project.lastRunAt) return true;
  const dueAt = project.lastRunAt.getTime() + project.intervalMinutes * MINUTE_MS - toleranceMs(config);
  return now.getTime() >= dueAt;
}

/** Primeiro horário de tick (grade alinhada a UTC) maior ou igual a `at`. */
export function nextTickAtOrAfter(at: Date, config: ScheduleConfig): Date {
  const tickMs = config.tickMinutes * MINUTE_MS;
  const offsetMs = (config.offsetMinutes % config.tickMinutes) * MINUTE_MS;
  const k = Math.ceil((at.getTime() - offsetMs) / tickMs);
  return new Date(k * tickMs + offsetMs);
}

/**
 * Próxima execução automática prevista: o primeiro tick em que o projeto estará
 * vencido (respeitando a tolerância). Projetos nunca verificados entram no próximo tick.
 */
export function nextRunAt(project: SchedulableProject, now: Date, config: ScheduleConfig): Date | null {
  if (!project.enabled) return null;
  if (!project.lastRunAt) return nextTickAtOrAfter(now, config);
  const dueAt = new Date(
    project.lastRunAt.getTime() + project.intervalMinutes * MINUTE_MS - toleranceMs(config),
  );
  return nextTickAtOrAfter(dueAt.getTime() > now.getTime() ? dueAt : now, config);
}

const PRESETS = [5, 15, 30, 60, 180, 360, 720, 1440, 2880, 4320, 10080];

export function formatInterval(minutes: number): string {
  if (minutes % DAY_MINUTES === 0) {
    const d = minutes / DAY_MINUTES;
    return d === 1 ? "Uma vez por dia" : `A cada ${d} dias`;
  }
  if (minutes % 60 === 0) {
    const h = minutes / 60;
    return h === 1 ? "A cada 1 hora" : `A cada ${h} horas`;
  }
  return `A cada ${minutes} minutos`;
}

/** Intervalos que o cliente pode escolher: só os compatíveis com o agendador ativo. */
export function allowedIntervals(config: ScheduleConfig): { minutes: number; label: string }[] {
  return PRESETS.filter((m) => m >= Math.max(config.tickMinutes, MIN_INTERVAL_MINUTES)).map((m) => ({ minutes: m, label: formatInterval(m) }));
}

export function isIntervalAllowed(minutes: number, config: ScheduleConfig): boolean {
  return Number.isInteger(minutes) && minutes >= Math.max(config.tickMinutes, MIN_INTERVAL_MINUTES) && minutes <= MAX_INTERVAL_MINUTES;
}

/** Texto curto para o painel explicando o agendador ativo. */
export function schedulerNote(config: ScheduleConfig): string {
  const hh = String(Math.floor(config.offsetMinutes / 60)).padStart(2, "0");
  const mm = String(config.offsetMinutes % 60).padStart(2, "0");
  if (config.tickMinutes === DAY_MINUTES) {
    return `A verificação automática roda 1 vez por dia, a partir de ${hh}:${mm} UTC (pode atrasar até 1 hora). Intervalos menores exigem um agendador externo.`;
  }
  if (config.tickMinutes === 1) {
    return "A verificação automática roda a cada minuto (agendador próprio); o projeto é verificado em até ~1 min após vencer.";
  }
  return `A verificação automática roda ${formatInterval(config.tickMinutes).toLowerCase()} (pode atrasar alguns minutos).`;
}
