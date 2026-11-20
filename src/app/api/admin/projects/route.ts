import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/requireAdmin";
import { projectInputSchema } from "@/lib/validation";
import { encryptSecret, lastFour } from "@/lib/crypto";
import { assertHostResolvesToPublicIp, assertWellFormedHttpUrl, assertWellFormedSupabaseUrl, UnsafeUrlError } from "@/lib/ssrf";
import { serializeProject } from "@/lib/serialize";
import { formatInterval, getScheduleConfig, isIntervalAllowed } from "@/lib/schedule";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const projects = await prisma.project.findMany({ where: { ownerId: session.uid }, orderBy: { createdAt: "asc" } });
  return NextResponse.json(projects.map(serializeProject));
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = projectInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const data = parsed.data;

  const schedule = getScheduleConfig();
  if (data.intervalMinutes !== undefined && !isIntervalAllowed(data.intervalMinutes, schedule)) {
    return NextResponse.json(
      { error: `Intervalo incompatível com o agendador ativo (mínimo ${formatInterval(schedule.tickMinutes).toLowerCase()}).` },
      { status: 400 },
    );
  }

  try {
    const url =
      data.type === "HTTP" ? assertWellFormedHttpUrl(data.supabaseUrl) : assertWellFormedSupabaseUrl(data.supabaseUrl);
    await assertHostResolvesToPublicIp(url.hostname);
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const project = await prisma.project.create({
    data: {
      ownerId: session.uid,
      name: data.name,
      supabaseUrl: data.supabaseUrl,
      type: data.type,
      httpMethod: data.httpMethod,
      expectedStatus: data.type === "HTTP" ? (data.expectedStatus ?? null) : null,
      accountEmail: data.accountEmail ?? null,
      healthcheckTable: data.healthcheckTable,
      intervalMinutes: data.intervalMinutes,
      enabled: data.enabled,
      // Projetos HTTP não têm credencial.
      encryptedKey: data.type === "HTTP" ? "" : encryptSecret(data.apiKey),
      keyLastFour: data.type === "HTTP" ? "" : lastFour(data.apiKey),
    },
  });

  return NextResponse.json(serializeProject(project), { status: 201 });
}
