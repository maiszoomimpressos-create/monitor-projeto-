import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Monitor de Disponibilidade Supabase</h1>
      <p className="max-w-md text-sm text-gray-600 dark:text-gray-400">
        Painel de acompanhamento das checagens periódicas dos seus projetos Supabase.
      </p>
      <Link
        href="/admin"
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
      >
        Acessar painel
      </Link>
    </main>
  );
}
