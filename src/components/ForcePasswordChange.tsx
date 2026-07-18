"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Twarde wymuszenie zmiany hasła startowego: dopóki mustChangePassword,
 * każda strona panelu poza stroną zmiany hasła jest przykryta i przekierowuje.
 * (Renderowany warunkowo w layoutach /admin i /panel.)
 */
export function ForcePasswordChange({ passwordPath }: { passwordPath: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const onPasswordPage = pathname === passwordPath;

  useEffect(() => {
    if (!onPasswordPage) router.replace(passwordPath);
  }, [onPasswordPage, passwordPath, router]);

  if (onPasswordPage) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50/95">
      <p className="text-sm font-semibold text-ink-soft">
        Ustaw własne hasło, żeby korzystać z panelu — przekierowuję…
      </p>
    </div>
  );
}
