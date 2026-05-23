"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 13;
const READY_LOW = 55;
const READY_HIGH = 82;

type Pan = { bar: number; rate: number };

export default function LineCook({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [pans, setPans] = useState<Pan[]>([
    { bar: 0, rate: 24 },
    { bar: 10, rate: 28 },
    { bar: 20, rate: 32 },
  ]);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [flash, setFlash] = useState<number | null>(null);
  const pansRef = useRef<Pan[]>(pans);
  const scoreRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const start = Date.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      pansRef.current = pansRef.current.map((p) => {
        let nb = p.bar + p.rate * dt;
        if (nb >= 100) nb = 0; // burnt -> reset
        return { ...p, bar: nb };
      });
      setPans([...pansRef.current]);
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

  function serve(i: number) {
    const p = pansRef.current[i];
    if (p.bar >= READY_LOW && p.bar <= READY_HIGH) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      setFlash(i);
      setTimeout(() => setFlash(null), 220);
    }
    pansRef.current[i] = { ...p, bar: 0 };
    setPans([...pansRef.current]);
  }

  if (!running) {
    return (
      <StartScreen icon="🍳" name="Line Cook" blurb="Three pans cooking at once. Tap each pan when its bar is in the green zone — wait too long and it burns!" onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Plated" value={score} right={`${left.toFixed(1)}s`} />
      <div className="grid grid-cols-3 gap-3">
        {pans.map((p, i) => {
          const ready = p.bar >= READY_LOW && p.bar <= READY_HIGH;
          return (
            <button key={i} onPointerDown={() => serve(i)} className={`flex flex-col items-center gap-2 rounded-2xl p-3 active:brightness-110 ${flash === i ? "bg-accent-2/40" : ready ? "bg-emerald-400/20" : "bg-white/5"}`}>
              <span className="text-4xl">🍳</span>
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-white/10">
                <div className="absolute inset-y-0 bg-emerald-400/30" style={{ left: `${READY_LOW}%`, width: `${READY_HIGH - READY_LOW}%` }} />
                <div className="absolute inset-y-0 left-0 bg-amber-400" style={{ width: `${p.bar}%` }} />
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-center text-xs text-muted">Plate when the bar is in the green</p>
    </div>
  );
}
