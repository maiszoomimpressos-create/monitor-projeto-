import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/requireAdmin";
import FloatingNav from "./FloatingNav";

// Página inicial após o login: apenas a barra flutuante e o botão "Novo projeto".
// (A listagem de projetos — Dashboard.tsx — fica disponível para uma etapa futura.)
export const instant = false;

export default async function AdminPage() {
  const session = await getSession();
  if (!session) {
    redirect("/entrar");
  }

  return (
    <>
      <FloatingNav userName={session.name} />
      <main className="flex min-h-screen items-center justify-center p-8">
        <Link
          href="/admin/novo"
          className="rounded-md bg-black px-6 py-3 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
        >
          + Novo projeto
        </Link>
      </main>
    </>
  );
}
