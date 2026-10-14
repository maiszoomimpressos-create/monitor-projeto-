import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allowedIntervals,
  getScheduleConfig,
  isIntervalAllowed,
  isProjectDue,
  nextRunAt,
  nextTickAtOrAfter,
  type ScheduleConfig,
} from "./schedule";

const daily: ScheduleConfig = { tickMinutes: 1440, offsetMinutes: 540 };
const q15: ScheduleConfig = { tickMinutes: 15, offsetMinutes: 0 };
const d = (s: string) => new Date(s);
const proj = (intervalMinutes: number, lastRunAt: Date | null, enabled = true) => ({ enabled, intervalMinutes, lastRunAt });

test("config padrão é diária às 09:00 UTC e ignora valores inválidos", () => {
  assert.deepEqual(getScheduleConfig({}), daily);
  assert.deepEqual(getScheduleConfig({ SCHEDULER_TICK_MINUTES: "abc" }), daily);
  assert.deepEqual(getScheduleConfig({ SCHEDULER_TICK_MINUTES: "1", SCHEDULER_TICK_OFFSET_MINUTES: "0" }), {
    tickMinutes: 5,
    offsetMinutes: 0,
  });
});

test("isProjectDue: nunca verificado e desativado", () => {
  assert.equal(isProjectDue(proj(1440, null), d("2026-10-14T09:00:00Z"), daily), true);
  assert.equal(isProjectDue(proj(1440, null, false), d("2026-10-14T09:00:00Z"), daily), false);
});

test("isProjectDue: cron diário que atrasa ou adianta minutos não pula um dia", () => {
  const last = d("2026-10-13T09:40:00Z");
  assert.equal(isProjectDue(proj(1440, last), d("2026-10-14T09:02:00Z"), daily), true);
  assert.equal(isProjectDue(proj(1440, last), d("2026-10-13T20:00:00Z"), daily), false);
});

test("isProjectDue: intervalo de 2 dias com tick diário", () => {
  const last = d("2026-10-13T09:05:00Z");
  assert.equal(isProjectDue(proj(2880, last), d("2026-10-14T09:00:00Z"), daily), false);
  assert.equal(isProjectDue(proj(2880, last), d("2026-10-15T09:00:00Z"), daily), true);
});

test("isProjectDue: tick de 15 min com atraso de segundos", () => {
  const last = d("2026-10-14T10:00:20Z");
  assert.equal(isProjectDue(proj(15, last), d("2026-10-14T10:15:05Z"), q15), true);
  assert.equal(isProjectDue(proj(60, last), d("2026-10-14T10:45:00Z"), q15), false);
  assert.equal(isProjectDue(proj(60, last), d("2026-10-14T11:00:00Z"), q15), true);
});

test("nextTickAtOrAfter alinha à grade", () => {
  assert.deepEqual(nextTickAtOrAfter(d("2026-10-14T10:00:00Z"), daily), d("2026-10-15T09:00:00Z"));
  assert.deepEqual(nextTickAtOrAfter(d("2026-10-14T09:00:00Z"), daily), d("2026-10-14T09:00:00Z"));
  assert.deepEqual(nextTickAtOrAfter(d("2026-10-14T10:07:00Z"), q15), d("2026-10-14T10:15:00Z"));
});

test("nextRunAt: coerente com isProjectDue", () => {
  const now = d("2026-10-14T12:00:00Z");
  assert.deepEqual(nextRunAt(proj(1440, d("2026-10-14T09:10:00Z")), now, daily), d("2026-10-15T09:00:00Z"));
  assert.deepEqual(nextRunAt(proj(2880, d("2026-10-14T09:10:00Z")), now, daily), d("2026-10-16T09:00:00Z"));
  assert.deepEqual(nextRunAt(proj(1440, null), now, daily), d("2026-10-15T09:00:00Z"));
  assert.equal(nextRunAt(proj(1440, null, false), now, daily), null);
  // Atrasado (tick perdido): próximo tick a partir de agora.
  assert.deepEqual(nextRunAt(proj(1440, d("2026-10-10T09:00:00Z")), now, daily), d("2026-10-15T09:00:00Z"));
  for (const p of [proj(1440, d("2026-10-14T09:10:00Z")), proj(60, d("2026-10-14T11:58:00Z"))]) {
    for (const cfg of [daily, q15]) {
      const next = nextRunAt(p, now, cfg)!;
      assert.equal(isProjectDue(p, next, cfg), true);
    }
  }
});

test("intervalos permitidos respeitam o agendador", () => {
  assert.deepEqual(allowedIntervals(daily).map((i) => i.minutes), [1440, 2880, 4320, 10080]);
  assert.equal(allowedIntervals(q15)[0].minutes, 15);
  assert.equal(isIntervalAllowed(60, daily), false);
  assert.equal(isIntervalAllowed(60, q15), true);
  assert.equal(isIntervalAllowed(20000, q15), false);
});
