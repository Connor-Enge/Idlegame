"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const ROUNDS = 5;
const GREEN = 9; // half-width of the perfect zone (around centre 50)
const OK = 20; // half-width of the partial zone

export default function Timing({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [pos, setPos] = useState(0);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const dir = useRef(1);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const speed = 70; // % per second
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setPos((p) => {
        let np = p + dir.current * speed * dt;
        if (np >= 100) { np = 100; dir.current = -1; }
        if (np <= 0) { np = 0; dir.current = 1; }
        return np;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  function lock() {
    const d = Math.abs(pos - 50);
    const gained = d <= GREEN ? 5 : d <= OK ? 3 : 1;
    const ns = scoreRef.current + gained;
    scoreRef.current = ns;
    setScore(ns);
    const nr = round + 1;
    setRound(nr);
    if (nr >= ROUNDS) onFinish(ns);
  }

  if (!running) {
    return (
      <StartScreen
        icon="🎯"
        name="Perfect Timing"
        blurb="Tap to stop the marker in the green zone. Five rounds — closer to centre scores more."
        onStart={() => setRunning(true)}
      />
    );
  }

  return (
    <div>
      <ScoreStrip label="Points" value={score} right={`Round ${Math.min(round + 1, ROUNDS)}/${ROUNDS}`} />
      <div className="relative h-16 w-full overflow-hidden rounded-2xl bg-white/10">
        {/* zones */}
        <div className="absolute inset-y-0 bg-accent-2/20" style={{ left: `${50 - OK}%`, width: `${OK * 2}%` }} />
        <div className="absolute inset-y-0 bg-accent/40" style={{ left: `${50 - GREEN}%`, width: `${GREEN * 2}%` }} />
        {/* marker */}
        <div className="absolute inset-y-0 w-1 bg-white" style={{ left: `${pos}%` }} />
      </div>
      <button
        onPointerDown={lock}
        className="mt-4 w-full rounded-xl bg-accent py-4 text-sm font-bold text-black active:brightness-90"
      >
        STOP
      </button>
    </div>
  );
}
