import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const VERSION = "v1";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY não configurada. Defina uma chave de 32 bytes em base64 nas variáveis de ambiente do servidor."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY inválida: deve decodificar para exatamente 32 bytes (use `openssl rand -base64 32`)."
    );
  }
  return key;
}

/**
 * Criptografa um segredo (ex.: chave de API) para persistência.
 * A chave de criptografia vive apenas em variável de ambiente do servidor, nunca no banco.
 */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, ciphertext]);
  return `${VERSION}:${payload.toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  const key = getKey();
  const [version, b64] = stored.split(":");
  if (version !== VERSION || !b64) {
    throw new Error("Formato de credencial criptografada desconhecido.");
  }
  const payload = Buffer.from(b64, "base64");
  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = payload.subarray(IV_LENGTH + 16);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

export function lastFour(secret: string): string {
  if (secret.length <= 4) return "****";
  return secret.slice(-4);
}
