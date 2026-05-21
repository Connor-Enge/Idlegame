"use client";

import { useState } from "react";
import { useGame } from "@/lib/store";
import { dice, diceMultiplier } from "@/lib/game/gambling";
import { commitGamble } from "@/lib/game/actions";
import { money } from "@/lib/format";
import { Button } from "@/components/ui";
import WagerInput from "./WagerInput";
import type { GambleResult } from "@/lib/game/types";

export default function Dice() {
  const state = useGame((s) => s.state)!;
  const run = useGame((s) => s.run);
  const [wager, setWager] = useState(50);
  const [target, setTarget] = useState(50);
  const [rolling, setRolling] = useState(false);
  const [marker, setMarker] = useState<number | null>(null);
  const [result, setResult] = useState<GambleResult | null>(null);

  const cash = state.stats.cash;
  const mult = diceMultiplier(target);
  const winChance = target;

  function roll() {
    if (rolling || wager <= 0 || wager > cash) return;
    setResult(null);
    setRolling(true);
    const res = dice(wager, state.stats.luck, target);
    // Jitter the marker a few times, then settle on the real roll.
    let ticks = 0;
    const iv = setInterval(() => {
      setMarker(Math.random() * 100);
      if (++ticks >= 8) {
        clearInterval(iv);
        setMarker(res.outcome!.diceRoll!);
        setRolling(false);
        setResult(res);
        run(commitGamble(state, res));
      }
    }, 90);
  }

  return (
    <div className="space-y-4">
      {/* Result readout */}
      <div className="flex items-center justify-center gap-2 py-2">
        <span
          className={`text-4xl font-black tabular-nums ${
            result ? (result.won ? "text-accent-2" : "text-danger") : "text-white"
          }`}
        >
          {marker != null ? marker.toFixed(2) : "00.00"}
        </span>
      </div>

      {/* Track */}
      <div className="relative h-10 select-none">
        <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full">
          <div className="h-full w-full" style={{ background: `linear-gradient(to right, var(--accent-2) ${target}%, var(--danger) ${target}%)` }} />
        </div>
        {/* result marker */}
        {marker != null && (
          <div
            className="absolute top-0 -translate-x-1/2 transition-all duration-100"
            style={{ left: `${marker}%` }}
          >
            <div className="flex flex-col items-center">
              <div className="h-5 w-1 rounded bg-white" />
              <div className="-mt-1 h-2 w-2 rotate-45 bg-white" />
            </div>
          </div>
        )}
        <div className="absolute -bottom-4 left-0 text-[10px] text-muted">0</div>
        <div className="absolute -bottom-4 right-0 text-[10px] text-muted">100</div>
      </div>

      {/* Target slider */}
      <div className="pt-2">
        <div className="mb-1 flex justify-between text-[11px] text-muted">
          <span>Roll under</span>
          <span className="font-bold text-white">{target.toFixed(0)}</span>
        </div>
        <input
          type="range"
          min={2}
          max={98}
          value={target}
          disabled={rolling}
          onChange={(e) => setTarget(Number(e.target.value))}
          className="w-full accent-yellow-400"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 text-center text-sm">
        <div className="rounded-lg bg-white/5 py-2">
          <div className="text-[10px] uppercase text-muted">Multiplier</div>
          <div className="font-bold">{mult.toFixed(2)}×</div>
        </div>
        <div className="rounded-lg bg-white/5 py-2">
          <div className="text-[10px] uppercase text-muted">Win chance</div>
          <div className="font-bold">{winChance.toFixed(0)}%</div>
        </div>
      </div>

      <WagerInput wager={wager} setWager={setWager} cash={cash} disabled={rolling} />

      <div className="text-center text-[11px] text-muted">
        Potential win: <span className="text-accent-2">{money(Math.floor(wager * mult))}</span>
      </div>

      <Button className="w-full" disabled={rolling || wager > cash || wager <= 0} onClick={roll}>
        {rolling ? "Rolling…" : "Roll Dice"}
      </Button>

      {result && !rolling && (
        <div className={`rounded-xl border p-3 text-center ${result.won ? "border-accent-2/50 flash-win" : "border-danger/50"}`}>
          <span className={`text-lg font-bold ${result.won ? "text-accent-2" : "text-danger"}`}>
            {result.won ? `Won ${money(result.payout)}` : `Lost ${money(result.wager)}`}
          </span>
          <div className="text-xs text-muted">{result.detail}</div>
        </div>
      )}
    </div>
  );
}
