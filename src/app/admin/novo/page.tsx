"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const INTERVAL_PRESETS = [
  { label: "Uma vez por dia (padrão)", minutes: 1440 },
  { label: "A cada 2 dias", minutes: 2880 },
  { label: "A cada 7 dias", minutes: 10080 },
];

export default function NewProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    supabaseUrl: "",
    apiKey: "",
    healthcheckTable: "_uptime_healthcheck",
    intervalMinutes: 1440,
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
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível salvar o projeto.");
        return;
      }
      router.push("/admin");
      router.refresh();
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
        <h1 className="mb-4 mt-2 text-xl font-semibold">Cadastrar projeto Supabase</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Nome do projeto</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="Ex.: App de produção"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">URL do Supabase</label>
            <input
              required
              value={form.supabaseUrl}
              onChange={(e) => setForm((f) => ({ ...f, supabaseUrl: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="https://xxxxxxxx.supabase.co"
            />
            <p className="mt-1 text-xs text-gray-500">
              Deve ser um domínio *.supabase.co / *.supabase.in / *.supabase.net.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Chave de API (anon/pública)</label>
            <input
              required
              type="password"
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

          <div>
            <label className="mb-1 block text-sm font-medium">Tabela de verificação</label>
            <input
              required
              value={form.healthcheckTable}
              onChange={(e) => setForm((f) => ({ ...f, healthcheckTable: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
            <p className="mt-1 text-xs text-gray-500">
              Precisa existir no projeto com RLS liberando apenas SELECT para a chave anon. Veja{" "}
              <code>sql/supabase_healthcheck_migration.sql</code>.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Intervalo de verificação</label>
            <select
              value={form.intervalMinutes}
              onChange={(e) => setForm((f) => ({ ...f, intervalMinutes: Number(e.target.value) }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              {INTERVAL_PRESETS.map((p) => (
                <option key={p.minutes} value={p.minutes}>
                  {p.label}
                </option>
              ))}
            </select>
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
