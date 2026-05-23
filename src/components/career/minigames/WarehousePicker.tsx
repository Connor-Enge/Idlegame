"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 13;
const ICONS = ["🍎", "🍌", "🍩", "🥐", "🧀", "🥓", "🥚", "🥦"];

function pickOrder(): number[] {
  const idxs = ICONS.map((_, i) => i);
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
  }
  return idxs.slice(0, 3);
}

export default function WarehousePicker({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [order, setOrder] = useState<number[]>(pickOrder);
  const [picked, setPicked] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [wrong, setWrong] = useState(false);
  const orderRef = useRef(order);
  const pickedRef = useRef<number[]>([]);
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
    if (!orderRef.current.includes(i) || pickedRef.current.includes(i)) {
      setWrong(true);
      setTimeout(() => setWrong(false), 180);
      return;
    }
    pickedRef.current = [...pickedRef.current, i];
    setPicked(pickedRef.current);
    if (pickedRef.current.length >= orderRef.current.length) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      orderRef.current = pickOrder();
      pickedRef.current = [];
      setOrder(orderRef.current);
      setPicked([]);
    }
  }

  if (!running) {
    return (
      <StartScreen icon="🏭" name="Warehouse Picker" blurb="Grab every item on the pick list — any order. Don't grab anything not on the list!" onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Orders" value={score} right={`${left.toFixed(1)}s`} />
      <div className={`mb-4 flex items-center justify-center gap-3 rounded-2xl bg-white/10 py-4 ${wrong ? "ring-2 ring-danger" : ""}`}>
        <span className="text-[10px] uppercase text-muted">Pick:</span>
        {order.map((i) => (
          <span key={i} className={`text-3xl ${picked.includes(i) ? "opacity-30" : ""}`}>{ICONS[i]}</span>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {ICONS.map((icon, i) => (
          <button key={i} onPointerDown={() => pick(i)} className={`rounded-xl py-5 text-2xl active:brightness-110 ${picked.includes(i) ? "bg-accent-2/30" : "bg-white/5"}`}>
            {icon}
          </button>
        ))}
      </div>
    </div>
  );
}
