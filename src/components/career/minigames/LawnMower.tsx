"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 11;
type Item = { id: number; lane: number; y: number; rock: boolean; done: boolean };

export default function LawnMower({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [lane, setLane] = useState(1);
  const [items, setItems] = useState<Item[]>([]);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const laneRef = useRef(1);
  const scoreRef = useRef(0);
  const itemsRef = useRef<Item[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    let raf = 0;
    let last = performance.now();
    let spawn = 0;
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      spawn += dt;
      if (spawn > 0.62) {
        spawn = 0;
        itemsRef.current.push({ id: idRef.current++, lane: Math.floor(Math.random() * 3), y: -8, rock: Math.random() < 0.32, done: false });
      }
      for (const it of itemsRef.current) {
        it.y += 52 * dt;
        if (!it.done && it.y >= 88) {
          it.done = true;
          if (it.lane === laneRef.current) {
            if (it.rock) scoreRef.current = Math.max(0, scoreRef.current - 1);
            else scoreRef.current += 1;
            setScore(scoreRef.current);
          }
        }
      }
      itemsRef.current = itemsRef.current.filter((it) => it.y < 112);
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

  function move(d: number) {
    laneRef.current = Math.max(0, Math.min(2, laneRef.current + d));
    setLane(laneRef.current);
  }

  if (!running) {
    return (
      <StartScreen icon="🌱" name="Lawn Mower" blurb="Steer the mower between three lanes. Catch the grass 🌿 for points, dodge the rocks 🪨!" onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Mowed" value={score} right={`${left.toFixed(1)}s`} />
      <div className="relative h-72 w-full overflow-hidden rounded-2xl bg-emerald-900/30">
        {[0, 1, 2].map((l) => (
          <div key={l} className="absolute inset-y-0 border-x border-white/5" style={{ left: `${l * 33.33}%`, width: "33.33%" }} />
        ))}
        {items.map((it) => (
          <div key={it.id} className="absolute flex h-12 w-1/3 items-center justify-center text-2xl" style={{ left: `${it.lane * 33.33}%`, top: `${it.y}%` }}>
            {it.rock ? "🪨" : "🌿"}
          </div>
        ))}
        <div className="absolute bottom-1 flex h-12 w-1/3 items-center justify-center text-3xl" style={{ left: `${lane * 33.33}%` }}>🚜</div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button onPointerDown={() => move(-1)} className="rounded-xl bg-accent py-4 text-lg font-bold text-black active:brightness-90">◀</button>
        <button onPointerDown={() => move(1)} className="rounded-xl bg-accent py-4 text-lg font-bold text-black active:brightness-90">▶</button>
      </div>
    </div>
  );
}
