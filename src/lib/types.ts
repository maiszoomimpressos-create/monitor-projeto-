import type { CheckStatus } from "@prisma/client";

// Tipos usados por componentes client-side — evitam importar o runtime
// do Prisma (que não deve ir para o bundle do navegador).
export type { CheckStatus };

export interface ProjectView {
  id: string;
  name: string;
  type: "SUPABASE" | "HTTP";
  httpMethod: string;
  expectedStatus: number | null;
  accountEmail: string | null;
  supabaseUrl: string;
  healthcheckTable: string;
  maskedKey: string;
  intervalMinutes: number;
  enabled: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  lastRunAt: string | Date | null;
  lastSuccessAt: string | Date | null;
  isRunning: boolean;
  runningSince: string | Date | null;
  consecutiveConnFailures: number;
  nextRunAt: string | Date | null;
}

export interface ExecutionView {
  id: string;
  projectId: string;
  startedAt: string | Date;
  finishedAt: string | Date | null;
  durationMs: number | null;
  status: CheckStatus;
  httpStatus: number | null;
  message: string | null;
  triggeredBy: string;
}
