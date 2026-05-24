"use client";

// 3D town entry point. The whole route is one client component that mounts
// the canvas + joystick + a thin HUD over the existing game state. Each
// building can declare an "interior" id — if set, tapping Enter swaps the
// scene to that interior; if not, the player is routed to the building's
// menu page. Interior stations route to their feature page.

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { money } from "@/lib/format";
import Joystick from "@/components/town/Joystick";
import type { Spot } from "@/components/town/TownScene";
import { INTERIORS } from "@/components/town/interiors";
import { currentQuest } from "@/components/town/quests";

const TownScene = dynamic(() => import("@/components/town/TownScene"), { ssr: false });

export default function TownPage() {
  const router = useRouter();
  const state = useGame((s) => s.state);
  const joystick = useRef({ x: 0, y: 0 });
  const [mode, setMode] = useState<string>("town");
  const [nearestSpot, setNearestSpot] = useState<Spot | null>(null);
  const [nearestInterior, setNearestInterior] = useState<null | "exit" | string>(null);

  function onEnter(spot: Spot) {
    if (spot.interior && INTERIORS[spot.interior]) {
      setMode(spot.interior);
      setNearestSpot(null);
    } else {
      router.push(spot.route);
    }
  }
  function onInterior(target: "exit" | string) {
    if (target === "exit") {
      setMode("town");
      setNearestInterior(null);
      return;
    }
    const interior = INTERIORS[mode];
    const station = interior?.stations.find((s) => s.id === target);
    if (station) router.push(station.route);
  }

  // Look up the live station/spot label for the prompt button copy.
  const interior = mode !== "town" ? INTERIORS[mode] : null;
  let promptLabel: string | null = null;
  if (mode === "town" && nearestSpot) {
    promptLabel = `▶ Enter ${nearestSpot.emoji} ${nearestSpot.label}`;
  } else if (interior && nearestInterior) {
    if (nearestInterior === "exit") {
      promptLabel = `🚪 Exit ${interior.title}`;
    } else {
      const st = interior.stations.find((s) => s.id === nearestInterior);
      if (st) promptLabel = `▶ ${st.icon} ${st.label}`;
    }
  }

  const quest = currentQuest(state);

  return (
    <>
      <TownScene
        mode={mode}
        joystick={joystick}
        onNearestSpot={setNearestSpot}
        onNearestInterior={setNearestInterior}
      />

      <Joystick onMove={(v) => { joystick.current = v; }} />

      {/* Top-left HUD */}
      <div className="fixed left-4 top-4 z-30 rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-white backdrop-blur">
        <div className="text-[10px] uppercase tracking-widest text-white/60">Cash</div>
        <div className="text-xl font-extrabold text-accent-2">{money(state?.stats.cash ?? 0)}</div>
        <div className="mt-0.5 text-[10px] text-white/60">
          NW {money(state?.stats.netWorth ?? 0)} · ✨ {state?.progression.legacyPoints ?? 0}
        </div>
      </div>

      {/* Top-right exit */}
      <Link
        href="/"
        className="fixed right-4 top-4 z-30 rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm font-semibold text-white backdrop-blur active:brightness-90"
      >
        ☰ Menu
      </Link>

      {/* Quest tracker — top centre. Hidden when the tutorial is complete. */}
      {quest && (
        <div className="pointer-events-none fixed left-1/2 top-4 z-30 -translate-x-1/2 rounded-xl border border-amber-300/40 bg-black/50 px-3 py-2 text-center text-white backdrop-blur">
          <div className="text-[9px] uppercase tracking-widest text-amber-200">Next goal · {quest.idx + 1}/10</div>
          <div className="text-sm font-bold">{quest.step.icon} {quest.step.hint}</div>
        </div>
      )}

      {/* Single interaction prompt — covers both outdoor and interior cases */}
      {promptLabel && (
        <button
          onClick={() => {
            if (mode === "town" && nearestSpot) onEnter(nearestSpot);
            else if (nearestInterior) onInterior(nearestInterior);
          }}
          className="fixed bottom-8 right-8 z-30 rounded-2xl bg-accent px-6 py-4 text-base font-bold text-black shadow-xl active:brightness-90"
        >
          {promptLabel}
        </button>
      )}

      {/* Help tag */}
      <div className="pointer-events-none fixed bottom-2 left-1/2 z-20 -translate-x-1/2 text-[10px] text-white/60">
        {interior ? `Inside the ${interior.title} · find an exit or station` : "Walk near a building · WASD or joystick"}
      </div>
    </>
  );
}
