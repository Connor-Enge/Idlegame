"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 14;
const INGREDIENTS = ["🍞", "🥩", "🧀", "🥬", "🍅"];

function makeOrder(len: number) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * INGREDIENTS.length));
}

export default function FastFood({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [order, setOrder] = useState<number[]>([]);
  const [pos, setPos] = useState(0);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [wrong, setWrong] = useState(false);
  const posRef = useRef(0);
  const orderRef = useRef<number[]>([]);
  const scoreRef = useRef(0);

  function nextOrder() {
    const len = 2 + Math.min(3, Math.floor(scoreRef.current / 3));
    orderRef.current = makeOrder(len);
    posRef.current = 0;
    setOrder(orderRef.current);
    setPos(0);
  }

  useEffect(() => {
    if (!running) return;
    nextOrder();
    const start = Date.now();
    const iv = setInterval(() => {
      const rem = Math.max(0, DURATION - (Date.now() - start) / 1000);
      setLeft(rem);
      if (rem <= 0) { clearInterval(iv); onFinish(Math.max(1, scoreRef.current)); }
    }, 100);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function tap(i: number) {
    if (i === orderRef.current[posRef.current]) {
      const np = posRef.current + 1;
      if (np >= orderRef.current.length) {
        scoreRef.current += 1;
        setScore(scoreRef.current);
        nextOrder();
      } else {
        posRef.current = np;
        setPos(np);
      }
    } else {
      posRef.current = 0;
      setPos(0);
      setWrong(true);
      setTimeout(() => setWrong(false), 200);
    }
  }

  if (!running) {
    return (
      <StartScreen icon="🍔" name="Fast Food Cook" blurb="Build each burger by tapping the ingredients in the exact order shown. Finish as many orders as you can!" onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Orders" value={score} right={`${left.toFixed(1)}s`} />
      <div className={`mb-4 flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-white/10 py-6 ${wrong ? "ring-2 ring-danger" : ""}`}>
        {order.map((ing, idx) => (
          <span key={idx} className={`text-3xl transition ${idx < pos ? "opacity-30" : idx === pos ? "scale-125" : "opacity-70"}`}>
            {idx < pos ? "✅" : INGREDIENTS[ing]}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-2">
        {INGREDIENTS.map((ing, i) => (
          <button key={i} onPointerDown={() => tap(i)} className="rounded-xl bg-accent/20 py-4 text-2xl active:bg-accent/40">
            {ing}
          </button>
        ))}
      </div>
    </div>
  );
}
