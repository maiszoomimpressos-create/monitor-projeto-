"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const isRegister = mode === "register";
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(isRegister ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isRegister ? form : { email: form.email, password: form.password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Não foi possível continuar.");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-3 rounded-lg border border-gray-200 p-6 shadow-sm dark:border-gray-800"
      >
        <h1 className="mb-1 text-lg font-semibold">{isRegister ? "Criar conta" : "Entrar"}</h1>

        {isRegister && (
          <label className="text-sm font-medium">
            Nome
            <input
              required
              autoComplete="name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={`mt-1 ${inputClass}`}
            />
          </label>
        )}

        <label className="text-sm font-medium">
          E-mail
          <input
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className={`mt-1 ${inputClass}`}
          />
        </label>

        <label className="text-sm font-medium">
          Senha
          <input
            type="password"
            required
            minLength={isRegister ? 8 : undefined}
            autoComplete={isRegister ? "new-password" : "current-password"}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className={`mt-1 ${inputClass}`}
          />
          {isRegister && <span className="mt-1 block text-xs text-gray-500">Mínimo de 8 caracteres.</span>}
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 w-full rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {loading ? "Aguarde..." : isRegister ? "Criar conta" : "Entrar"}
        </button>

        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
          {isRegister ? (
            <>Já tem conta? <Link href="/entrar" className="underline">Entrar</Link></>
          ) : (
            <>Não tem conta? <Link href="/cadastro" className="underline">Criar conta</Link></>
          )}
        </p>
      </form>
    </main>
  );
}
