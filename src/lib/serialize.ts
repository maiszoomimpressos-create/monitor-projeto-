import { Project } from "@prisma/client";
import { getScheduleConfig, nextRunAt } from "@/lib/schedule";

/**
 * Remove a credencial criptografada antes de qualquer resposta ao navegador.
 * Nunca envie `encryptedKey` para o frontend.
 */
export function serializeProject(project: Project) {
  const { encryptedKey, ...rest } = project;
  void encryptedKey;
  return {
    ...rest,
    maskedKey: project.keyLastFour ? `••••••••${project.keyLastFour}` : "—",
    nextRunAt: nextRunAt(project, new Date(), getScheduleConfig()),
  };
}
