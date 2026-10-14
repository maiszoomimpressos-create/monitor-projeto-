import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/requireAdmin";
import { runCheckForProject } from "@/lib/runCheck";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const { id } = await params;

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  }

  const result = await runCheckForProject(project, "manual");

  if (result.skipped) {
    return NextResponse.json({ skipped: true, reason: result.reason }, { status: 409 });
  }

  return NextResponse.json({
    skipped: false,
    status: result.status,
    message: result.message,
    durationMs: result.durationMs,
  });
}
