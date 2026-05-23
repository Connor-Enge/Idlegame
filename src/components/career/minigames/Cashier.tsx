"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 13;
const BILLS = [10, 5, 1];

function newProblem() {
  const due = 1 + Math.floor(Math.random() * 24);
  const tendered = due + 1 + Math.floor(Math.random() * 18);
  return { due, tendered, diff: tendered - due };
}

export default function Cashier({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [prob, setProb] = useState(newProblem);
  const [sum, setSum] = useState(0);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [wrong, setWrong] = useState(false);
  const sumRef = useRef(0);
  const scoreRef = useRef(0);
  const probRef = useRef(prob);

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

  function add(v: number) {
    const ns = sumRef.current + v;
    if (ns === probRef.current.diff) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      const np = newProblem();
      probRef.current = np;
      sumRef.current = 0;
      setSum(0);
      setProb(np);
    } else if (ns > probRef.current.diff) {
      sumRef.current = 0;
      setSum(0);
      setWrong(true);
      setTimeout(() => setWrong(false), 220);
    } else {
      sumRef.current = ns;
      setSum(ns);
    }
  }

  if (!running) {
    return (
      <StartScreen icon="💵" name="Cashier" blurb="Make exact change for each customer by tapping bills. Overshoot and you have to start over!" onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Customers" value={score} right={`${left.toFixed(1)}s`} />
      <div className={`mb-4 rounded-2xl bg-white/10 px-4 py-5 text-center ${wrong ? "ring-2 ring-danger" : ""}`}>
        <div className="text-xs text-muted">Bill ${prob.tendered} · Owed ${prob.due}</div>
        <div className="mt-1 text-3xl font-black">Change: ${prob.diff}</div>
        <div className="mt-2 text-sm text-accent-2">tendered: ${sum}</div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {BILLS.map((b) => (
          <button key={b} onPointerDown={() => add(b)} className="rounded-xl bg-accent/20 py-5 text-xl font-bold text-accent active:bg-accent/40">
            ${b}
          </button>
        ))}
      </div>
    </div>
  );
}
