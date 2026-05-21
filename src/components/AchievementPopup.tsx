"use client";

import { useEffect } from "react";
import { useGame } from "@/lib/store";
import { TIER_COLOR } from "@/lib/game/achievements";

export default function AchievementPopup() {
  const ach = useGame((s) => s.recentAchievement);
  const dismiss = useGame((s) => s.dismissAchievement);

  useEffect(() => {
    if (!ach) return;
    const t = setTimeout(dismiss, 3500);
    return () => clearTimeout(t);
  }, [ach, dismiss]);

  if (!ach) return null;
  return (
    <div className="pointer-events-none fixed left-1/2 top-20 z-50 w-[88%] max-w-[420px] -translate-x-1/2">
      <div className="animate-pop flex items-center gap-3 rounded-xl border border-accent/40 bg-bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
        <span className="text-3xl">{ach.icon}</span>
        <div className="text-left">
          <div className="text-[10px] uppercase tracking-widest text-muted">
            Achievement · <span className={TIER_COLOR[ach.tier]}>{ach.tier}</span>
          </div>
          <div className="font-bold">{ach.name}</div>
          <div className="text-[11px] text-muted">{ach.description}</div>
        </div>
      </div>
    </div>
  );
}
