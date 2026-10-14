import { test } from "node:test";
import assert from "node:assert/strict";
import { createLoop } from "./loop";

const silent = { info() {}, error() {} };

function fakeClock() {
  let t = 0;
  const timers: { fn: () => void; at: number }[] = [];
  return {
    now: () => t,
    setTimer: (fn: () => void, ms: number) => {
      const h = { fn, at: t + ms };
      timers.push(h);
      return h;
    },
    clearTimer: (h: unknown) => {
      const i = timers.indexOf(h as (typeof timers)[number]);
      if (i >= 0) timers.splice(i, 1);
    },
    pending: () => timers.length,
    nextDelay: () => (timers[0] ? timers[0].at - t : null),
    async advance(ms: number) {
      t += ms;
      const due = timers.filter((x) => x.at <= t);
      for (const x of due) timers.splice(timers.indexOf(x), 1);
      for (const x of due) x.fn();
      await new Promise((r) => setImmediate(r));
    },
    tick: (ms: number) => {
      t += ms;
    },
  };
}

const flush = () => new Promise((r) => setImmediate(r));

test("roda imediatamente e agenda o próximo descontando a duração do ciclo", async () => {
  const c = fakeClock();
  let calls = 0;
  const loop = createLoop({
    intervalMs: 60_000,
    logger: silent,
    ...c,
    runCycle: async () => {
      calls += 1;
      c.tick(10_000);
    },
  });
  loop.start();
  await flush();
  assert.equal(calls, 1);
  assert.equal(c.nextDelay(), 50_000);
  await c.advance(50_000);
  assert.equal(calls, 2);
  await loop.stop();
});

test("sem sobreposição: ciclo longo atrasa o próximo em vez de rodar em paralelo", async () => {
  const c = fakeClock();
  let active = 0;
  let maxActive = 0;
  let release!: () => void;
  const loop = createLoop({
    intervalMs: 1_000,
    logger: silent,
    ...c,
    runCycle: () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      return new Promise<void>((r) => {
        release = () => {
          active -= 1;
          r();
        };
      });
    },
  });
  loop.start();
  await flush();
  assert.equal(c.pending(), 0, "nenhum ciclo agendado enquanto o atual roda");
  c.tick(5_000);
  release();
  await flush();
  assert.equal(c.nextDelay(), 0);
  await c.advance(0);
  assert.equal(maxActive, 1);
  release();
  await loop.stop();
});

test("erro no ciclo é registrado e o laço continua", async () => {
  const c = fakeClock();
  const errors: string[] = [];
  let calls = 0;
  const loop = createLoop({
    intervalMs: 1_000,
    logger: { info() {}, error: (m) => errors.push(m) },
    ...c,
    runCycle: async () => {
      calls += 1;
      if (calls === 1) throw new Error("banco indisponível");
    },
  });
  loop.start();
  await flush();
  assert.equal(loop.state().failures, 1);
  assert.equal(loop.state().lastError, "banco indisponível");
  await c.advance(1_000);
  assert.equal(calls, 2);
  assert.equal(loop.state().lastError, null);
  assert.equal(errors.length, 1);
  await loop.stop();
});

test("stop espera o ciclo em andamento e não agenda outro", async () => {
  const c = fakeClock();
  let finish!: () => void;
  let finished = false;
  const loop = createLoop({
    intervalMs: 1_000,
    logger: silent,
    ...c,
    runCycle: () =>
      new Promise<void>((r) => {
        finish = () => {
          finished = true;
          r();
        };
      }),
  });
  loop.start();
  await flush();
  const stopped = loop.stop();
  let done = false;
  void stopped.then(() => (done = true));
  await flush();
  assert.equal(done, false);
  finish();
  await stopped;
  assert.equal(finished, true);
  assert.equal(c.pending(), 0);
});
