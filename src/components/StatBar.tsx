"use client";

import Link from "next/link";
import { useGame } from "@/lib/store";
import { money } from "@/lib/format";
import { macroSummary } from "@/lib/game/economy";
import { currentAge, xpToNext } from "@/lib/game/progression";

export default function StatBar() {
  const state = useGame((s) => s.state);
  const account = useGame((s) => s.account);
  if (!state) return <header className="h-16" />;

  const { stats, economy, progression, life } = state;
  const energyPct = (stats.energy / stats.maxEnergy) * 100;
  const xpPct = (progression.xp / xpToNext(progression.level)) * 100;
  const age = Math.floor(currentAge(life));
  const lifePct = ((currentAge(life) - life.startAge) / (life.deathAge - life.startAge)) * 100;

  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-bg-elev/95 px-4 pb-2 pt-3 backdrop-blur">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted">Cash</div>
          <div className="text-2xl font-bold text-accent">{money(stats.cash)}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted">Net Worth</div>
            <div className="text-lg font-semibold text-accent-2">{money(stats.netWorth)}</div>
          </div>
          <Link
            href="/account"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-base active:bg-white/20"
            title={account ? account.email : "Sign in"}
          >
            {account ? "👤" : "🔓"}
          </Link>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
        <span className="font-bold text-white">Lv {progression.level}</span>
        <span className="inline-block h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
          <span className="block h-full bg-accent transition-all" style={{ width: `${xpPct}%` }} />
        </span>
        {progression.legacyPoints > 0 && <span title="Legacy Points">✨{progression.legacyPoints}</span>}
      </div>

      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted">
        <span className="flex items-center gap-1">
          ⚡
          <span className="inline-block h-1.5 w-14 overflow-hidden rounded-full bg-white/10">
            <span
              className="block h-full bg-accent-2 transition-all"
              style={{ width: `${energyPct}%` }}
            />
          </span>
        </span>
        <span>🏅 {Math.floor(stats.reputation)}</span>
        <span>🍀 {stats.luck.toFixed(0)}</span>
        <span
          className="flex items-center gap-1"
          title={`Age ${age} · Gen ${life.generation} · dies at ${life.deathAge}`}
        >
          🎂
          <span className="inline-block h-1.5 w-10 overflow-hidden rounded-full bg-white/10">
            <span
              className="block h-full bg-accent transition-all"
              style={{ width: `${Math.min(100, lifePct)}%` }}
            />
          </span>
          {age}
        </span>
        {progression.studyingId && (
          <span className="text-accent">📚 {progression.studyTicksRemaining}s</span>
        )}
      </div>

      <div className="mt-1 truncate text-[10px] text-muted/80">{macroSummary(economy)}</div>
    </header>
  );
}
