"use client";

import { useEffect } from "react";
import { useGame } from "@/lib/store";

export default function Toast() {
  const toast = useGame((s) => s.toast);
  const setToast = useGame((s) => s.setToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast, setToast]);

  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-40 w-[88%] max-w-[420px] -translate-x-1/2">
      <div className="animate-pop rounded-xl border border-white/10 bg-bg-card/95 px-4 py-2.5 text-center text-sm font-medium shadow-lg backdrop-blur">
        {toast}
      </div>
    </div>
  );
}
