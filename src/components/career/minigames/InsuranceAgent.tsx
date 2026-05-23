"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 12;
const TIERS = [
  { id: "low", label: "Low", icon: "🟢", min: 0, max: 33 },
  { id: "med", label: "Medium", icon: "🟡", min: 34, max: 66 },
  { id: "high", label: "High", icon: "🔴", min: 67, max: 100 },
];

function pickRound() {
  return Math.floor(Math.random() * 101);
}

export default function InsuranceAgent({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [risk, setRisk] = useState(pickRound);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [flash, setFlash] = useState<"" | "good" | "bad">("");
  const riskRef = useRef(risk);
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

  function pick(t: typeof TIERS[number]) {
    const r = riskRef.current;
    if (r >= t.min && r <= t.max) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      setFlash("good");
    } else setFlash("bad");
    setTimeout(() => {
      setFlash("");
      const nr = pickRound();
      riskRef.current = nr;
      setRisk(nr);
    }, 200);
  }

  if (!running) {
    return (
      <StartScreen icon="📑" name="Insurance Agent" blurb="Read the risk score and pick the matching tier — Low, Medium, or High." onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Quoted" value={score} right={`${left.toFixed(1)}s`} />
      <div className={`mb-4 rounded-2xl bg-white/10 p-4 text-center ${flash === "good" ? "ring-2 ring-accent-2" : flash === "bad" ? "ring-2 ring-danger" : ""}`}>
        <div className="text-[10px] uppercase text-muted">Risk score</div>
        <div className="text-5xl font-black text-accent">{risk}</div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-accent-2" style={{ width: `${risk}%` }} />
        </div>
        <div className="mt-1 text-[10px] text-muted">Low 0-33 · Med 34-66 · High 67-100</div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {TIERS.map((t) => (
          <button key={t.id} onPointerDown={() => pick(t)} className="flex flex-col items-center gap-1 rounded-xl bg-accent/20 py-4 text-sm font-bold text-accent active:bg-accent/40">
            <span className="text-2xl">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
