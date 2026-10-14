import { Project } from "@prisma/client";
import { nextRunAt } from "@/lib/runCheck";

/**
 * Remove a credencial criptografada antes de qualquer resposta ao navegador.
 * Nunca envie `encryptedKey` para o frontend.
 */
export function serializeProject(project: Project) {
  const { encryptedKey, ...rest } = project;
  void encryptedKey;
  return {
    ...rest,
    maskedKey: `••••••••${project.keyLastFour}`,
    nextRunAt: nextRunAt(project),
  };
}
