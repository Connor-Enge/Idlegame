"use client";

// 3D town entry point. Three.js is client-only; this whole route is a single
// client component that mounts the canvas + joystick + a thin HUD over the
// existing game state. The player walks around in an outdoor scene; entering
// the Casino swaps in an interior scene where individual slot machines lead
// to the existing /gambling games. Every other building still routes to its
// menu page so the underlying game systems are reused unchanged.

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { money } from "@/lib/format";
import Joystick from "@/components/town/Joystick";
import type { Spot } from "@/components/town/TownScene";

const TownScene = dynamic(() => import("@/components/town/TownScene"), { ssr: false });

// Game key → /gambling launches the casino games picker. We just route there
// for now; each casino-floor slot machine could later launch its specific
// game directly via query state.
const CASINO_LABELS: Record<string, { icon: string; label: string }> = {
  slots: { icon: "🎰", label: "Slots" },
  roulette: { icon: "🎡", label: "Roulette" },
  blackjack: { icon: "🃏", label: "Blackjack" },
  dice: { icon: "🎲", label: "Dice" },
  coinflip: { icon: "🪙", label: "Coin Flip" },
};

export default function TownPage() {
  const router = useRouter();
  const state = useGame((s) => s.state);
  const joystick = useRef({ x: 0, y: 0 });
  const [mode, setMode] = useState<"town" | "casino">("town");
  const [nearestSpot, setNearestSpot] = useState<Spot | null>(null);
  const [nearestInterior, setNearestInterior] = useState<null | "exit" | string>(null);

  function onEnter(spot: Spot) {
    if (spot.interior === "casino") {
      setMode("casino");
      setNearestSpot(null);
    } else {
      router.push(spot.route);
    }
  }
  function onInterior(target: "exit" | string) {
    if (target === "exit") {
      setMode("town");
      setNearestInterior(null);
    } else {
      // Slot machines route to the existing /gambling page (which has the
      // full game flow). Future work could deep-link to a specific game.
      router.push("/gambling");
    }
  }

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

      {/* Outdoor "Enter" button */}
      {mode === "town" && nearestSpot && (
        <button
          onClick={() => onEnter(nearestSpot)}
          className="fixed bottom-8 right-8 z-30 rounded-2xl bg-accent px-6 py-4 text-base font-bold text-black shadow-xl active:brightness-90"
        >
          ▶ Enter {nearestSpot.emoji} {nearestSpot.label}
        </button>
      )}

      {/* Interior prompt — Exit or specific machine */}
      {mode === "casino" && nearestInterior && (
        <button
          onClick={() => onInterior(nearestInterior)}
          className="fixed bottom-8 right-8 z-30 rounded-2xl bg-accent px-6 py-4 text-base font-bold text-black shadow-xl active:brightness-90"
        >
          {nearestInterior === "exit"
            ? "🚪 Exit casino"
            : (() => {
                const m = CASINO_LABELS[nearestInterior];
                return m ? `▶ Play ${m.icon} ${m.label}` : `▶ Play`;
              })()}
        </button>
      )}

      {/* Help tag */}
      <div className="pointer-events-none fixed bottom-2 left-1/2 z-20 -translate-x-1/2 text-[10px] text-white/60">
        {mode === "casino" ? "🎰 Inside the casino · walk to a machine" : "Walk near a building · WASD or joystick"}
      </div>
    </>
  );
}
