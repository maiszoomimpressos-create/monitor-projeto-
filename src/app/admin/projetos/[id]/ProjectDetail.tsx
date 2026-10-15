"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import type { ExecutionView, ProjectView } from "@/lib/types";
import { formatDateTime, STATUS_LABELS } from "@/lib/statusLabels";

type CheckStatusKey = keyof typeof STATUS_LABELS;

export default function ProjectDetail({
  project,
  initialExecutions,
  intervals,
  schedulerNote,
}: {
  project: ProjectView;
  initialExecutions: ExecutionView[];
  intervals: { minutes: number; label: string }[];
  schedulerNote: string;
}) {
  const intervalOptions = intervals.some((i) => i.minutes === project.intervalMinutes)
    ? intervals
    : [{ minutes: project.intervalMinutes, label: `${project.intervalMinutes} min (incompatível com o agendador atual)` }, ...intervals];
  const router = useRouter();
  const [executions, setExecutions] = useState(initialExecutions);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: project.name,
    supabaseUrl: project.supabaseUrl,
    healthcheckTable: project.healthcheckTable,
    intervalMinutes: project.intervalMinutes,
    enabled: project.enabled,
    apiKey: "",
    httpMethod: project.httpMethod,
    expectedStatus: project.expectedStatus ? String(project.expectedStatus) : "",
  });
  const isHttp = project.type === "HTTP";

  async function refreshHistory() {
    const res = await fetch(`/api/admin/projects/${project.id}/history`);
    if (res.ok) setExecutions(await res.json());
  }

  async function handleCheckNow() {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/projects/${project.id}/check`, { method: "POST" });
      const data = await res.json();
      if (res.status === 409) {
        setFeedback("Já existe uma verificação em andamento para este projeto.");
      } else if (!res.ok) {
        setFeedback(data.error ?? "Falha ao verificar.");
      } else {
        const label = STATUS_LABELS[data.status as CheckStatusKey]?.label ?? data.status;
        setFeedback(`Resultado: ${label} (${data.durationMs}ms) — ${data.message}`);
      }
      await refreshHistory();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit() {
    setBusy(true);
    setFeedback(null);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        supabaseUrl: form.supabaseUrl,
        intervalMinutes: Number(form.intervalMinutes),
        enabled: form.enabled,
      };
      if (isHttp) {
        payload.httpMethod = form.httpMethod;
        payload.expectedStatus = form.expectedStatus ? Number(form.expectedStatus) : null;
      } else {
        payload.healthcheckTable = form.healthcheckTable;
        if (form.apiKey.trim()) payload.apiKey = form.apiKey.trim();
      }

      const res = await fetch(`/api/admin/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback(data.error ?? "Não foi possível salvar.");
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Excluir o projeto "${project.name}" e todo o seu histórico? Essa ação não pode ser desfeita.`)) {
      return;
    }
    setBusy(true);
    try {
      await fetch(`/api/admin/projects/${project.id}`, { method: "DELETE" });
      router.push("/admin");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/admin" className="text-sm text-gray-500 hover:underline">
          ← Voltar
        </Link>

        <div className="mt-2 flex items-start justify-between">
          <h1 className="text-xl font-semibold">{project.name}</h1>
          <div className="flex gap-2">
            <button
              onClick={handleCheckNow}
              disabled={busy}
              className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              Verificar agora
            </button>
            <button
              onClick={() => setEditing((v) => !v)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs dark:border-gray-700"
            >
              {editing ? "Cancelar edição" : "Editar"}
            </button>
            <button
              onClick={handleDelete}
              disabled={busy}
              className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-600 disabled:opacity-50"
            >
              Excluir
            </button>
          </div>
        </div>

        {feedback && <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{feedback}</p>}

        {!editing ? (
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-gray-500">Tipo</dt>
              <dd>{isHttp ? "Site / URL" : "Supabase"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">URL</dt>
              <dd className="break-all">{project.supabaseUrl}</dd>
            </div>
            {isHttp ? (
              <div>
                <dt className="text-gray-500">Método / status esperado</dt>
                <dd>
                  {project.httpMethod} / {project.expectedStatus ?? "qualquer 2xx/3xx"}
                </dd>
              </div>
            ) : (
              <>
                <div>
                  <dt className="text-gray-500">Tabela de verificação</dt>
                  <dd>{project.healthcheckTable}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Chave</dt>
                  <dd>{project.maskedKey}</dd>
                </div>
              </>
            )}
            <div>
              <dt className="text-gray-500">Intervalo</dt>
              <dd>{intervalOptions.find((i) => i.minutes === project.intervalMinutes)?.label ?? `${project.intervalMinutes} minutos`}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Status</dt>
              <dd>{project.enabled ? "Ativado" : "Desativado"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Próxima execução prevista</dt>
              <dd>
                {project.enabled ? formatDateTime(project.nextRunAt) : "—"}
                <span className="block text-xs text-gray-500">{schedulerNote}</span>
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Última execução</dt>
              <dd>{formatDateTime(project.lastRunAt)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Última consulta com sucesso</dt>
              <dd>{formatDateTime(project.lastSuccessAt)}</dd>
            </div>
          </dl>
        ) : (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
            <div>
              <label className="mb-1 block text-sm font-medium">Nome</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{isHttp ? "URL do site" : "URL do Supabase"}</label>
              <input
                value={form.supabaseUrl}
                onChange={(e) => setForm((f) => ({ ...f, supabaseUrl: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
            {isHttp ? (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium">Método</label>
                <select
                  value={form.httpMethod}
                  onChange={(e) => setForm((f) => ({ ...f, httpMethod: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                >
                  <option value="GET">GET</option>
                  <option value="HEAD">HEAD</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium">Status esperado (opcional)</label>
                <input
                  type="number"
                  min={100}
                  max={599}
                  value={form.expectedStatus}
                  onChange={(e) => setForm((f) => ({ ...f, expectedStatus: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                  placeholder="qualquer 2xx/3xx"
                />
              </div>
            </div>
            ) : (
              <>
            <div>
              <label className="mb-1 block text-sm font-medium">Tabela de verificação</label>
              <input
                value={form.healthcheckTable}
                onChange={(e) => setForm((f) => ({ ...f, healthcheckTable: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Nova chave de API (deixe em branco para manter a atual)
              </label>
              <input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
              </>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium">Intervalo de verificação</label>
              <select
                value={form.intervalMinutes}
                onChange={(e) => setForm((f) => ({ ...f, intervalMinutes: Number(e.target.value) }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                {intervalOptions.map((i) => (
                  <option key={i.minutes} value={i.minutes}>
                    {i.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">{schedulerNote}</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
              />
              Ativado
            </label>
            <button
              onClick={handleSaveEdit}
              disabled={busy}
              className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              Salvar alterações
            </button>
          </div>
        )}

        <h2 className="mb-2 mt-6 text-sm font-semibold">Histórico de execuções (mais recentes)</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-3 py-2">Início</th>
                <th className="px-3 py-2">Origem</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Duração</th>
                <th className="px-3 py-2">Mensagem</th>
              </tr>
            </thead>
            <tbody>
              {executions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
                    Nenhuma execução registrada ainda.
                  </td>
                </tr>
              )}
              {executions.map((exec) => {
                const meta = STATUS_LABELS[exec.status as CheckStatusKey];
                return (
                  <tr key={exec.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-2">{formatDateTime(exec.startedAt)}</td>
                    <td className="px-3 py-2">{exec.triggeredBy === "manual" ? "Manual" : "Agendado"}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded border px-2 py-0.5 text-xs ${meta?.badgeClass ?? ""}`}>
                        {meta?.label ?? exec.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">{exec.durationMs != null ? `${exec.durationMs}ms` : "—"}</td>
                    <td className="px-3 py-2">{exec.message}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
