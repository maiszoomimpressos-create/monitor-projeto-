import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { sweepDueProjects } from "@/lib/sweep";
import { cleanupHistory } from "@/lib/cleanup";
import { recordCronRun } from "@/lib/cronLog";

// Rotina periódica: chamada pelo Vercel Cron (GET, diário no Hobby) e, opcionalmente,
// por um agendador externo com o mesmo CRON_SECRET: Supabase pg_cron + pg_net
// (principal, D-008, sql/supabase-despertador.sql — usa POST), GitHub Actions ou cron-job.org.
// GET e POST são aceitos; o corpo é ignorado. Auth: header "Authorization: Bearer <CRON_SECRET>".
export const maxDuration = 60;
const SWEEP_BUDGET_MS = 45_000; // deixa folga para limpeza e resposta

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let summary;
  try {
    summary = await sweepDueProjects(SWEEP_BUDGET_MS);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    console.error("Falha na rotina de checagem:", error);
    await recordCronRun({ ok: false, errorMessage: message }).catch((e) =>
      console.error("Falha ao registrar execução do cron:", e),
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  try {
    await cleanupHistory();
  } catch (error) {
    console.error("Falha na limpeza do histórico:", error);
  }
  await recordCronRun({ ok: true, ...summary }).catch((error) =>
    console.error("Falha ao registrar execução do cron:", error),
  );

  return NextResponse.json({ ok: true, ...summary });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
