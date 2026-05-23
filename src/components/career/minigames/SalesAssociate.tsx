"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 14;

function pickHidden() {
  // Customer's "willing" price, snapped to a 5-multiple for clean +/- 5 math.
  return 30 + Math.floor(Math.random() * 9) * 5;
}

export default function SalesAssociate({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [hidden, setHidden] = useState(pickHidden);
  const [price, setPrice] = useState(50);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [judge, setJudge] = useState("");
  const hiddenRef = useRef(hidden);
  const priceRef = useRef(50);
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

  function nudge(d: number) {
    priceRef.current = Math.max(0, Math.min(120, priceRef.current + d));
    setPrice(priceRef.current);
  }
  function deal() {
    const diff = priceRef.current - hiddenRef.current;
    if (Math.abs(diff) === 0) { scoreRef.current += 3; setJudge("Bullseye! +3"); }
    else if (Math.abs(diff) <= 5) { scoreRef.current += 1; setJudge("Deal! +1"); }
    else { setJudge("Walked out…"); }
    setScore(scoreRef.current);
    setTimeout(() => setJudge(""), 380);
    hiddenRef.current = pickHidden();
    priceRef.current = 50;
    setHidden(hiddenRef.current);
    setPrice(50);
  }

  if (!running) {
    return (
      <StartScreen icon="🤝" name="Haggle" blurb="Set the price by tapping +5/-5, watch the customer's hint, then DEAL when you're in range. Exact match pays triple!" onStart={() => setRunning(true)} />
    );
  }

  const diff = price - hidden;
  const hint = Math.abs(diff) <= 5 ? "😊 They're in" : diff > 0 ? "😬 Too high" : "🙂 Too low";

  return (
    <div>
      <ScoreStrip label="Sales" value={score} right={`${left.toFixed(1)}s`} />
      <div className="mb-3 rounded-2xl bg-white/10 p-5 text-center">
        <div className="text-xs text-muted">your offer</div>
        <div className="text-4xl font-black text-accent">${price}</div>
        <div className="mt-2 text-sm">{hint}</div>
        {judge && <div className="mt-1 text-sm font-bold text-accent-2">{judge}</div>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onPointerDown={() => nudge(-5)} className="rounded-xl bg-accent/30 py-4 text-lg font-bold text-accent active:bg-accent/50">-$5</button>
        <button onPointerDown={() => nudge(5)} className="rounded-xl bg-accent/30 py-4 text-lg font-bold text-accent active:bg-accent/50">+$5</button>
      </div>
      <button onPointerDown={deal} className="mt-3 w-full rounded-xl bg-accent py-4 text-sm font-bold text-black active:brightness-90">🤝 DEAL</button>
    </div>
  );
}
