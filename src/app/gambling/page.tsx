"use client";

import { useState } from "react";
import { Explainer, SectionTitle } from "@/components/ui";
import CoinFlip from "@/components/casino/CoinFlip";
import Dice from "@/components/casino/Dice";
import SlotsHub from "@/components/casino/SlotsHub";
import Roulette from "@/components/casino/Roulette";
import Blackjack from "@/components/casino/Blackjack";
import type { GambleGame } from "@/lib/game/types";

const GAMES: { id: GambleGame; name: string; icon: string }[] = [
  { id: "slots", name: "Slots", icon: "🎰" },
  { id: "roulette", name: "Roulette", icon: "🎡" },
  { id: "blackjack", name: "Blackjack", icon: "🃏" },
  { id: "dice", name: "Dice", icon: "🎲" },
  { id: "coinflip", name: "Coin Flip", icon: "🪙" },
];

export default function GamblingPage() {
  const [game, setGame] = useState<GambleGame | null>(null);

  if (game) {
    const meta = GAMES.find((g) => g.id === game)!;
    return (
      <div className="space-y-3">
        <button onClick={() => setGame(null)} className="text-sm text-muted active:text-white">
          ← Casino
        </button>
        <h1 className="text-xl font-bold">
          {meta.icon} {meta.name}
        </h1>
        {game === "roulette" && <Roulette />}
        {game === "blackjack" && <Blackjack />}
        {game === "slots" && <SlotsHub />}
        {game === "dice" && <Dice />}
        {game === "coinflip" && <CoinFlip />}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SectionTitle sub="Five games. The house always wins. Probably.">Casino</SectionTitle>

      <Explainer
        title="How the casino works"
        steps={[
          { n: "1", icon: "🎮", label: "Pick a game", body: "Slots, roulette, blackjack, dice, or coin flip." },
          { n: "2", icon: "💵", label: "Set wager", body: "Higher bet = bigger swings either way." },
          { n: "3", icon: "🎲", label: "Play", body: "Win or lose; payouts settle to cash instantly." },
        ]}
        rules={[
          "Slots run ~98% RTP — house edge is small but real. Long sessions trend down.",
          "Bigger bets ≠ better odds. Bankroll management matters.",
          "Luck stat from achievements nudges your odds; doesn't break math.",
        ]}
      />

      <div className="grid grid-cols-2 gap-3">
        {GAMES.map((g) => (
          <button
            key={g.id}
            onClick={() => setGame(g.id)}
            className="flex flex-col items-center gap-2 rounded-2xl border border-white/5 bg-gradient-to-b from-white/5 to-transparent p-6 active:scale-[0.98]"
          >
            <span className="text-4xl">{g.icon}</span>
            <span className="text-sm font-semibold">{g.name}</span>
          </button>
        ))}
      </div>
      <p className="px-2 text-center text-[11px] text-muted">
        Tap a game to play. Bets settle to your balance and earn XP win or lose.
      </p>
    </div>
  );
}
