"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 13;
const SLOTS = 4;

type Cust = { hunger: number; rate: number };

export default function PizzaDelivery({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [custs, setCusts] = useState<Cust[]>(() => Array.from({ length: SLOTS }, () => ({ hunger: Math.random() * 30, rate: 9 + Math.random() * 8 })));
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const cRef = useRef<Cust[]>(custs);
  const scoreRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      cRef.current = cRef.current.map((c) => {
        const nh = c.hunger + c.rate * dt;
        // If hunger reaches 100 they leave — replace with a new patron.
        if (nh >= 100) return { hunger: 0, rate: 9 + Math.random() * 8 };
        return { ...c, hunger: nh };
      });
      setCusts([...cRef.current]);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const ticker = setInterval(() => {
      const rem = Math.max(0, DURATION - (Date.now() - start) / 1000);
      setLeft(rem);
      if (rem <= 0) { clearInterval(ticker); cancelAnimationFrame(raf); onFinish(Math.max(1, scoreRef.current)); }
    }, 100);
    return () => { cancelAnimationFrame(raf); clearInterval(ticker); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function deliver(i: number) {
    const hungriest = cRef.current.reduce((best, c, idx) => (c.hunger > cRef.current[best].hunger ? idx : best), 0);
    const bonus = i === hungriest ? 2 : 1;
    scoreRef.current += bonus;
    setScore(scoreRef.current);
    cRef.current[i] = { hunger: 0, rate: 9 + Math.random() * 8 };
    setCusts([...cRef.current]);
  }

  if (!running) {
    return (
      <StartScreen icon="🍕" name="Pizza Delivery" blurb="Four customers, four hunger bars. Deliver to the hungriest first for a 2× bonus." onStart={() => setRunning(true)} />
    );
  }

  const hungriest = custs.reduce((best, c, idx) => (c.hunger > custs[best].hunger ? idx : best), 0);

  return (
    <div>
      <ScoreStrip label="Tips" value={score} right={`${left.toFixed(1)}s`} />
      <div className="grid grid-cols-2 gap-3">
        {custs.map((c, i) => (
          <button key={i} onPointerDown={() => deliver(i)} className={`flex flex-col items-center gap-2 rounded-2xl p-3 active:brightness-110 ${i === hungriest ? "bg-amber-300/30" : "bg-white/5"}`}>
            <span className="text-4xl">{c.hunger > 70 ? "😖" : c.hunger > 35 ? "🙂" : "😋"}</span>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div className={`h-full ${c.hunger > 75 ? "bg-danger" : "bg-accent-2"}`} style={{ width: `${c.hunger}%` }} />
            </div>
            {i === hungriest && <span className="text-[10px] font-bold text-amber-300">PRIORITY ×2</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
