"use client";

import { useRef, useState } from "react";
import { useGame } from "@/lib/store";
import { slots, SLOT_SYMBOLS } from "@/lib/game/gambling";
import { commitGamble } from "@/lib/game/actions";
import { money } from "@/lib/format";
import { Button } from "@/components/ui";
import WagerInput from "./WagerInput";
import type { GambleResult } from "@/lib/game/types";

const ROW = 64; // px per symbol cell
const REPEAT = 24; // strip length for a long spin

// A deterministic long strip ending on `final`.
function buildStrip(final: string): string[] {
  const strip: string[] = [];
  for (let i = 0; i < REPEAT; i++) {
    strip.push(SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]);
  }
  strip.push(final);
  return strip;
}

function Reel({ strip, spinning, offset }: { strip: string[]; spinning: boolean; offset: number }) {
  return (
    <div className="relative h-16 w-20 overflow-hidden rounded-lg bg-black/40">
      <div
        className={spinning ? "reel-strip" : ""}
        style={{ transform: `translateY(${offset}px)` }}
      >
        {strip.map((s, i) => (
          <div key={i} className="flex h-16 w-20 items-center justify-center text-4xl">
            {s}
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-black/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-black/60 to-transparent" />
    </div>
  );
}

export default function Slots() {
  const state = useGame((s) => s.state)!;
  const run = useGame((s) => s.run);
  const [wager, setWager] = useState(50);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<GambleResult | null>(null);
  const [strips, setStrips] = useState<string[][]>([["🍒"], ["🍋"], ["🔔"]]);
  const [offsets, setOffsets] = useState<number[]>([0, 0, 0]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const cash = state.stats.cash;

  function spin() {
    if (spinning || wager <= 0 || wager > cash) return;
    setResult(null);
    setSpinning(true);
    const res = slots(wager, state.stats.luck);
    const finals = res.outcome!.reels!;
    const newStrips = finals.map(buildStrip);
    setStrips(newStrips);
    // Reset to top, then animate down to the final cell (last in strip).
    setOffsets([0, 0, 0]);
    const finalOffset = -(REPEAT * ROW);
    timers.current.forEach(clearTimeout);
    timers.current = [];
    // Stagger reel stops for effect.
    requestAnimationFrame(() => {
      [0, 1, 2].forEach((i) => {
        const t = setTimeout(() => {
          setOffsets((o) => {
            const n = [...o];
            n[i] = finalOffset;
            return n;
          });
        }, 30 + i * 60);
        timers.current.push(t);
      });
    });
    const done = setTimeout(() => {
      setSpinning(false);
      setResult(res);
      run(commitGamble(state, res));
    }, 1900);
    timers.current.push(done);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-b from-fuchsia-900/30 to-black/40 p-4">
        {[0, 1, 2].map((i) => (
          <Reel key={i} strip={strips[i]} spinning={spinning} offset={offsets[i]} />
        ))}
      </div>

      <div className="rounded-lg bg-white/5 p-2 text-center text-[11px] text-muted">
        Match 3 to win — 7️⃣ pays 60×, 💎 30×, 🔔 14×, 🍋 8×, 🍒 4×. Any pair pays 1.2×.
      </div>

      <WagerInput wager={wager} setWager={setWager} cash={cash} disabled={spinning} />

      <Button className="w-full" disabled={spinning || wager > cash || wager <= 0} onClick={spin}>
        {spinning ? "Spinning…" : `Spin for ${money(wager)}`}
      </Button>

      {result && !spinning && (
        <div className={`rounded-xl border p-3 text-center ${result.won ? "border-accent-2/50 flash-win" : "border-danger/50"}`}>
          <span className={`text-lg font-bold ${result.won ? "text-accent-2" : "text-danger"}`}>
            {result.won ? `Won ${money(result.payout)}` : `No win`}
          </span>
          <div className="text-xs text-muted">{result.detail}</div>
        </div>
      )}
    </div>
  );
}
