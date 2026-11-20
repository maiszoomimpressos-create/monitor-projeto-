// Aceita o ID "cru" do projeto Supabase ou, por engano, a URL do dashboard
// (supabase.com/dashboard/project/<id>) ou a própria URL da API
// (https://<id>.supabase.co) — sempre extrai só o ID do projeto.
export function extractSupabaseProjectRef(input: string): string {
  const trimmed = input.trim();
  const dashboardMatch = trimmed.match(/supabase\.com\/dashboard\/project\/([a-z0-9-]+)/i);
  if (dashboardMatch) return dashboardMatch[1];
  const apiUrlMatch = trimmed.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.(co|in|net)/i);
  if (apiUrlMatch) return apiUrlMatch[1];
  return trimmed;
}
