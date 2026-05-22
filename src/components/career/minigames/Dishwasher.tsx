"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 12;
const STEPS = [
  { id: 0, label: "Wash", icon: "🧼" },
  { id: 1, label: "Rinse", icon: "💧" },
  { id: 2, label: "Dry", icon: "🌀" },
];

export default function Dishwasher({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [wrong, setWrong] = useState(false);
  const stepRef = useRef(0);
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

  function press(id: number) {
    if (id === stepRef.current) {
      const ns = stepRef.current + 1;
      if (ns >= STEPS.length) {
        scoreRef.current += 1;
        setScore(scoreRef.current);
        stepRef.current = 0;
      } else {
        stepRef.current = ns;
      }
      setStep(stepRef.current);
    } else {
      stepRef.current = 0;
      setStep(0);
      setWrong(true);
      setTimeout(() => setWrong(false), 200);
    }
  }

  if (!running) {
    return (
      <StartScreen icon="🍽️" name="Dishwasher" blurb="Wash, then rinse, then dry — tap the steps in the right order. Finish dishes as fast as you can; a wrong step starts the dish over." onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Dishes" value={score} right={`${left.toFixed(1)}s`} />
      <div className={`mb-4 flex items-center justify-center gap-3 rounded-2xl bg-white/10 py-6 ${wrong ? "ring-2 ring-danger" : ""}`}>
        {STEPS.map((s) => (
          <span key={s.id} className={`text-3xl transition ${s.id < step ? "opacity-100" : s.id === step ? "scale-125 opacity-100" : "opacity-30"}`}>
            {s.id < step ? "✅" : s.icon}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {STEPS.map((s) => (
          <button key={s.id} onPointerDown={() => press(s.id)} className="flex flex-col items-center gap-1 rounded-xl bg-accent/20 py-5 text-2xl text-accent active:bg-accent/40">
            {s.icon}
            <span className="text-[11px] font-semibold">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
