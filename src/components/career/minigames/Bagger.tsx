"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 12;
const BINS = [
  { id: "cold", label: "❄️", color: "bg-sky-400" },
  { id: "fragile", label: "🥚", color: "bg-amber-300" },
  { id: "sturdy", label: "🥫", color: "bg-stone-400" },
];
const TYPES = [
  { type: "cold", icon: "🍦" },
  { type: "cold", icon: "🥶" },
  { type: "fragile", icon: "🍞" },
  { type: "fragile", icon: "🍓" },
  { type: "sturdy", icon: "🥫" },
  { type: "sturdy", icon: "🧴" },
];

type Item = { id: number; type: string; icon: string; x: number };

export default function Bagger({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [wrong, setWrong] = useState(false);
  const itemsRef = useRef<Item[]>([]);
  const scoreRef = useRef(0);
  const idRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    let spawn = 0;
    const start = Date.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      spawn += dt;
      if (spawn > 0.85) {
        spawn = 0;
        const t = TYPES[Math.floor(Math.random() * TYPES.length)];
        itemsRef.current.push({ id: idRef.current++, type: t.type, icon: t.icon, x: -8 });
      }
      for (const it of itemsRef.current) it.x += 22 * dt;
      itemsRef.current = itemsRef.current.filter((it) => it.x < 100);
      setItems([...itemsRef.current]);
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

  function place(binId: string) {
    // Sort the right-most item still on the conveyor.
    const candidates = itemsRef.current.filter((it) => it.x < 95);
    if (!candidates.length) return;
    const it = candidates[candidates.length - 1];
    if (it.type === binId) {
      itemsRef.current = itemsRef.current.filter((x) => x.id !== it.id);
      scoreRef.current += 1;
      setScore(scoreRef.current);
      setItems([...itemsRef.current]);
    } else {
      setWrong(true);
      setTimeout(() => setWrong(false), 180);
    }
  }

  if (!running) {
    return (
      <StartScreen icon="🛍️" name="Bagger" blurb="Items roll down the conveyor. Tap the matching bag (cold, fragile, or sturdy) before each item slides off." onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Bagged" value={score} right={`${left.toFixed(1)}s`} />
      <div className={`relative mb-4 h-20 w-full overflow-hidden rounded-2xl bg-amber-900/30 ${wrong ? "ring-2 ring-danger" : ""}`}>
        {items.map((it) => (
          <div key={it.id} className="absolute top-1/2 -translate-y-1/2 text-3xl" style={{ left: `${it.x}%` }}>{it.icon}</div>
        ))}
        <div className="absolute inset-y-0 right-0 w-2 bg-white/30" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {BINS.map((b) => (
          <button key={b.id} onPointerDown={() => place(b.id)} className={`h-20 rounded-xl text-3xl active:brightness-110 ${b.color}`}>
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
