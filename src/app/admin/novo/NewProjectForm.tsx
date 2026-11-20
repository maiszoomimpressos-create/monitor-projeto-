"use client";

import { useState } from "react";
import Link from "next/link";
import SecretInput from "@/components/SecretInput";
import { extractSupabaseProjectRef } from "@/lib/supabaseRef";

type IntervalOption = { minutes: number; label: string };

export default function NewProjectForm({
  intervals,
  schedulerNote,
}: {
  intervals: IntervalOption[];
  schedulerNote: string;
}) {
  const [form, setForm] = useState({
    type: "SUPABASE" as "SUPABASE" | "HTTP",
    name: "",
    accountEmail: "",
    supabaseUrl: "",
    projectRef: "",
    httpMethod: "GET" as "GET" | "HEAD",
    expectedStatus: "",
    apiKey: "",
    intervalMinutes: intervals[0]?.minutes ?? 1440,
    enabled: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          form.type === "HTTP"
            ? {
                type: "HTTP",
                name: form.name,
                accountEmail: form.accountEmail,
                supabaseUrl: form.supabaseUrl,
                httpMethod: form.httpMethod,
                expectedStatus: form.expectedStatus ? Number(form.expectedStatus) : null,
                intervalMinutes: form.intervalMinutes,
                enabled: form.enabled,
              }
            : {
                type: "SUPABASE",
                name: form.name,
                accountEmail: form.accountEmail,
                supabaseUrl: `https://${extractSupabaseProjectRef(form.projectRef)}.supabase.co`,
                apiKey: form.apiKey,
                intervalMinutes: form.intervalMinutes,
                enabled: form.enabled,
              },
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível salvar o projeto.");
        return;
      }
      // Recarregamento completo de propósito: evita o Next reaproveitar a instância
      // do formulário (com os dados já digitados) numa próxima visita a esta página.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/admin";
      return;
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-lg">
        <Link href="/admin" className="text-sm text-gray-500 hover:underline">
          ← Voltar
        </Link>
        <h1 className="mb-4 mt-2 text-xl font-semibold">Cadastrar projeto</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <fieldset>
            <legend className="mb-1 block text-sm font-medium">Tipo</legend>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="type"
                  checked={form.type === "SUPABASE"}
                  onChange={() => setForm((f) => ({ ...f, type: "SUPABASE" }))}
                />
                Supabase (leitura no banco)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="type"
                  checked={form.type === "HTTP"}
                  onChange={() => setForm((f) => ({ ...f, type: "HTTP" }))}
                />
                Site / URL
              </label>
            </div>
          </fieldset>
          <div>
            <label className="mb-1 block text-sm font-medium">Nome do projeto</label>
            <input
              required
              autoComplete="off"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="Ex.: App de produção"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">E-mail da conta</label>
            <input
              type="email"
              maxLength={254}
              autoComplete="off"
              value={form.accountEmail}
              onChange={(e) => setForm((f) => ({ ...f, accountEmail: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="voce@exemplo.com"
            />
            <p className="mt-1 text-xs text-gray-500">E-mail da conta onde este projeto foi criado (opcional)</p>
          </div>

          {form.type === "HTTP" ? (
            <div>
              <label className="mb-1 block text-sm font-medium">URL do site</label>
              <input
                required
                autoComplete="off"
                value={form.supabaseUrl}
                onChange={(e) => setForm((f) => ({ ...f, supabaseUrl: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                placeholder="https://meu-app.onrender.com/"
              />
              <p className="mt-1 text-xs text-gray-500">
                Endereço público com https. Faremos uma leitura leve (sem login, sem enviar dados).
              </p>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium">ID do projeto Supabase</label>
              <input
                required
                autoComplete="off"
                value={form.projectRef}
                onChange={(e) => setForm((f) => ({ ...f, projectRef: e.target.value }))}
                onBlur={(e) => setForm((f) => ({ ...f, projectRef: extractSupabaseProjectRef(e.target.value) }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                placeholder="xxxxxxxxxxxxxxxxxxxx"
              />
              <p className="mt-1 text-xs text-gray-500">
                Só o ID (fica na URL do dashboard do projeto, ou em Project Settings &gt; General). Não precisa
                colar a URL inteira — montamos ela: https://&lt;id&gt;.supabase.co.
              </p>
            </div>
          )}

          {form.type === "HTTP" && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium">Método</label>
                <select
                  value={form.httpMethod}
                  onChange={(e) => setForm((f) => ({ ...f, httpMethod: e.target.value as "GET" | "HEAD" }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                >
                  <option value="GET">GET (recomendado)</option>
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
          )}

          {form.type === "SUPABASE" && (
          <>

          <div>
            <label className="mb-1 block text-sm font-medium">Chave de API (anon/pública)</label>
            <SecretInput
              required
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="eyJhbGciOi..."
            />
            <p className="mt-1 text-xs text-gray-500">
              Use a chave <strong>anon</strong> (pública) do projeto — não use a service_role key.
              Ela é criptografada antes de ser salva e nunca é exibida novamente.
            </p>
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
              {intervals.map((p) => (
                <option key={p.minutes} value={p.minutes}>
                  {p.label}
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
            Ativar verificações para este projeto
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {loading ? "Salvando..." : "Salvar projeto"}
          </button>
        </form>
      </div>
    </main>
  );
}
