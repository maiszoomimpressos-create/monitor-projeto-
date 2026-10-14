import type { VercelConfig } from "@vercel/config/v1";

// Agendamento das checagens de disponibilidade dos projetos Supabase cadastrados.
//
// IMPORTANTE:
// - O agendador do Vercel (Cron Jobs) roda no lado do servidor, fora de qualquer
//   projeto Supabase monitorado — a pausa de um deles não afeta este agendamento.
// - "0 */6 * * *" dispara a cada 6 horas. Em projetos no plano Hobby, o Vercel
//   limita Cron Jobs a 1 execução por dia — nesse caso, troque para "0 6 * * *"
//   (uma vez ao dia) ou faça upgrade para o plano Pro para manter 6 em 6 horas.
// - O intervalo de cada projeto individual é controlado no painel (/admin) e
//   nunca pode ser mais frequente do que este cron: ele é quem decide se já
//   passou tempo suficiente desde a última checagem de cada projeto.
export const config: VercelConfig = {
  framework: "nextjs",
  crons: [
    {
      path: "/api/cron/check-projects",
      schedule: "0 */6 * * *",
    },
  ],
};
