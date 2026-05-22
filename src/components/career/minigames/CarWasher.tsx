"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 11;
const CELLS = 12;
const TAPS_TO_CLEAN = 3;

type Spot = { grime: number }; // grime > 0 means dirty

export default function CarWasher({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [spots, setSpots] = useState<Spot[]>(() => Array.from({ length: CELLS }, () => ({ grime: 0 })));
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const spotsRef = useRef<Spot[]>(spots);
  const scoreRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    spotsRef.current = Array.from({ length: CELLS }, () => ({ grime: Math.random() < 0.5 ? TAPS_TO_CLEAN : 0 }));
    setSpots([...spotsRef.current]);
    const start = Date.now();
    // periodically dirty a random clean cell so the car keeps needing work
    const dirtier = setInterval(() => {
      const clean = spotsRef.current.map((s, i) => (s.grime <= 0 ? i : -1)).filter((i) => i >= 0);
      if (clean.length) {
        spotsRef.current[clean[Math.floor(Math.random() * clean.length)]].grime = TAPS_TO_CLEAN;
        setSpots([...spotsRef.current]);
      }
    }, 700);
    const ticker = setInterval(() => {
      const rem = Math.max(0, DURATION - (Date.now() - start) / 1000);
      setLeft(rem);
      if (rem <= 0) { clearInterval(ticker); clearInterval(dirtier); onFinish(Math.max(1, scoreRef.current)); }
    }, 100);
    return () => { clearInterval(ticker); clearInterval(dirtier); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function scrub(i: number) {
    const s = spotsRef.current[i];
    if (s.grime <= 0) return;
    s.grime -= 1;
    if (s.grime <= 0) { scoreRef.current += 1; setScore(scoreRef.current); }
    setSpots([...spotsRef.current]);
  }

  if (!running) {
    return (
      <StartScreen icon="🧽" name="Car Washer" blurb="Scrub every dirty spot clean — each takes a few taps, and fresh grime keeps appearing. Clean as many as you can!" onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Cleaned" value={score} right={`${left.toFixed(1)}s`} />
      <div className="grid grid-cols-4 gap-2 rounded-2xl bg-sky-800/30 p-3">
        {spots.map((s, i) => (
          <button key={i} onPointerDown={() => scrub(i)} className="flex h-16 items-center justify-center rounded-xl text-2xl transition" style={{ background: s.grime > 0 ? `rgba(120,72,40,${0.25 + s.grime * 0.2})` : "rgba(120,200,255,0.15)" }}>
            {s.grime > 0 ? "🟤" : "✨"}
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-muted">Tap dirty spots to scrub them clean</p>
    </div>
  );
}
