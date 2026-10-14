import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

// O Proxy roda em runtime Node.js, então `node:crypto` funciona aqui.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const loggedIn = verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  // Usuário já logado não precisa ver login/cadastro.
  if (pathname === "/entrar" || pathname === "/cadastro") {
    return loggedIn ? NextResponse.redirect(new URL("/admin", request.url)) : NextResponse.next();
  }

  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  if (loggedIn) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/entrar", request.url));
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/entrar", "/cadastro"],
};
