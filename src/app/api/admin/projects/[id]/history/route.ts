import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/requireAdmin";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const { id } = await params;

  const owned = await prisma.project.findFirst({ where: { id, ownerId: session.uid }, select: { id: true } });
  if (!owned) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  }

  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;

  const executions = await prisma.execution.findMany({
    where: { projectId: id },
    orderBy: { startedAt: "desc" },
    take: limit,
  });

  return NextResponse.json(executions);
}
