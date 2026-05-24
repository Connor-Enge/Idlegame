"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { DoorInfo } from "./map";

// The feature pages are imported lazily so the overworld bundle stays small.
// They're plain React components — Next page exports are just default-exported
// functions, so we can render them inside our modal without any routing.
const PAGES: Record<string, ComponentType> = {
  "/jobs": dynamic(() => import("@/app/jobs/page"), { ssr: false }),
  "/business": dynamic(() => import("@/app/business/page"), { ssr: false }),
  "/invest": dynamic(() => import("@/app/invest/page"), { ssr: false }),
  "/realestate": dynamic(() => import("@/app/realestate/page"), { ssr: false }),
  "/gambling": dynamic(() => import("@/app/gambling/page"), { ssr: false }),
  "/economy": dynamic(() => import("@/app/economy/page"), { ssr: false }),
  "/goals": dynamic(() => import("@/app/goals/page"), { ssr: false }),
  "/leaderboard": dynamic(() => import("@/app/leaderboard/page"), { ssr: false }),
};

export default function BuildingModal({
  door,
  onClose,
}: {
  door: DoorInfo;
  onClose: () => void;
}) {
  // Esc closes; matches desktop muscle memory and harms nothing on mobile.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const Page = PAGES[door.route];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-bg"
      style={{ animation: "slideUp 200ms ease-out" }}
    >
      {/* Header — building identity + exit affordance */}
      <div
        className="flex items-center justify-between border-b border-white/10 px-3 py-2"
        style={{ background: door.color }}
      >
        <div className="flex items-center gap-2 text-black/90">
          <span className="text-2xl drop-shadow">{door.icon}</span>
          <div>
            <div className="text-xs uppercase tracking-widest opacity-70">Now entering</div>
            <div className="text-base font-bold">{door.label}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg border border-black/20 bg-black/15 px-3 py-1.5 text-sm font-semibold text-black active:brightness-90"
        >
          🚪 Leave
        </button>
      </div>

      {/* Scrollable feature body — same padding as MobileShell's main element
          so the imported pages look identical to their standalone view. */}
      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-12 pt-3">
        {Page ? <Page /> : <div className="text-sm text-muted">Building under construction…</div>}
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(8%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
