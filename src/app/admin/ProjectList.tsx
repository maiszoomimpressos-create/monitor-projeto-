import Link from "next/link";
import type { ProjectView } from "@/lib/types";
import type { CheckStatus } from "@prisma/client";
import { formatDateTime, STATUS_LABELS } from "@/lib/statusLabels";
import { formatInterval } from "@/lib/schedule";

export interface LastExecution {
  status: CheckStatus;
  httpStatus: number | null;
  durationMs: number | null;
  startedAt: Date;
}

// Lista simples (server component) dos projetos do usuário logado.
// Cada projeto é uma linha compacta (nome, tipo, status) que expande com uma seta
// para ver os detalhes — sem precisar de JS, via <details>/<summary> do HTML.
// Detalhes completos, histórico e "Verificar agora" ficam em /admin/projetos/[id].
export default function ProjectList({
  projects,
  lastExecutions,
}: {
  projects: ProjectView[];
  lastExecutions: Record<string, LastExecution | undefined>;
}) {
  if (projects.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
        <p className="font-medium">Nenhum projeto ainda</p>
        <p className="mt-1 text-sm text-gray-500">
          Cadastre um projeto Supabase ou um site para mantê-lo acordado com acessos periódicos.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {projects.map((p) => {
        const last = lastExecutions[p.id];
        const ok = last?.status === "SUCESSO";
        return (
          <li key={p.id} className="rounded-lg border border-gray-200 dark:border-gray-800">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 p-3 [&::-webkit-details-marker]:hidden">
                <svg
                  className="h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform group-open:rotate-90"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
                <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                <span className="hidden rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-400 sm:inline">
                  {p.type === "HTTP" ? "Site" : "Supabase"}
                </span>
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    p.enabled
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-gray-100 text-gray-500 dark:bg-gray-900"
                  }`}
                >
                  {p.enabled ? "Ativo" : "Inativo"}
                </span>
                {last && (
                  <span className={`text-xs ${ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                    {ok ? "OK" : "Falha"}
                  </span>
                )}
              </summary>

              <div className="border-t border-gray-100 p-4 pt-3 dark:border-gray-800">
                {p.accountEmail && <p className="truncate text-xs text-gray-500">Conta: {p.accountEmail}</p>}

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                  <div>
                    <dt className="text-gray-500">Intervalo</dt>
                    <dd>{formatInterval(p.intervalMinutes)}</dd>
                  </div>
                  <div className="col-span-2 sm:col-span-2">
                    <dt className="text-gray-500">Último resultado</dt>
                    <dd>
                      {last ? (
                        <>
                          <span className={ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}>
                            {ok ? "OK" : `Falha — ${STATUS_LABELS[last.status].label}`}
                          </span>
                          {last.httpStatus != null && <> · HTTP {last.httpStatus}</>}
                          {last.durationMs != null && <> · {last.durationMs} ms</>}
                          <> · {formatDateTime(last.startedAt)}</>
                        </>
                      ) : (
                        <span className="text-gray-500">Ainda não verificado</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Próxima execução</dt>
                    <dd>{p.enabled ? formatDateTime(p.nextRunAt) : "—"}</dd>
                  </div>
                </dl>

                <Link
                  href={`/admin/projetos/${p.id}`}
                  className="mt-3 inline-block text-xs text-gray-500 hover:underline"
                >
                  Ver detalhes →
                </Link>
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
