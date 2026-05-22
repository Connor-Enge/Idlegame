"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 5; // seconds

export default function Clicker({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [taps, setTaps] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const tapsRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    const iv = setInterval(() => {
      const rem = Math.max(0, DURATION - (Date.now() - start) / 1000);
      setLeft(rem);
      if (rem <= 0) {
        clearInterval(iv);
        onFinish(tapsRef.current);
      }
    }, 80);
    return () => clearInterval(iv);
  }, [running, onFinish]);

  if (!running) {
    return (
      <StartScreen
        icon="👆"
        name="Rapid Tap"
        blurb="Tap the pad as many times as you can in 5 seconds."
        onStart={() => setRunning(true)}
      />
    );
  }

  return (
    <div>
      <ScoreStrip label="Taps" value={taps} right={`${left.toFixed(1)}s`} />
      <button
        onPointerDown={() => {
          tapsRef.current += 1;
          setTaps(tapsRef.current);
        }}
        className="flex h-72 w-full select-none items-center justify-center rounded-3xl bg-accent/20 text-6xl font-black text-accent active:bg-accent/40"
      >
        {taps}
      </button>
      <p className="mt-3 text-center text-xs text-muted">Tap! Tap! Tap!</p>
    </div>
  );
}
