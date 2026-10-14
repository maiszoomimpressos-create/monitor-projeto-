import { cookies } from "next/headers";
import { readSessionToken, SESSION_COOKIE_NAME, type SessionPayload } from "@/lib/auth";

/**
 * Retorna a sessão do usuário logado (ou null).
 * O proxy já bloqueia /admin e /api/admin/*, mas cada rota sensível revalida
 * a sessão e usa o `uid` para filtrar os dados do próprio usuário.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE_NAME)?.value);
}
