import { lookup } from "dns/promises";
import { isIP } from "net";

/**
 * Valida se a URL cadastrada é um projeto Supabase público e, antes de cada uso,
 * resolve o hostname e rejeita endereços internos/privados (proteção contra SSRF,
 * incluindo DNS rebinding em checagens futuras pois a validação é refeita a cada chamada).
 */

const SUPABASE_HOST_SUFFIXES = [".supabase.co", ".supabase.in", ".supabase.net"];

export class UnsafeUrlError extends Error {}

export function assertWellFormedSupabaseUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("URL inválida.");
  }

  if (url.protocol !== "https:") {
    throw new UnsafeUrlError("A URL do Supabase deve usar https.");
  }

  const hostname = url.hostname.toLowerCase();
  const isKnownSuffix = SUPABASE_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
  if (!isKnownSuffix) {
    throw new UnsafeUrlError(
      "A URL deve apontar para um domínio *.supabase.co / *.supabase.in / *.supabase.net."
    );
  }

  if (url.username || url.password) {
    throw new UnsafeUrlError("A URL não pode conter credenciais embutidas.");
  }

  return url;
}

function ipv4ToLong(ip: string): number {
  const parts = ip.split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function inCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToLong(ip) & mask) === (ipv4ToLong(range) & mask);
}

const PRIVATE_V4_RANGES = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "224.0.0.0/4",
  "240.0.0.0/4",
];

function isPrivateOrReservedIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    return PRIVATE_V4_RANGES.some((cidr) => inCidr(ip, cidr));
  }
  if (isIP(ip) === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1" || normalized === "::") return true;
    if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
      return true; // link-local fe80::/10
    }
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
      return true; // unique local fc00::/7
    }
    if (normalized.startsWith("::ffff:")) {
      const mapped = normalized.replace("::ffff:", "");
      if (isIP(mapped) === 4) return isPrivateOrReservedIp(mapped);
    }
    return false;
  }
  return true; // não é um IP reconhecível: trata como inseguro
}

/**
 * Resolve o hostname e garante que nenhum endereço resolvido é privado/interno.
 * Deve ser chamado imediatamente antes de cada requisição de checagem.
 */
export async function assertHostResolvesToPublicIp(hostname: string): Promise<void> {
  const results = await lookup(hostname, { all: true, verbatim: true });
  if (results.length === 0) {
    throw new UnsafeUrlError("Não foi possível resolver o endereço do projeto.");
  }
  for (const { address } of results) {
    if (isPrivateOrReservedIp(address)) {
      throw new UnsafeUrlError(
        "O endereço resolvido para esse domínio é privado/interno e foi bloqueado por segurança."
      );
    }
  }
}
