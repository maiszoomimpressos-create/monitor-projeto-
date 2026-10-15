import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/requireAdmin";
import { serializeProject } from "@/lib/serialize";
import FloatingNav from "./FloatingNav";
import ProjectList, { type LastExecution } from "./ProjectList";

// Página inicial após o login: barra flutuante, botão "Novo projeto" e a lista
// simples dos projetos do usuário (detalhes/histórico em /admin/projetos/[id]).
export const instant = false;

export default async function AdminPage() {
  const session = await getSession();
  if (!session) {
    redirect("/entrar");
  }

  const projects = await prisma.project.findMany({
    where: { ownerId: session.uid },
    orderBy: { createdAt: "asc" },
  });

  // Última execução de cada projeto (uma consulta só).
  const latest = projects.length
    ? await prisma.execution.findMany({
        where: { projectId: { in: projects.map((p) => p.id) } },
        orderBy: { startedAt: "desc" },
        distinct: ["projectId"],
        select: { projectId: true, status: true, httpStatus: true, durationMs: true, startedAt: true },
      })
    : [];
  const lastExecutions: Record<string, LastExecution> = {};
  for (const { projectId, ...rest } of latest) lastExecutions[projectId] = rest;

  return (
    <>
      <FloatingNav userName={session.name} />
      <main className="min-h-screen px-4 pb-10 pt-24">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-lg font-semibold">Seus projetos</h1>
            <Link
              href="/admin/novo"
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
            >
              + Novo projeto
            </Link>
          </div>
          <ProjectList projects={projects.map(serializeProject)} lastExecutions={lastExecutions} />
        </div>
      </main>
    </>
  );
}
