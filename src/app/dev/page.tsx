"use client";

// 2D Pokemon-style overworld entry point. The player walks a tile-based town
// and opens each feature's existing menu page as an in-world modal — no
// routing, the world stays mounted underneath.

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { useGame, gameActions } from "@/lib/store";
import { money } from "@/lib/format";
import { canRetire, legacyGain } from "@/lib/game/progression";
import { currentQuest } from "@/components/town2d/quests";
import Dpad from "@/components/town2d/Dpad";
import BuildingModal from "@/components/town2d/BuildingModal";
import type { Dir } from "@/components/town2d/Sprite";
import type { DoorInfo } from "@/components/town2d/map";

// The overworld manipulates the DOM via rAF — load it client-only so SSR
// doesn't try to render the camera loop.
const Overworld = dynamic(() => import("@/components/town2d/Overworld"), { ssr: false });

export default function TownPage() {
  const state = useGame((s) => s.state);
  const run = useGame((s) => s.run);
  const [heldDir, setHeldDir] = useState<Dir | null>(null);
  const [activeDoor, setActiveDoor] = useState<DoorInfo | null>(null);

  const quest = currentQuest(state);
  const retirable = state ? canRetire(state) : false;
  const retireBonus = state ? legacyGain(state.stats.netWorth) : 0;

  return (
    <div className="relative flex h-full flex-col bg-bg">
      {/* Top HUD — cash + net worth + legacy. Mirrors the StatBar that we
          hide for /dev, so the player still sees their core stats. */}
      <div className="flex items-center justify-between border-b border-white/10 bg-black/40 px-3 py-2 text-white">
        <div>
          <div className="text-[9px] uppercase tracking-widest text-white/60">Cash</div>
          <div className="text-base font-extrabold text-accent-2">{money(state?.stats.cash ?? 0)}</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] uppercase tracking-widest text-white/60">Net worth</div>
          <div className="text-sm font-semibold">{money(state?.stats.netWorth ?? 0)}</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-widest text-white/60">Legacy</div>
          <div className="text-sm font-semibold">✨ {state?.progression.legacyPoints ?? 0}</div>
        </div>
      </div>

      {/* Overworld viewport — fixed-size, centered. The viewport is smaller
          than the full map; camera scrolls inside it. */}
      <div className="flex flex-1 items-center justify-center overflow-hidden">
        <Overworld heldDir={heldDir} onEnterDoor={setActiveDoor} />
      </div>

      {/* Bottom row: menu link + quest tracker. */}
      <div className="border-t border-white/10 bg-black/40 px-3 py-2 text-white">
        {quest ? (
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex-1 truncate">
              <span className="text-amber-300">Quest {quest.idx + 1}/10</span>
              <span className="mx-1.5 text-white/40">·</span>
              <span className="font-semibold">{quest.step.icon} {quest.step.hint}</span>
            </div>
            <Link
              href="/"
              className="rounded-md border border-white/20 px-2 py-1 text-[11px] font-semibold active:brightness-90"
            >
              ☰ Menu
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-between text-xs text-white/60">
            <span>🗺️ Explore the town · walk into a door</span>
            <Link
              href="/"
              className="rounded-md border border-white/20 px-2 py-1 text-[11px] font-semibold text-white active:brightness-90"
            >
              ☰ Menu
            </Link>
          </div>
        )}
      </div>

      {/* On-screen D-pad — sits over the bottom-left of the screen. */}
      <Dpad onHeld={setHeldDir} />

      {/* Retire button — appears bottom-right when the player crosses the
          retirement threshold. Confirm before resetting the run. */}
      {retirable && state && (
        <button
          onClick={() => {
            if (confirm(`Retire now for +${retireBonus} Legacy Points? This resets your run.`)) {
              run(gameActions.retire(state));
            }
          }}
          className="fixed bottom-6 right-4 z-30 rounded-xl border border-amber-300/40 bg-amber-300/90 px-3 py-2 text-sm font-extrabold text-amber-950 shadow-xl active:brightness-90"
          style={{ bottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        >
          ✨ Retire +{retireBonus}
        </button>
      )}

      {/* Building modal — sits above everything. Open while a door is set. */}
      {activeDoor && <BuildingModal door={activeDoor} onClose={() => setActiveDoor(null)} />}
    </div>
  );
}
