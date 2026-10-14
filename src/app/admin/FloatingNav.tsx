"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function FloatingNav({ userName }: { userName: string }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function handleLogout() {
    setLeaving(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.push("/entrar");
    router.refresh();
  }

  return (
    <nav className="fixed left-1/2 top-4 z-50 flex w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 items-center justify-between rounded-full border border-gray-200 bg-white/80 px-5 py-2 shadow-lg backdrop-blur dark:border-gray-800 dark:bg-gray-950/80">
      <span className="text-sm font-semibold">Monitor Supabase</span>
      <div className="flex items-center gap-3">
        <span className="max-w-[12rem] truncate text-sm text-gray-600 dark:text-gray-400">{userName}</span>
        <button
          onClick={handleLogout}
          disabled={leaving}
          className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-900"
        >
          {leaving ? "Saindo..." : "Sair"}
        </button>
      </div>
    </nav>
  );
}
