"use client";

import { useState } from "react";
import { useGame } from "@/lib/store";
import { coinflip } from "@/lib/game/gambling";
import { commitGamble } from "@/lib/game/actions";
import { money } from "@/lib/format";
import { Button } from "@/components/ui";
import WagerInput from "./WagerInput";
import type { GambleResult } from "@/lib/game/types";

export default function CoinFlip() {
  const state = useGame((s) => s.state)!;
  const run = useGame((s) => s.run);
  const [wager, setWager] = useState(50);
  const [heads, setHeads] = useState(true);
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<GambleResult | null>(null);

  const cash = state.stats.cash;

  function flip() {
    if (spinning || wager <= 0 || wager > cash) return;
    setResult(null);
    setSpinning(true);
    const res = coinflip(wager, state.stats.luck, heads);
    // Land on the correct face: heads = even half-turns, tails = odd.
    const landHeads = res.outcome?.coin === "heads";
    const base = Math.floor(rot / 360) * 360 + 360 * 6; // several full spins
    const target = base + (landHeads ? 0 : 180);
    setRot(target);
    setTimeout(() => {
      setSpinning(false);
      setResult(res);
      run(commitGamble(state, res));
    }, 2500);
  }

  return (
    <div className="space-y-4">
      <div className="coin-scene flex justify-center py-4">
        <div
          className="coin h-32 w-32"
          style={{ transform: `rotateX(${rot}deg)` }}
        >
          <div className="coin-face coin-front bg-accent text-5xl font-black text-black">H</div>
          <div className="coin-back coin-face bg-yellow-600 text-5xl font-black text-black">T</div>
        </div>
      </div>

      <div className="flex gap-2">
        {[
          { v: true, label: "Heads" },
          { v: false, label: "Tails" },
        ].map((o) => (
          <button
            key={o.label}
            disabled={spinning}
            onClick={() => setHeads(o.v)}
            className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition ${
              heads === o.v ? "bg-accent text-black" : "bg-white/5 text-white"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <WagerInput wager={wager} setWager={setWager} cash={cash} disabled={spinning} />

      <Button className="w-full" disabled={spinning || wager > cash || wager <= 0} onClick={flip}>
        {spinning ? "Flipping…" : `Flip for ${money(wager)}`}
      </Button>

      {result && !spinning && (
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
