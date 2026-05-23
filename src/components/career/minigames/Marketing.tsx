"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 12;
const SLOTS = 4;
const ICONS = ["📣", "🎬", "📺", "📱", "📰", "📧"];

function newRound() {
  const ctrs = Array.from({ length: SLOTS }, () => +(0.5 + Math.random() * 9.5).toFixed(1));
  const icons = Array.from({ length: SLOTS }, () => ICONS[Math.floor(Math.random() * ICONS.length)]);
  return { ctrs, icons };
}

export default function Marketing({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [round, setRound] = useState(newRound);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [flash, setFlash] = useState<"" | "good" | "bad">("");
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

  function pick(i: number) {
    const max = Math.max(...roundRef.current.ctrs);
    if (roundRef.current.ctrs[i] === max) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      setFlash("good");
    } else setFlash("bad");
    setTimeout(() => {
      setFlash("");
      roundRef.current = newRound();
      setRound(roundRef.current);
    }, 180);
  }

  if (!running) {
    return (
      <StartScreen icon="📣" name="A/B Test" blurb="Four ad variants, four different click-through rates. Pick the highest as fast as you can." onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Boosted" value={score} right={`${left.toFixed(1)}s`} />
      <div className={`grid grid-cols-2 gap-3 ${flash === "good" ? "ring-2 ring-accent-2 rounded-2xl" : flash === "bad" ? "ring-2 ring-danger rounded-2xl" : ""}`}>
        {round.ctrs.map((c, i) => (
          <button key={i} onPointerDown={() => pick(i)} className="flex flex-col items-center gap-1 rounded-2xl bg-white/5 p-4 active:bg-white/10">
            <span className="text-3xl">{round.icons[i]}</span>
            <span className="text-2xl font-black text-accent-2">{c}%</span>
            <span className="text-[10px] uppercase text-muted">CTR</span>
          </button>
        ))}
      </div>
    </div>
  );
}
