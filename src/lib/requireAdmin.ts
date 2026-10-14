import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

/**
 * Checagem de defesa em profundidade dentro das rotas da API.
 * O middleware já bloqueia /admin e /api/admin/*, mas cada rota sensível
 * revalida a sessão para não depender só da configuração de roteamento.
 */
export async function requireAdminSession(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}
