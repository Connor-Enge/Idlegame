"use client";

import { useState } from "react";
import { useGame, gameActions } from "@/lib/store";
import { money } from "@/lib/format";
import { Button, Card, SectionTitle } from "@/components/ui";
import type { GambleGame } from "@/lib/game/types";

const GAMES: { id: GambleGame; name: string; icon: string; blurb: string }[] = [
  { id: "coinflip", name: "Coin Flip", icon: "🪙", blurb: "Double or nothing" },
  { id: "dice", name: "Dice", icon: "🎲", blurb: "Roll under the line" },
  { id: "slots", name: "Slots", icon: "🎰", blurb: "Match the reels" },
  { id: "roulette", name: "Roulette", icon: "🔴", blurb: "Red, black or a number" },
];

export default function GamblingPage() {
  const state = useGame((s) => s.state);
  const run = useGame((s) => s.run);
  const last = useGame((s) => s.lastGamble);
  const [game, setGame] = useState<GambleGame>("coinflip");
  const [wager, setWager] = useState(50);
  const [callHeads, setCallHeads] = useState(true);
  const [diceTarget, setDiceTarget] = useState(7);
  const [rouletteBet, setRouletteBet] = useState<"red" | "black">("red");

  if (!state) return null;
  const cash = state.stats.cash;

  function bet() {
    if (!state) return;
    const opts: Record<string, unknown> = {};
    if (game === "coinflip") opts.callHeads = callHeads;
    if (game === "dice") opts.target = diceTarget;
    if (game === "roulette") opts.bet = { type: rouletteBet };
    run(gameActions.gamble(state, game, wager, opts));
  }

  const quick = [10, 50, 100, 500];

  return (
    <div className="space-y-3">
      <SectionTitle sub="The house always wins. Probably.">Casino</SectionTitle>

      <div className="grid grid-cols-2 gap-2">
        {GAMES.map((g) => (
          <button
            key={g.id}
            onClick={() => setGame(g.id)}
            className={`flex items-center gap-2 rounded-xl border p-3 text-left transition ${
              game === g.id ? "border-accent bg-accent/10" : "border-white/5 bg-bg-card"
            }`}
          >
            <span className="text-2xl">{g.icon}</span>
            <span>
              <span className="block text-sm font-semibold">{g.name}</span>
              <span className="block text-[11px] text-muted">{g.blurb}</span>
            </span>
          </button>
        ))}
      </div>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">Wager</span>
          <span className="text-sm text-muted">Cash {money(cash)}</span>
        </div>
        <input
          type="number"
          value={wager}
          min={1}
          onChange={(e) => setWager(Math.max(1, Number(e.target.value) || 0))}
          className="w-full rounded-lg bg-white/5 px-3 py-2 text-lg font-bold outline-none"
        />
        <div className="mt-2 flex gap-2">
          {quick.map((q) => (
            <button
              key={q}
              onClick={() => setWager(q)}
              className="flex-1 rounded-lg bg-white/5 py-1.5 text-xs font-semibold active:bg-white/10"
            >
              {money(q)}
            </button>
          ))}
          <button
            onClick={() => setWager(Math.floor(cash))}
            className="flex-1 rounded-lg bg-white/5 py-1.5 text-xs font-semibold active:bg-white/10"
          >
            Max
          </button>
        </div>

        {game === "coinflip" && (
          <Choice
            options={[
              { v: true, label: "Heads" },
              { v: false, label: "Tails" },
            ]}
            value={callHeads}
            onChange={setCallHeads}
          />
        )}
        {game === "dice" && (
          <div className="mt-3">
            <div className="mb-1 text-xs text-muted">Roll under: {diceTarget}</div>
            <input
              type="range"
              min={3}
              max={12}
              value={diceTarget}
              onChange={(e) => setDiceTarget(Number(e.target.value))}
              className="w-full accent-yellow-400"
            />
          </div>
        )}
        {game === "roulette" && (
          <Choice
            options={[
              { v: "red" as const, label: "🔴 Red" },
              { v: "black" as const, label: "⚫ Black" },
            ]}
            value={rouletteBet}
            onChange={setRouletteBet}
          />
        )}

        <Button onClick={bet} disabled={wager > cash || wager <= 0} className="mt-4 w-full">
          Bet {money(wager)}
        </Button>
      </Card>

      {last && (
        <Card className={last.won ? "border-accent-2/40" : "border-danger/40"}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{last.won ? "You won!" : "You lost"}</span>
            <span className={`text-lg font-bold ${last.won ? "text-accent-2" : "text-danger"}`}>
              {last.net >= 0 ? "+" : ""}
              {money(last.net)}
            </span>
          </div>
          <div className="mt-1 text-xs text-muted">{last.detail}</div>
        </Card>
      )}
    </div>
  );
}

function Choice<T>({
  options,
  value,
  onChange,
}: {
  options: { v: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="mt-3 flex gap-2">
      {options.map((o) => (
        <button
          key={String(o.v)}
          onClick={() => onChange(o.v)}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
            value === o.v ? "bg-accent text-black" : "bg-white/5 text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
