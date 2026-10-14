import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth";
import { getDummyHash, verifyPassword } from "@/lib/password";
import { clientIp, rateLimit, resetRateLimit } from "@/lib/rateLimit";
import { loginSchema } from "@/lib/validation";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const ipLimit = rateLimit(`login-ip:${clientIp(request.headers)}`, MAX_ATTEMPTS * 4, WINDOW_MS);
  const emailKey = `login-email:${email}`;
  const emailLimit = rateLimit(emailKey, MAX_ATTEMPTS, WINDOW_MS);
  if (!ipLimit.ok || !emailLimit.ok) {
    const retry = Math.max(ipLimit.retryAfterSec, emailLimit.retryAfterSec);
    return NextResponse.json(
      { error: `Muitas tentativas. Tente novamente em ${Math.ceil(retry / 60)} min.` },
      { status: 429, headers: { "Retry-After": String(retry) } },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !ok) {
    return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
  }

  resetRateLimit(emailKey);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(user), sessionCookieOptions);
  return response;
}
