import { prisma } from "@/lib/db";
import { serializeProject } from "@/lib/serialize";
import Dashboard from "./Dashboard";

// Painel administrativo: sempre busca dados atuais do banco de controle a cada
// requisição (projetos, histórico), nunca deve ser pré-renderizado/estático.
export const instant = false;

export default async function AdminPage() {
  const projects = await prisma.project.findMany({ orderBy: { createdAt: "asc" } });
  const serialized = projects.map(serializeProject);

  return <Dashboard initialProjects={serialized} />;
}
