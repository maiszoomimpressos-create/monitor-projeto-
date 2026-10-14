import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/requireAdmin";
import { projectUpdateSchema } from "@/lib/validation";
import { encryptSecret, lastFour } from "@/lib/crypto";
import { assertHostResolvesToPublicIp, assertWellFormedSupabaseUrl, UnsafeUrlError } from "@/lib/ssrf";
import { serializeProject } from "@/lib/serialize";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const { id } = await params;

  const existing = await prisma.project.findFirst({ where: { id, ownerId: session.uid } });
  if (!existing) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  }

  const json = await request.json().catch(() => null);
  const parsed = projectUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const data = parsed.data;

  const nextUrl = data.supabaseUrl ?? existing.supabaseUrl;
  if (data.supabaseUrl) {
    try {
      const url = assertWellFormedSupabaseUrl(nextUrl);
      await assertHostResolvesToPublicIp(url.hostname);
    } catch (error) {
      if (error instanceof UnsafeUrlError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
  }

  const project = await prisma.project.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      supabaseUrl: nextUrl,
      healthcheckTable: data.healthcheckTable ?? existing.healthcheckTable,
      intervalMinutes: data.intervalMinutes ?? existing.intervalMinutes,
      enabled: data.enabled ?? existing.enabled,
      ...(data.apiKey
        ? { encryptedKey: encryptSecret(data.apiKey), keyLastFour: lastFour(data.apiKey) }
        : {}),
    },
  });

  return NextResponse.json(serializeProject(project));
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const { id } = await params;

  const existing = await prisma.project.findFirst({ where: { id, ownerId: session.uid } });
  if (!existing) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  }

  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
