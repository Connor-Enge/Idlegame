"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 11;
const CELLS = 16;
const SETS: [string, string][] = [
  ["🟦", "🟪"],
  ["🍎", "🍓"],
  ["⭐", "✨"],
  ["🟢", "🟡"],
  ["🐶", "🐺"],
  ["🍌", "🍋"],
];

function roll() {
  const [base, odd] = SETS[Math.floor(Math.random() * SETS.length)];
  const idx = Math.floor(Math.random() * CELLS);
  return { base, odd, idx };
}

export default function StoreManager({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [round, setRound] = useState(roll);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [wrong, setWrong] = useState(false);
  const roundRef = useRef(round);
  const scoreRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    const iv = setInterval(() => {
      const rem = Math.max(0, DURATION - (Date.now() - start) / 1000);
      setLeft(rem);
      if (rem <= 0) { clearInterval(iv); onFinish(Math.max(1, scoreRef.current)); }
    }, 100);
    return () => clearInterval(iv);
  }, [running, onFinish]);

  function tap(i: number) {
    if (i === roundRef.current.idx) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      const next = roll();
      roundRef.current = next;
      setRound(next);
    } else {
      setWrong(true);
      setTimeout(() => setWrong(false), 180);
    }
  }

  if (!running) {
    return (
      <StartScreen icon="🏪" name="Spot the Anomaly" blurb="One item in the display doesn't match the rest. Find it and tap it — fast!" onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Spotted" value={score} right={`${left.toFixed(1)}s`} />
      <div className={`grid grid-cols-4 gap-2 rounded-2xl bg-white/5 p-2 ${wrong ? "ring-2 ring-danger" : ""}`}>
        {Array.from({ length: CELLS }).map((_, i) => (
          <button key={i} onPointerDown={() => tap(i)} className="flex h-14 items-center justify-center rounded-lg bg-white/5 text-2xl active:bg-white/10">
            {i === round.idx ? round.odd : round.base}
          </button>
        ))}
      </div>
    </div>
  );
}
