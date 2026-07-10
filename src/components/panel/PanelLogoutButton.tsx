"use client";

import { useRouter } from "next/navigation";

export function PanelLogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/panel/logout", { method: "POST" });
        router.push("/panel/login");
        router.refresh();
      }}
      className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-sand-200/70 transition-colors hover:bg-white/5 hover:text-white"
    >
      Wyloguj
    </button>
  );
}
