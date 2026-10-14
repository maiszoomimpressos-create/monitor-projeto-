import type { VercelConfig } from "@vercel/config/v1";

// Agendamento das checagens de disponibilidade dos projetos Supabase cadastrados.
//
// IMPORTANTE:
// - O agendador do Vercel (Cron Jobs) roda no lado do servidor, fora de qualquer
//   projeto Supabase monitorado — a pausa de um deles não afeta este agendamento.
// - "0 9 * * *" dispara uma vez por dia às 09:00 UTC (06:00 BRT). O plano Hobby
//   do Vercel limita Cron Jobs a 1 execução por dia; para frequências maiores é
//   preciso o plano Pro (ou um agendador externo).
//   Plano Hobby CONFIRMADO (deploy do PR #1 recusado com cron a cada 6 h).
//   No Hobby o disparo pode ocorrer em qualquer minuto dentro da hora 09 UTC.
// - O intervalo de cada projeto é escolhido pelo cliente no painel (D-001), limitado
//   a múltiplos compatíveis com o agendador ativo (SCHEDULER_TICK_MINUTES, padrão
//   1440). Para intervalos menores use o agendador externo
//   (`docs/agendador-externo.github-actions.yml` (copiar para `.github/workflows/`)) e ajuste SCHEDULER_TICK_MINUTES.
// - Se migrar para o Pro, pode trocar para "*/15 * * * *" e definir
//   SCHEDULER_TICK_MINUTES=15 e SCHEDULER_TICK_OFFSET_MINUTES=0.
export const config: VercelConfig = {
  framework: "nextjs",
  crons: [
    {
      path: "/api/cron/check-projects",
      schedule: "0 9 * * *",
    },
  ],
};
