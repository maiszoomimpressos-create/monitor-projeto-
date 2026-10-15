import { CheckStatus } from "@prisma/client";
import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from "node:dns";
import { request as httpsRequest } from "node:https";
import type { CheckOutcome } from "@/lib/check";
import { assertWellFormedHttpUrl, isPrivateOrReservedIp, UnsafeUrlError } from "@/lib/ssrf";

// Checagem de keep-alive para sites/apps (tipo HTTP), D-009: leitura leve (GET/HEAD),
// sem login nem escrita. Sites em plano gratuito podem levar ~30 s para "acordar".
export const HTTP_TIMEOUT_MS = 30_000;
export const HTTP_MAX_REDIRECTS = 3;
export const HTTP_MAX_BODY_BYTES = 64 * 1024;
export const HTTP_USER_AGENT = "MonitorKeepAlive/1.0 (+verificacao periodica de disponibilidade)";
const MIN_RETRY_MS = 10_000; // só tenta de novo se ainda houver tempo útil

export type HttpMethod = "GET" | "HEAD";

/** Classifica o status HTTP final. Puro (testado em httpCheck.test.ts). */
export function classifyHttpStatus(
  httpStatus: number,
  expectedStatus: number | null | undefined,
): { status: CheckStatus; message: string } {
  if (expectedStatus) {
    return httpStatus === expectedStatus
      ? { status: CheckStatus.SUCESSO, message: `Site respondeu com o status esperado (${httpStatus}).` }
      : httpStatus >= 500
        ? { status: CheckStatus.FALHA_CONEXAO, message: `Site respondeu ${httpStatus} (esperado ${expectedStatus}); pode estar acordando.` }
        : { status: CheckStatus.FALHA_CONFIGURACAO, message: `Site respondeu ${httpStatus}, mas o esperado era ${expectedStatus}.` };
  }
  if (httpStatus >= 200 && httpStatus < 400) {
    return { status: CheckStatus.SUCESSO, message: `Site respondeu com sucesso (HTTP ${httpStatus}).` };
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return { status: CheckStatus.FALHA_AUTENTICACAO, message: `Site exige autenticação ou bloqueou o acesso (HTTP ${httpStatus}).` };
  }
  if (httpStatus === 404 || httpStatus === 410) {
    return { status: CheckStatus.FALHA_CONFIGURACAO, message: `Página não encontrada (HTTP ${httpStatus}). Confira a URL.` };
  }
  if (httpStatus >= 500) {
    return { status: CheckStatus.FALHA_CONEXAO, message: `Site respondeu com erro de servidor (HTTP ${httpStatus}); pode estar acordando.` };
  }
  return { status: CheckStatus.ERRO_DESCONHECIDO, message: `Resposta inesperada do site (HTTP ${httpStatus}).` };
}

type LookupCb = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/** lookup usado na conexão: rejeita qualquer IP privado/interno (proteção contra DNS rebinding). */
function safeLookup(hostname: string, options: LookupOptions, callback: LookupCb) {
  dnsLookup(hostname, { ...options, all: true, verbatim: true }, (err, addresses) => {
    if (err) return callback(err, "");
    const list = addresses as LookupAddress[];
    if (list.length === 0 || list.some((a) => isPrivateOrReservedIp(a.address))) {
      return callback(new UnsafeUrlError("O domínio resolve para endereço privado/interno e foi bloqueado.") as NodeJS.ErrnoException, "");
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

interface RawResponse {
  status: number;
  location: string | null;
}

function requestOnce(url: URL, method: HttpMethod, timeoutMs: number): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      url,
      {
        method,
        lookup: safeLookup as never,
        timeout: timeoutMs,
        headers: { "User-Agent": HTTP_USER_AGENT, Accept: "text/html,application/json;q=0.9,*/*;q=0.8" },
      },
      (res) => {
        let received = 0;
        const done = () => resolve({ status: res.statusCode ?? 0, location: (res.headers.location as string) ?? null });
        res.on("data", (chunk: Buffer) => {
          received += chunk.length;
          if (received >= HTTP_MAX_BODY_BYTES) {
            res.destroy();
            done();
          }
        });
        res.on("end", done);
        res.on("close", done);
        res.on("error", done);
      },
    );
    const timer = setTimeout(() => req.destroy(Object.assign(new Error("timeout"), { name: "AbortError" })), timeoutMs);
    req.on("timeout", () => req.destroy(Object.assign(new Error("timeout"), { name: "AbortError" })));
    req.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    req.on("close", () => clearTimeout(timer));
    req.end();
  });
}

export async function performSingleHttpCheck(params: {
  url: string;
  method?: HttpMethod;
  expectedStatus?: number | null;
  timeoutMs?: number;
}): Promise<CheckOutcome> {
  const { method = "GET", expectedStatus, timeoutMs = HTTP_TIMEOUT_MS } = params;
  const startedAt = Date.now();
  const elapsed = () => Date.now() - startedAt;
  try {
    let current = assertWellFormedHttpUrl(params.url);
    for (let hop = 0; ; hop++) {
      const remaining = timeoutMs - elapsed();
      if (remaining <= 0) throw Object.assign(new Error("timeout"), { name: "AbortError" });
      const res = await requestOnce(current, method, remaining);
      const isRedirect = res.status >= 300 && res.status < 400 && res.location;
      if (isRedirect && hop < HTTP_MAX_REDIRECTS) {
        current = assertWellFormedHttpUrl(new URL(res.location!, current).toString());
        continue;
      }
      const c = classifyHttpStatus(res.status, expectedStatus);
      return { status: c.status, httpStatus: res.status, message: c.message, durationMs: elapsed() };
    }
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      return {
        status: CheckStatus.FALHA_CONFIGURACAO,
        httpStatus: null,
        message: `URL bloqueada por segurança: ${error.message}`,
        durationMs: elapsed(),
      };
    }
    if (error instanceof Error && error.name === "AbortError") {
      return {
        status: CheckStatus.FALHA_CONEXAO,
        httpStatus: null,
        message: `Tempo limite de ${Math.round(timeoutMs / 1000)} s excedido (o site pode estar acordando).`,
        durationMs: elapsed(),
      };
    }
    return {
      status: CheckStatus.FALHA_CONEXAO,
      httpStatus: null,
      message: "Falha de conexão com o site (DNS, TLS, rede ou recusa).",
      durationMs: elapsed(),
    };
  }
}

/** 1 retentativa para falhas temporárias, respeitando o prazo final (deadline, epoch ms). */
export async function performHttpCheckWithRetry(params: {
  url: string;
  method?: HttpMethod;
  expectedStatus?: number | null;
  deadline?: number;
}): Promise<CheckOutcome & { attempts: number }> {
  const deadline = params.deadline ?? Date.now() + 2 * HTTP_TIMEOUT_MS + 2_000;
  let outcome: CheckOutcome | null = null;
  let attempts = 0;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const remaining = deadline - Date.now();
    const timeoutMs = Math.min(HTTP_TIMEOUT_MS, remaining);
    if (attempt > 1 && timeoutMs < MIN_RETRY_MS) break;
    attempts = attempt;
    outcome = await performSingleHttpCheck({ ...params, timeoutMs: Math.max(timeoutMs, 1_000) });
    const retryable = outcome.status === CheckStatus.FALHA_CONEXAO || outcome.status === CheckStatus.ERRO_DESCONHECIDO;
    if (!retryable) return { ...outcome, attempts: attempt };
    if (attempt === 1) await new Promise((r) => setTimeout(r, 1_000));
  }
  return { ...(outcome as CheckOutcome), attempts };
}
