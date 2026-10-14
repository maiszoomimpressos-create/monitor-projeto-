import { connection } from "next/server";
import { allowedIntervals, getScheduleConfig, schedulerNote } from "@/lib/schedule";
import NewProjectForm from "./NewProjectForm";

// Lê o agendador ativo em tempo de requisição (não no build) para oferecer
// só intervalos compatíveis.
export const instant = false;

export default async function NewProjectPage() {
  await connection();
  const config = getScheduleConfig();
  return <NewProjectForm intervals={allowedIntervals(config)} schedulerNote={schedulerNote(config)} />;
}
