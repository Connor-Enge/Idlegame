"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 11;
const SHELVES = [
  { id: 0, color: "bg-rose-400", label: "🍎" },
  { id: 1, color: "bg-sky-400", label: "🧊" },
  { id: 2, color: "bg-emerald-400", label: "🥬" },
];

export default function StockClerk({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [queue, setQueue] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [wrong, setWrong] = useState(false);
  const queueRef = useRef<number[]>([]);
  const scoreRef = useRef(0);

  function refill() {
    while (queueRef.current.length < 4) queueRef.current.push(Math.floor(Math.random() * SHELVES.length));
    setQueue([...queueRef.current]);
  }

  useEffect(() => {
    if (!running) return;
    refill();
    const start = Date.now();
    const iv = setInterval(() => {
      const rem = Math.max(0, DURATION - (Date.now() - start) / 1000);
      setLeft(rem);
      if (rem <= 0) { clearInterval(iv); onFinish(Math.max(1, scoreRef.current)); }
    }, 100);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function place(shelf: number) {
    if (queueRef.current[0] === shelf) {
      queueRef.current.shift();
      scoreRef.current += 1;
      setScore(scoreRef.current);
      refill();
    } else {
      setWrong(true);
      setTimeout(() => setWrong(false), 200);
    }
  }

  if (!running) {
    return (
      <StartScreen icon="📦" name="Stock Clerk" blurb="Each item belongs on a matching shelf. Tap the shelf that matches the next item in line." onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Stocked" value={score} right={`${left.toFixed(1)}s`} />
      <div className="grid grid-cols-3 gap-3">
        {SHELVES.map((s) => (
          <button key={s.id} onPointerDown={() => place(s.id)} className={`h-20 rounded-xl text-3xl active:brightness-110 ${s.color} ${wrong ? "ring-2 ring-danger" : ""}`}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/5 p-3">
        <span className="text-[10px] uppercase text-muted">Next:</span>
        {queue.map((id, i) => (
          <span key={i} className={`text-2xl ${i === 0 ? "scale-125" : "opacity-50"}`}>{SHELVES[id].label}</span>
        ))}
      </div>
    </div>
  );
}
