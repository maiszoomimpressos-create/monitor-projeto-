"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import type { ProjectView } from "@/lib/types";
import { formatDateTime, STATUS_LABELS } from "@/lib/statusLabels";

type CheckStatusKey = keyof typeof STATUS_LABELS;

export default function Dashboard({ initialProjects }: { initialProjects: ProjectView[] }) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  async function handleCheckNow(id: string) {
    setBusyId(id);
    setFeedback((f) => ({ ...f, [id]: "" }));
    try {
      const res = await fetch(`/api/admin/projects/${id}/check`, { method: "POST" });
      const data = await res.json();
      if (res.status === 409) {
        setFeedback((f) => ({ ...f, [id]: "Já existe uma verificação em andamento para este projeto." }));
      } else if (!res.ok) {
        setFeedback((f) => ({ ...f, [id]: data.error ?? "Falha ao verificar." }));
      } else {
        const label = STATUS_LABELS[data.status as CheckStatusKey]?.label ?? data.status;
        setFeedback((f) => ({ ...f, [id]: `Resultado: ${label} (${data.durationMs}ms)` }));
      }
      router.refresh();
      const refreshed = await fetch("/api/admin/projects").then((r) => r.json());
      setProjects(refreshed);
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleEnabled(project: ProjectView) {
    setBusyId(project.id);
    try {
      await fetch(`/api/admin/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !project.enabled }),
      });
      const refreshed = await fetch("/api/admin/projects").then((r) => r.json());
      setProjects(refreshed);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Monitor de Disponibilidade Supabase</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Checagens leves e periódicas de leitura. Não garante que o plano gratuito não será
              pausado — apenas avisa quando um projeto parece indisponível.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/admin/novo"
              className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
            >
              Novo projeto
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700"
            >
              Sair
            </button>
          </div>
        </div>

        {projects.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700">
            Nenhum projeto cadastrado ainda. Clique em &quot;Novo projeto&quot; para começar.
          </div>
        )}

        <div className="flex flex-col gap-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/projetos/${project.id}`} className="font-medium hover:underline">
                      {project.name}
                    </Link>
                    {!project.enabled && (
                      <span className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-500 dark:border-gray-700">
                        desativado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{project.supabaseUrl}</p>
                </div>

                <div className="flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-400">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-200">Última execução</div>
                    <div>{formatDateTime(project.lastRunAt)}</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-200">Última consulta OK</div>
                    <div>{formatDateTime(project.lastSuccessAt)}</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-200">Próxima execução prevista</div>
                    <div>{project.enabled ? formatDateTime(project.nextRunAt) : "—"}</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-200">Intervalo</div>
                    <div>{project.intervalMinutes} min</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleCheckNow(project.id)}
                    disabled={busyId === project.id}
                    className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
                  >
                    {busyId === project.id ? "Verificando..." : "Verificar agora"}
                  </button>
                  <button
                    onClick={() => handleToggleEnabled(project)}
                    disabled={busyId === project.id}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-gray-700"
                  >
                    {project.enabled ? "Desativar" : "Ativar"}
                  </button>
                </div>
              </div>

              {feedback[project.id] && (
                <p className="mt-2 text-xs text-gray-700 dark:text-gray-300">{feedback[project.id]}</p>
              )}

              {project.consecutiveConnFailures >= 3 && (
                <p className="mt-2 text-xs text-purple-700 dark:text-purple-400">
                  {project.consecutiveConnFailures} falhas de conexão consecutivas. Pode indicar que o
                  projeto está pausado — confirme e restaure pelo painel do Supabase.
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
