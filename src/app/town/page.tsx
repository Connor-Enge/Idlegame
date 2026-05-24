"use client";

// 3D town entry point. Three.js is client-only; this whole route is a single
// client component that mounts the canvas + joystick + a thin HUD over the
// existing game state. Walking up to a building and tapping "Enter" routes
// you to that feature's existing menu page (which still has its own UI).

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { money } from "@/lib/format";
import Joystick from "@/components/town/Joystick";

// Three.js / R3F SSR breaks (window, requestAnimationFrame, etc.). Lazy-load
// the scene client-only so the route can be navigated to during SSR safely.
const TownScene = dynamic(() => import("@/components/town/TownScene"), { ssr: false });

export default function TownPage() {
  const router = useRouter();
  const state = useGame((s) => s.state);
  const joystick = useRef({ x: 0, y: 0 });

  return (
    <>
      <TownScene
        joystick={joystick}
        onEnter={(route) => router.push(route)}
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

      {/* Help tag (desktop) */}
      <div className="pointer-events-none fixed bottom-2 left-1/2 z-20 -translate-x-1/2 text-[10px] text-white/60">
        Walk near a building · WASD or joystick
      </div>
    </>
  );
}
