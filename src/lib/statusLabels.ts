import type { CheckStatus } from "@prisma/client";

export const STATUS_LABELS: Record<CheckStatus, { label: string; badgeClass: string }> = {
  SUCESSO: {
    label: "Sucesso",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  FALHA_CONEXAO: {
    label: "Falha de conexão",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
  },
  FALHA_AUTENTICACAO: {
    label: "Erro de autenticação",
    badgeClass: "bg-red-100 text-red-800 border-red-300",
  },
  FALHA_CONFIGURACAO: {
    label: "Erro de configuração",
    badgeClass: "bg-orange-100 text-orange-800 border-orange-300",
  },
  POSSIVEL_PAUSA: {
    label: "Possível pausa — verificar no Supabase",
    badgeClass: "bg-purple-100 text-purple-800 border-purple-300",
  },
  ERRO_DESCONHECIDO: {
    label: "Erro desconhecido",
    badgeClass: "bg-gray-100 text-gray-800 border-gray-300",
  },
};

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    // Sempre no fuso do usuário (o servidor da Vercel roda em UTC).
    timeZone: "America/Sao_Paulo",
  }).format(date);
}
