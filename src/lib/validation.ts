import { z } from "zod";

// Campos sem valores padrão: base da edição (PATCH), onde omitido = manter.
const projectFields = {
  name: z.string().trim().min(1, "Informe um nome.").max(120),
  supabaseUrl: z.string().trim().url("Informe uma URL válida.").max(300),
  httpMethod: z.enum(["GET", "HEAD"]),
  expectedStatus: z.number().int().min(100).max(599).nullable(),
  // Só referência/organização (vazio = sem e-mail).
  accountEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "E-mail muito longo.")
    .refine((v) => v === "" || z.email().safeParse(v).success, "E-mail da conta inválido.")
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  healthcheckTable: z
    .string()
    .trim()
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Nome de tabela inválido.")
    .max(63),
  intervalMinutes: z
    .number()
    .int()
    // O mínimo efetivo depende do agendador ativo (SCHEDULER_TICK_MINUTES) e é
    // checado nas rotas com isIntervalAllowed (src/lib/schedule.ts).
    .min(5, "O intervalo mínimo é de 5 minutos.")
    .max(60 * 24 * 7, "O intervalo máximo é de 7 dias."),
  enabled: z.boolean(),
};

export const projectInputSchema = z
  .object({
    ...projectFields,
    type: z.enum(["SUPABASE", "HTTP"]).default("SUPABASE"),
    // Obrigatória só para SUPABASE.
    apiKey: z.string().trim().max(2000).default(""),
    httpMethod: projectFields.httpMethod.default("GET"),
    expectedStatus: projectFields.expectedStatus.optional(),
    accountEmail: projectFields.accountEmail.optional(),
    healthcheckTable: projectFields.healthcheckTable.default("_uptime_healthcheck"),
    intervalMinutes: projectFields.intervalMinutes.default(1440),
    enabled: projectFields.enabled.default(true),
  })
  .superRefine((data, ctx) => {
    if (data.type === "SUPABASE" && data.apiKey.length < 20) {
      ctx.addIssue({ code: "custom", path: ["apiKey"], message: "A chave informada parece muito curta." });
    }
  });

// Edição: tudo opcional e SEM defaults (antes, um PATCH parcial — ex. só "enabled" —
// reaplicava defaults e sobrescrevia intervalo/tabela). O tipo não muda na edição.
export const projectUpdateSchema = z.object(projectFields).partial().extend({
  // Ao atualizar, a chave é opcional (mantém a anterior se omitida/vazia).
  apiKey: z.string().trim().max(2000).optional(),
});

export type ProjectInput = z.infer<typeof projectInputSchema>;

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(80, "Nome muito longo."),
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido.")).pipe(z.string().max(254)),
  password: z
    .string()
    .min(8, "A senha deve ter pelo menos 8 caracteres.")
    .max(200, "Senha muito longa."),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Informe o e-mail.").max(254),
  password: z.string().min(1, "Informe a senha.").max(200),
});
