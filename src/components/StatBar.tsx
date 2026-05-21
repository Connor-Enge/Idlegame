"use client";

import { useGame } from "@/lib/store";
import { money } from "@/lib/format";
import { macroSummary } from "@/lib/game/economy";

export default function StatBar() {
  const state = useGame((s) => s.state);
  if (!state) return <header className="h-16" />;

  const { stats, economy } = state;
  const energyPct = (stats.energy / stats.maxEnergy) * 100;

  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-bg-elev/95 px-4 pb-2 pt-3 backdrop-blur">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted">Cash</div>
          <div className="text-2xl font-bold text-accent">{money(stats.cash)}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-muted">Net Worth</div>
          <div className="text-lg font-semibold text-accent-2">{money(stats.netWorth)}</div>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted">
        <span className="flex items-center gap-1">
          ⚡
          <span className="inline-block h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
            <span
              className="block h-full bg-accent-2 transition-all"
              style={{ width: `${energyPct}%` }}
            />
          </span>
        </span>
        <span>🏅 {Math.floor(stats.reputation)}</span>
        <span>🍀 {stats.luck.toFixed(0)}</span>
      </div>

      <div className="mt-1 truncate text-[10px] text-muted/80">{macroSummary(economy)}</div>
    </header>
  );
}
