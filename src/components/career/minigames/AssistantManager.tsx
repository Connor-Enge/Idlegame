"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 12;
const PILES = 3;

export default function AssistantManager({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [piles, setPiles] = useState<number[]>([0, 0, 0]);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [overflow, setOverflow] = useState<number | null>(null);
  const pilesRef = useRef<number[]>([0, 0, 0]);
  const scoreRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    const spawn = setInterval(() => {
      const i = Math.floor(Math.random() * PILES);
      pilesRef.current[i] += 1;
      // Overflow: pile gets too tall — penalty, clear a few back off.
      if (pilesRef.current[i] >= 9) {
        pilesRef.current[i] = 5;
        scoreRef.current = Math.max(0, scoreRef.current - 1);
        setScore(scoreRef.current);
        setOverflow(i);
        setTimeout(() => setOverflow(null), 220);
      }
      setPiles([...pilesRef.current]);
    }, 470);
    const iv = setInterval(() => {
      const rem = Math.max(0, DURATION - (Date.now() - start) / 1000);
      setLeft(rem);
      if (rem <= 0) { clearInterval(iv); clearInterval(spawn); onFinish(Math.max(1, scoreRef.current)); }
    }, 100);
    return () => { clearInterval(iv); clearInterval(spawn); };
  }, [running, onFinish]);

  function process(i: number) {
    if (pilesRef.current[i] <= 0) return;
    pilesRef.current[i] -= 1;
    scoreRef.current += 1;
    setPiles([...pilesRef.current]);
    setScore(scoreRef.current);
  }

  if (!running) {
    return (
      <StartScreen icon="🗂️" name="Triage" blurb="Tasks pile up across three queues. Tap to process one off each pile — don't let any pile overflow!" onStart={() => setRunning(true)} />
    );
  }

  const ICONS = ["📧", "🧾", "📞"];
  const LABELS = ["Emails", "Receipts", "Calls"];

  return (
    <div>
      <ScoreStrip label="Processed" value={score} right={`${left.toFixed(1)}s`} />
      <div className="grid grid-cols-3 gap-3">
        {piles.map((n, i) => (
          <button key={i} onPointerDown={() => process(i)} className={`flex flex-col items-center gap-2 rounded-2xl p-3 active:brightness-110 ${overflow === i ? "bg-danger/40" : n >= 6 ? "bg-amber-400/30" : "bg-white/5"}`}>
            <span className="text-3xl">{ICONS[i]}</span>
            <span className="text-[10px] text-muted">{LABELS[i]}</span>
            <span className={`text-2xl font-black ${n >= 6 ? "text-danger" : "text-accent-2"}`}>{n}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
