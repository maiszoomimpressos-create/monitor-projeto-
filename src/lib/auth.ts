import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE_NAME = "session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas

export type SessionPayload = { uid: string; name: string; exp: number };

function getSecret(): string {
  // Mantém o nome de variável existente para não exigir nova configuração.
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET não configurada.");
  }
  return secret;
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

export function createSessionToken(user: { id: string; name: string }): string {
  const payload: SessionPayload = { uid: user.id, name: user.name, exp: Date.now() + SESSION_TTL_MS };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function readSessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(sign(encodedPayload));
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (typeof payload.uid !== "string" || typeof payload.exp !== "number" || payload.exp <= Date.now()) {
      return null;
    }
    return { uid: payload.uid, name: String(payload.name ?? ""), exp: payload.exp };
  } catch {
    return null;
  }
}

export function verifySessionToken(token: string | undefined | null): boolean {
  return readSessionToken(token) !== null;
}

export const SESSION_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
};
