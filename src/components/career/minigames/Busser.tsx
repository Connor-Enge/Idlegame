"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 12;
const SAFE = 18; // |angle| under this banks points
const DROP = 46; // |angle| at/over this drops the tray

export default function Busser({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [angle, setAngle] = useState(0);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [dropped, setDropped] = useState(false);
  const aRef = useRef(0);
  const vRef = useRef(0);
  const scoreRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      // random wobble accelerates the tray; tapping counters it.
      vRef.current += (Math.random() - 0.5) * 60 * dt;
      vRef.current *= 0.98;
      aRef.current += vRef.current * dt * 6;
      if (Math.abs(aRef.current) >= DROP) {
        setDropped(true);
        scoreRef.current = Math.max(0, scoreRef.current * 0.6);
        aRef.current = 0;
        vRef.current = 0;
        setTimeout(() => setDropped(false), 300);
      }
      if (Math.abs(aRef.current) < SAFE) {
        scoreRef.current += dt * 2.4;
        setScore(scoreRef.current);
      }
      setAngle(aRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const ticker = setInterval(() => {
      const rem = Math.max(0, DURATION - (Date.now() - start) / 1000);
      setLeft(rem);
      if (rem <= 0) { clearInterval(ticker); cancelAnimationFrame(raf); onFinish(Math.max(1, Math.round(scoreRef.current))); }
    }, 100);
    return () => { cancelAnimationFrame(raf); clearInterval(ticker); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function nudge(d: number) {
    vRef.current += d * 4;
  }

  if (!running) {
    return (
      <StartScreen icon="🧹" name="Busser" blurb="Carry the loaded tray without dropping it. Tap Left/Right to counter the wobble and keep it level to bank points." onStart={() => setRunning(true)} />
    );
  }

  const safe = Math.abs(angle) < SAFE;

  return (
    <div>
      <ScoreStrip label="Steady" value={Math.round(score)} right={`${left.toFixed(1)}s`} />
      <div className="flex h-56 items-center justify-center rounded-2xl bg-white/5">
        <div className="transition-transform" style={{ transform: `rotate(${angle}deg)` }}>
          <div className={`flex items-end gap-1 rounded-lg px-3 py-2 ${dropped ? "opacity-30" : safe ? "bg-emerald-400/20" : "bg-amber-400/20"}`}>
            <span className="text-3xl">🍽️</span>
            <span className="text-3xl">🥤</span>
            <span className="text-3xl">🍰</span>
          </div>
          <div className="mx-auto mt-1 h-1.5 w-28 rounded bg-white/40" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button onPointerDown={() => nudge(-1)} className="rounded-xl bg-accent py-4 text-lg font-bold text-black active:brightness-90">◀ Tilt</button>
        <button onPointerDown={() => nudge(1)} className="rounded-xl bg-accent py-4 text-lg font-bold text-black active:brightness-90">Tilt ▶</button>
      </div>
    </div>
  );
}
