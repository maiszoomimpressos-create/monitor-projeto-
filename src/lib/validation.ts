import { z } from "zod";

export const projectInputSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome.").max(120),
  supabaseUrl: z
    .string()
    .trim()
    .url("Informe uma URL válida.")
    .max(300),
  apiKey: z.string().trim().min(20, "A chave informada parece muito curta.").max(2000),
  healthcheckTable: z
    .string()
    .trim()
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Nome de tabela inválido.")
    .max(63)
    .default("_uptime_healthcheck"),
  intervalMinutes: z
    .number()
    .int()
    .min(5, "O intervalo mínimo é de 5 minutos.")
    .max(60 * 24 * 7, "O intervalo máximo é de 7 dias.")
    .default(360),
  enabled: z.boolean().default(true),
});

export const projectUpdateSchema = projectInputSchema.partial().extend({
  // Ao atualizar, a chave é opcional (mantém a anterior se omitida/vazia).
  apiKey: z.string().trim().max(2000).optional(),
});

export type ProjectInput = z.infer<typeof projectInputSchema>;
