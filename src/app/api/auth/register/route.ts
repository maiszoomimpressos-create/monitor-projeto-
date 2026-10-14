import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createSessionToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { registerSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const limit = rateLimit(`register-ip:${clientIp(request.headers)}`, 10, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Muitos cadastros a partir deste endereço. Tente mais tarde." }, { status: 429 });
  }

  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const { name, email, password } = parsed.data;

  try {
    const user = await prisma.user.create({
      data: { name, email, passwordHash: await hashPassword(password) },
    });
    const response = NextResponse.json({ ok: true }, { status: 201 });
    response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(user), sessionCookieOptions);
    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Já existe uma conta com este e-mail." }, { status: 409 });
    }
    throw error;
  }
}
