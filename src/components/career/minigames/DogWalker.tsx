"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 11; // seconds
const RISE = 26; // tension gained per second (dog pulling)
const EASE = 16; // tension released per tap
const LOW = 16;
const HIGH = 84;

export default function DogWalker({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [tension, setTension] = useState(50);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [loose, setLoose] = useState(false);
  const tRef = useRef(50);
  const scoreRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      tRef.current = Math.min(100, tRef.current + RISE * dt);
      setTension(tRef.current);
      // Bank points while the dog walks calmly in the safe band.
      if (tRef.current >= LOW && tRef.current <= HIGH) {
        scoreRef.current += dt * 2.2;
        setScore(scoreRef.current);
      }
      if (tRef.current >= 100) {
        setLoose(true);
        cancelAnimationFrame(raf);
        onFinish(Math.max(1, Math.round(scoreRef.current)));
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const ticker = setInterval(() => {
      const rem = Math.max(0, DURATION - (Date.now() - start) / 1000);
      setLeft(rem);
      if (rem <= 0) {
        clearInterval(ticker);
        cancelAnimationFrame(raf);
        onFinish(Math.max(1, Math.round(scoreRef.current)));
      }
    }, 100);
    return () => { cancelAnimationFrame(raf); clearInterval(ticker); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function pull() {
    tRef.current = Math.max(0, tRef.current - EASE);
    setTension(tRef.current);
  }

  if (!running) {
    return (
      <StartScreen
        icon="🐕"
        name="Dog Walker"
        blurb="The dog keeps pulling — tap to ease the leash and keep tension in the green band. Let it max out and the dog breaks loose!"
        onStart={() => setRunning(true)}
      />
    );
  }

  const inZone = tension >= LOW && tension <= HIGH;

  return (
    <div>
      <ScoreStrip label="Calm walk" value={Math.round(score)} right={`${left.toFixed(1)}s`} />
      <div className="relative mx-auto h-72 w-24 overflow-hidden rounded-2xl bg-white/10">
        {/* safe band */}
        <div className="absolute inset-x-0 bg-emerald-400/20" style={{ bottom: `${LOW}%`, height: `${HIGH - LOW}%` }} />
        {/* tension fill */}
        <div
          className={`absolute inset-x-0 bottom-0 ${tension > HIGH ? "bg-danger/70" : inZone ? "bg-emerald-400/70" : "bg-amber-400/70"}`}
          style={{ height: `${tension}%` }}
        />
        <div className="absolute inset-x-0 top-2 text-center text-2xl">{loose ? "💨" : "🐕"}</div>
      </div>
      <button
        onPointerDown={pull}
        className="mt-4 w-full rounded-xl bg-accent py-4 text-sm font-bold text-black active:brightness-90"
      >
        🦮 Ease the leash
      </button>
    </div>
  );
}
