import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { serializeProject } from "@/lib/serialize";
import ProjectDetail from "./ProjectDetail";

export const instant = false;

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const project = await prisma.project.findUnique({ where: { id } });
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
