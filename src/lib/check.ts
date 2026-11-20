import { CheckStatus } from "@prisma/client";

export interface CheckOutcome {
  status: CheckStatus;
  httpStatus: number | null;
  message: string;
  durationMs: number;
}

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Executa uma única tentativa de leitura leve contra a API do Supabase.
 * Sem tabela configurada (table vazio, padrão): bate em /auth/v1/health — presente em
 * TODO projeto Supabase, sempre, sem precisar criar nada. Responde 200 com a chave anon
 * válida e 401 se a chave for rejeitada. (A raiz de /rest/v1/ deixou de aceitar a chave
 * anon — só service_role — por isso não é mais usada aqui.)
 * Com tabela configurada: lê no máximo 1 registro dela via PostgREST (modo
 * avançado/compatibilidade com projetos configurados antes dessa mudança).
 * Nunca grava dados.
 */
export async function performSingleCheck(params: {
  supabaseUrl: string;
  apiKey: string;
  table: string;
  timeoutMs?: number;
}): Promise<CheckOutcome> {
  const { supabaseUrl, apiKey, table, timeoutMs = DEFAULT_TIMEOUT_MS } = params;
  const usesTable = table.trim().length > 0;

  const endpoint = usesTable
    ? new URL(`/rest/v1/${encodeURIComponent(table)}`, supabaseUrl)
    : new URL("/auth/v1/health", supabaseUrl);
  if (usesTable) {
    endpoint.searchParams.set("select", "id");
    endpoint.searchParams.set("limit", "1");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(endpoint.toString(), {
      method: "GET",
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    const durationMs = Date.now() - startedAt;

    if (response.status === 200) {
      return {
        status: CheckStatus.SUCESSO,
        httpStatus: response.status,
        message: usesTable
          ? "Leitura concluída com sucesso na tabela de verificação."
          : "Projeto respondeu com sucesso.",
        durationMs,
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        status: CheckStatus.FALHA_AUTENTICACAO,
        httpStatus: response.status,
        message:
          "A credencial foi rejeitada pelo Supabase (401/403). Verifique se a chave ainda é válida e tem permissão de leitura.",
        durationMs,
      };
    }

    if (response.status === 404) {
      return {
        status: CheckStatus.FALHA_CONFIGURACAO,
        httpStatus: response.status,
        message: usesTable
          ? "Tabela de verificação não encontrada (404). Confirme se a migration foi aplicada e se o nome da tabela está correto."
          : "Projeto respondeu 404. Confirme se o ID do projeto está correto.",
        durationMs,
      };
    }

    if (response.status >= 500) {
      return {
        status: CheckStatus.FALHA_CONEXAO,
        httpStatus: response.status,
        message: `O Supabase respondeu com erro de servidor (${response.status}). Pode ser uma instabilidade temporária.`,
        durationMs,
      };
    }

    return {
      status: CheckStatus.ERRO_DESCONHECIDO,
      httpStatus: response.status,
      message: `Resposta inesperada do Supabase (HTTP ${response.status}).`,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    if (error instanceof Error && error.name === "AbortError") {
      return {
        status: CheckStatus.FALHA_CONEXAO,
        httpStatus: null,
        message: `Tempo limite de ${timeoutMs}ms excedido ao contatar o projeto.`,
        durationMs,
      };
    }
    return {
      status: CheckStatus.FALHA_CONEXAO,
      httpStatus: null,
      message: "Falha de conexão ao contatar o projeto (DNS, rede ou recusa de conexão).",
      durationMs,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tenta a checagem com um pequeno número de retentativas, apenas para falhas
 * consideradas temporárias (conexão/timeout/5xx). Erros de autenticação ou
 * configuração não são repetidos, pois repetir não vai resolvê-los.
 */
export async function performCheckWithRetry(params: {
  supabaseUrl: string;
  apiKey: string;
  table: string;
  timeoutMs?: number;
  maxAttempts?: number;
}): Promise<CheckOutcome & { attempts: number }> {
  const { maxAttempts = 2, ...rest } = params;
  let lastOutcome: CheckOutcome | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const outcome = await performSingleCheck(rest);
    lastOutcome = outcome;

    const isRetryable =
      outcome.status === CheckStatus.FALHA_CONEXAO || outcome.status === CheckStatus.ERRO_DESCONHECIDO;

    if (!isRetryable || attempt === maxAttempts) {
      return { ...outcome, attempts: attempt };
    }

    await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
  }

  // Inalcançável: o laço sempre retorna antes, mas o TypeScript exige um retorno.
  return { ...(lastOutcome as CheckOutcome), attempts: maxAttempts };
}
