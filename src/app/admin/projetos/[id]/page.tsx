import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/requireAdmin";
import { serializeProject } from "@/lib/serialize";
import ProjectDetail from "./ProjectDetail";

export const instant = false;

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await getSession();
  if (!session) {
    redirect("/entrar");
  }

  const project = await prisma.project.findFirst({ where: { id, ownerId: session.uid } });
  if (!project) {
    notFound();
  }

  const executions = await prisma.execution.findMany({
    where: { projectId: id },
    orderBy: { startedAt: "desc" },
    take: 50,
  });

  return <ProjectDetail project={serializeProject(project)} initialExecutions={executions} />;
}
