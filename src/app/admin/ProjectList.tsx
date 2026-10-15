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
// Detalhes, histórico e "Verificar agora" ficam em /admin/projetos/[id].
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
    <ul className="flex flex-col gap-3">
      {projects.map((p) => {
        const last = lastExecutions[p.id];
        const ok = last?.status === "SUCESSO";
        return (
          <li key={p.id}>
            <Link
              href={`/admin/projetos/${p.id}`}
              className="block rounded-lg border border-gray-200 p-4 transition hover:border-gray-400 hover:shadow-sm dark:border-gray-800 dark:hover:border-gray-600"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium">{p.name}</span>
                  <span className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-400">
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
                </div>
                <span className="text-xs text-gray-500">Ver detalhes →</span>
              </div>

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
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
