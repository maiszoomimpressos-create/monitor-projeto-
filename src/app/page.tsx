import Link from "next/link";

// Landing page simples (pouco acessada): apresentação curta + Entrar / Criar conta.
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 p-8 text-center">
      <h1 className="text-3xl font-semibold">Monitor de Disponibilidade Supabase</h1>
      <p className="max-w-md text-sm text-gray-600 dark:text-gray-400">
        Mantenha seus projetos Supabase ativos com consultas leves e periódicas ao banco, e acompanhe o
        resultado de cada verificação.
      </p>
      <div className="flex gap-3">
        <Link
          href="/entrar"
          className="rounded-md bg-black px-5 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
        >
          Entrar
        </Link>
        <Link
          href="/cadastro"
          className="rounded-md border border-gray-300 px-5 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
        >
          Criar conta
        </Link>
      </div>
    </main>
  );
}
