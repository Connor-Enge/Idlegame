"use client";

// 3D town entry point. Player walks the overworld, steps into 3D interiors,
// plays the lemonade stand minigame outside, and can retire from the HUD
// when their net worth crosses the threshold. Each interior's stations
// still route to the full menu page for everything not yet 3D-native.

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame, gameActions } from "@/lib/store";
import { money } from "@/lib/format";
import { canRetire, legacyGain } from "@/lib/game/progression";
import Joystick from "@/components/town/Joystick";
import type { Spot } from "@/components/town/TownScene";
import { INTERIORS, type StationAction } from "@/components/town/interiors";
import { currentQuest } from "@/components/town/quests";

const TownScene = dynamic(() => import("@/components/town/TownScene"), { ssr: false });

function gambleIcon(kind: StationAction["kind"]): string {
  switch (kind) {
    case "slots": return "🎰";
    case "coinflip": return "🪙";
    case "dice": return "🎲";
    case "roulette": return "🎡";
  }
}

// Direct cash bump used by in-world reward sources (cash pickups, lemonade
// stand). Skips the action layer + toast — these are decorative, not
// gameplay-critical.
function bumpCash(amount: number) {
  if (amount <= 0) return;
  useGame.setState((s) => {
    if (!s.state) return s;
    return {
      state: {
        ...s.state,
        stats: {
          ...s.state.stats,
          cash: s.state.stats.cash + amount,
          netWorth: s.state.stats.netWorth + amount,
        },
      },
    };
  });
}

export default function TownPage() {
  const router = useRouter();
  const state = useGame((s) => s.state);
  const run = useGame((s) => s.run);
  const joystick = useRef({ x: 0, y: 0 });
  const [mode, setMode] = useState<string>("town");
  const [nearestSpot, setNearestSpot] = useState<Spot | null>(null);
  const [nearestInterior, setNearestInterior] = useState<null | "exit" | string>(null);

  // Lemonade-stand control surface — page owns the held state, scene reads it.
  const lemonadePouringRef = useRef(false);
  const [lemonadeNear, setLemonadeNear] = useState(false);
  const [floatNote, setFloatNote] = useState<{ key: number; text: string; tone: "good" | "bad" } | null>(null);

  function showNote(text: string, tone: "good" | "bad" = "good") {
    setFloatNote({ key: Date.now(), text, tone });
  }
  useEffect(() => {
    if (!floatNote) return;
    const t = setTimeout(() => setFloatNote(null), 1500);
    return () => clearTimeout(t);
  }, [floatNote]);

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
    if (!station) return;
    if (station.action && state) {
      fireStationAction(station.action);
      return;
    }
    router.push(station.route);
  }

  // In-world casino spin. Validates wager, fires the gamble action through
  // the store (silent — we render our own floater), and surfaces the result.
  function fireStationAction(action: StationAction) {
    if (!state) return;
    if (state.stats.cash < action.wager) {
      showNote(`Need ${money(action.wager)}`, "bad");
      return;
    }
    let result;
    switch (action.kind) {
      case "slots":
        result = gameActions.gamble(state, "slots", action.wager);
        break;
      case "coinflip":
        result = gameActions.gamble(state, "coinflip", action.wager, { callHeads: action.callHeads });
        break;
      case "dice":
        result = gameActions.gamble(state, "dice", action.wager, { target: action.target });
        break;
      case "roulette":
        result = gameActions.gamble(state, "roulette", action.wager, { bet: { type: action.bet } });
        break;
    }
    run(result, { silent: true });
    const g = result.gamble;
    if (!g) return;
    if (g.won) {
      const profit = g.payout - g.wager;
      showNote(`${gambleIcon(action.kind)} +${money(profit)} (${g.detail})`, "good");
    } else {
      showNote(`${gambleIcon(action.kind)} -${money(g.wager)} (${g.detail})`, "bad");
    }
  }
  function onLemonadePour(cash: number, quality: "perfect" | "good" | "weak" | "spill") {
    if (cash > 0) {
      bumpCash(cash);
      showNote(`${quality === "perfect" ? "🍋 PERFECT" : quality === "good" ? "🍋 Good" : "🍋"} +${money(cash)}`, "good");
    } else {
      showNote("Spilled!", "bad");
    }
  }

  const interior = mode !== "town" ? INTERIORS[mode] : null;
  let promptLabel: string | null = null;
  if (mode === "town" && nearestSpot) {
    promptLabel = `▶ Enter ${nearestSpot.emoji} ${nearestSpot.label}`;
  } else if (interior && nearestInterior) {
    if (nearestInterior === "exit") {
      promptLabel = `🚪 Exit ${interior.title}`;
    } else {
      const st = interior.stations.find((s) => s.id === nearestInterior);
      if (st) {
        promptLabel = st.action
          ? `${st.icon} Play ${money(st.action.wager)}`
          : `▶ ${st.icon} ${st.label}`;
      }
    }
  }

  const quest = currentQuest(state);
  const retirable = state ? canRetire(state) : false;
  const retireBonus = state ? legacyGain(state.stats.netWorth) : 0;

  // Lemonade button takes over the bottom-right slot when in range — the
  // stand sits well clear of any building proximity zone, so the regular
  // Enter prompt is never competing for the same corner.
  const showPourButton = mode === "town" && lemonadeNear;

  return (
    <>
      <TownScene
        mode={mode}
        joystick={joystick}
        onNearestSpot={setNearestSpot}
        onNearestInterior={setNearestInterior}
        lemonadePouringRef={lemonadePouringRef}
        onLemonadeNear={setLemonadeNear}
        onLemonadePour={onLemonadePour}
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

      {/* Top-right menu + retire (when ready) */}
      <div className="fixed right-4 top-4 z-30 flex flex-col items-end gap-2">
        <Link
          href="/"
          className="rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm font-semibold text-white backdrop-blur active:brightness-90"
        >
          ☰ Menu
        </Link>
        {retirable && state && (
          <button
            onClick={() => {
              if (confirm(`Retire now for +${retireBonus} Legacy Points? This resets your run.`)) {
                run(gameActions.retire(state));
              }
            }}
            className="rounded-xl border border-amber-300/40 bg-amber-300/20 px-3 py-2 text-sm font-bold text-amber-100 backdrop-blur active:brightness-90"
          >
            ✨ Retire +{retireBonus}
          </button>
        )}
      </div>

      {/* Quest tracker — top centre. Hidden when the tutorial is complete. */}
      {quest && (
        <div className="pointer-events-none fixed left-1/2 top-4 z-30 -translate-x-1/2 rounded-xl border border-amber-300/40 bg-black/50 px-3 py-2 text-center text-white backdrop-blur">
          <div className="text-[9px] uppercase tracking-widest text-amber-200">Next goal · {quest.idx + 1}/10</div>
          <div className="text-sm font-bold">{quest.step.icon} {quest.step.hint}</div>
        </div>
      )}

      {/* Pour-result floater — short-lived feedback for lemonade stand */}
      {floatNote && (
        <div
          key={floatNote.key}
          className={`pointer-events-none fixed bottom-32 right-8 z-30 rounded-xl px-4 py-2 text-base font-extrabold shadow-xl ${floatNote.tone === "good" ? "bg-emerald-500 text-black" : "bg-rose-500 text-white"}`}
          style={{ animation: "popFade 1.5s ease-out forwards" }}
        >
          {floatNote.text}
        </div>
      )}

      {/* Bottom-right interaction button — varies by context */}
      {showPourButton ? (
        <button
          onPointerDown={() => { lemonadePouringRef.current = true; }}
          onPointerUp={() => { lemonadePouringRef.current = false; }}
          onPointerCancel={() => { lemonadePouringRef.current = false; }}
          onPointerLeave={() => { lemonadePouringRef.current = false; }}
          className="fixed bottom-8 right-8 z-30 select-none rounded-2xl bg-yellow-300 px-6 py-4 text-base font-bold text-yellow-950 shadow-xl active:brightness-90"
          style={{ touchAction: "none" }}
        >
          🍋 Hold to pour
        </button>
      ) : promptLabel ? (
        <button
          onClick={() => {
            if (mode === "town" && nearestSpot) onEnter(nearestSpot);
            else if (nearestInterior) onInterior(nearestInterior);
          }}
          className="fixed bottom-8 right-8 z-30 rounded-2xl bg-accent px-6 py-4 text-base font-bold text-black shadow-xl active:brightness-90"
        >
          {promptLabel}
        </button>
      ) : null}

      {/* Help tag */}
      <div className="pointer-events-none fixed bottom-2 left-1/2 z-20 -translate-x-1/2 text-[10px] text-white/60">
        {interior ? `Inside the ${interior.title} · find an exit or station` : "Walk near a building · WASD or joystick"}
      </div>

      <style jsx>{`
        @keyframes popFade {
          0% { opacity: 0; transform: translateY(8px) scale(0.9); }
          15% { opacity: 1; transform: translateY(0) scale(1); }
          75% { opacity: 1; transform: translateY(-4px) scale(1); }
          100% { opacity: 0; transform: translateY(-30px) scale(0.95); }
        }
      `}</style>
    </>
  );
}
