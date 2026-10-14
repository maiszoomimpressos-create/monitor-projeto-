import { NextRequest, NextResponse } from "next/server";
import { sweepDueProjects } from "@/lib/sweep";
import { cleanupHistory } from "@/lib/cleanup";

export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const summary = await sweepDueProjects();
  await cleanupHistory();

  return NextResponse.json({ ok: true, ...summary });
}

// O agendador do Vercel (Cron Jobs) chama via GET.
export async function GET(request: NextRequest) {
  return handle(request);
}

// Mantido para permitir disparo manual autenticado via POST (ex.: curl/CI).
export async function POST(request: NextRequest) {
  return handle(request);
}
