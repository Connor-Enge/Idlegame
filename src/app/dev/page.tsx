"use client";

// 2D Pokemon-style overworld entry point. The player walks a tile-based town
// and opens each feature's existing menu page as an in-world modal — no
// routing, the world stays mounted underneath.

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useGame, gameActions } from "@/lib/store";
import { money } from "@/lib/format";
import { canRetire, legacyGain } from "@/lib/game/progression";
import { currentQuest } from "@/components/town2d/quests";
import Dpad from "@/components/town2d/Dpad";
import BuildingModal from "@/components/town2d/BuildingModal";
import Dialog from "@/components/town2d/Dialog";
import type { Dir } from "@/components/town2d/Sprite";
import type { DoorInfo } from "@/components/town2d/map";
import type { DialogPayload } from "@/components/town2d/Overworld";

// The overworld manipulates the DOM via rAF — load it client-only so SSR
// doesn't try to render the camera loop.
const Overworld = dynamic(() => import("@/components/town2d/Overworld"), { ssr: false });

export default function TownPage() {
  const state = useGame((s) => s.state);
  const run = useGame((s) => s.run);
  const [heldDir, setHeldDir] = useState<Dir | null>(null);
  const [activeDoor, setActiveDoor] = useState<DoorInfo | null>(null);
  const [dialog, setDialog] = useState<DialogPayload | null>(null);

  // Stable references so children memoise effectively — without these, the
  // dialog typewriter restarts on every parent re-render (cash collect,
  // step end, etc.) because lines+onClose are fresh each render.
  const dialogLines = useMemo(
    () => (dialog ? dialog.lines.map((text) => ({ text, who: dialog.who })) : null),
    [dialog],
  );
  const closeDialog = useCallback(() => setDialog(null), []);
  const closeBuilding = useCallback(() => setActiveDoor(null), []);
  const handleDialog = useCallback((p: DialogPayload) => setDialog(p), []);
  const handleEnterDoor = useCallback((d: DoorInfo) => setActiveDoor(d), []);

  const quest = currentQuest(state);
  const retirable = state ? canRetire(state) : false;
  const retireBonus = state ? legacyGain(state.stats.netWorth) : 0;

  return (
    <div className="relative flex h-full flex-col bg-bg">
      {/* Top HUD — three pillared stat readouts on a stylised game banner.
          Mirrors the StatBar that we hide for /dev so the player still
          sees their core stats. */}
      <div
        className="flex items-center justify-between gap-2 px-3 py-2 text-white"
        style={{
          background:
            "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
          borderBottom: "3px solid #0b1220",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 4px rgba(0,0,0,0.4)",
        }}
      >
        <StatPill label="Cash" value={money(state?.stats.cash ?? 0)} accent="#34d399" icon="💵" />
        <StatPill label="Net worth" value={money(state?.stats.netWorth ?? 0)} accent="#fbbf24" icon="📈" />
        <StatPill label="Legacy" value={`${state?.progression.legacyPoints ?? 0}`} accent="#a78bfa" icon="✨" />
      </div>

      {/* Overworld viewport — fixed-size, centered. The viewport is smaller
          than the full map; camera scrolls inside it. */}
      <div className="flex flex-1 items-center justify-center overflow-hidden">
        <Overworld
          heldDir={heldDir}
          onEnterDoor={handleEnterDoor}
          onDialog={handleDialog}
          questTarget={quest?.step.target ?? null}
        />
      </div>

      {/* Bottom quest tracker bar — game-banner style with the menu link
          on the right. */}
      <div
        className="flex items-center gap-2 px-3 py-2 text-white"
        style={{
          background:
            "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
          borderTop: "3px solid #0b1220",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.08), 0 -2px 4px rgba(0,0,0,0.3)",
        }}
      >
        {quest ? (
          <>
            <div
              style={{
                background: "linear-gradient(180deg, #fbbf24 0%, #d97706 100%)",
                color: "#451a03",
                fontSize: 9,
                fontWeight: 900,
                padding: "3px 7px",
                borderRadius: 5,
                border: "1.5px solid #92400e",
                boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.3), 0 1px 0 rgba(0,0,0,0.4)",
                flexShrink: 0,
                letterSpacing: "0.05em",
              }}
            >
              QUEST {quest.idx + 1}/10
            </div>
            <div className="min-w-0 flex-1 truncate text-xs font-semibold">
              {quest.step.icon} {quest.step.hint}
            </div>
          </>
        ) : (
          <div className="flex-1 text-xs text-white/60">🗺️ Explore the town · walk into a door</div>
        )}
        <Link
          href="/"
          className="flex-shrink-0 select-none text-[11px] font-bold text-white active:brightness-90"
          style={{
            background: "linear-gradient(180deg, #475569 0%, #1e293b 100%)",
            border: "1.5px solid #0b1220",
            borderRadius: 5,
            padding: "4px 8px",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 1px 0 rgba(0,0,0,0.4)",
          }}
        >
          ☰ Menu
        </Link>
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
      {activeDoor && <BuildingModal door={activeDoor} onClose={closeBuilding} />}

      {/* Dialog box — sign + NPC text. Lives in front of the world but
          beneath the building modal so entering a building cleanly hides it. */}
      {dialog && dialogLines && (
        <Dialog lines={dialogLines} onClose={closeDialog} />
      )}
    </div>
  );
}

function StatPill({ label, value, accent, icon }: { label: string; value: string; accent: string; icon: string }) {
  return (
    <div
      className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1"
      style={{
        background:
          "linear-gradient(180deg, rgba(15,23,42,0.6) 0%, rgba(2,6,23,0.6) 100%)",
        border: "1.5px solid #0b1220",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.4)",
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          background: `radial-gradient(circle at 35% 35%, ${accent}, ${shadeHex(accent, -40)})`,
          border: "1.5px solid rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.45)",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[9px] font-bold uppercase tracking-widest text-white/55">{label}</div>
        <div
          className="truncate text-sm font-extrabold leading-tight"
          style={{ color: accent, textShadow: "0 1px 0 rgba(0,0,0,0.6)" }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function shadeHex(hex: string, pct: number): string {
  const c = hex.replace("#", "");
  if (c.length < 6) return hex;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const f = pct / 100;
  const adj = (n: number) => Math.max(0, Math.min(255, Math.round(n + (f > 0 ? (255 - n) * f : n * f))));
  return `rgb(${adj(r)}, ${adj(g)}, ${adj(b)})`;
}
