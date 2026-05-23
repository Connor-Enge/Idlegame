"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 13;
const PER_CUSTOMER = 2.6; // seconds before they walk away
const PER_TAP = 8.5; // conviction added per pitch

export default function Kiosk({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [conviction, setConviction] = useState(0);
  const [customerLeft, setCustomerLeft] = useState(PER_CUSTOMER);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const convRef = useRef(0);
  const cTimerRef = useRef(PER_CUSTOMER);
  const scoreRef = useRef(0);

  function nextCustomer() {
    convRef.current = 0;
    cTimerRef.current = PER_CUSTOMER;
    setConviction(0);
    setCustomerLeft(PER_CUSTOMER);
  }

  useEffect(() => {
    if (!running) return;
    nextCustomer();
    const start = Date.now();
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      cTimerRef.current -= dt;
      if (cTimerRef.current <= 0) nextCustomer();
      setCustomerLeft(Math.max(0, cTimerRef.current));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const ticker = setInterval(() => {
      const rem = Math.max(0, DURATION - (Date.now() - start) / 1000);
      setLeft(rem);
      if (rem <= 0) { clearInterval(ticker); cancelAnimationFrame(raf); onFinish(Math.max(1, scoreRef.current)); }
    }, 100);
    return () => { cancelAnimationFrame(raf); clearInterval(ticker); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function pitch() {
    convRef.current += PER_TAP;
    setConviction(convRef.current);
    if (convRef.current >= 100) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      nextCustomer();
    }
  }

  if (!running) {
    return (
      <StartScreen icon="🛒" name="Kiosk Pitch" blurb="Each shopper only stops for a moment — mash to fill their conviction bar before they walk off!" onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Sales" value={score} right={`${left.toFixed(1)}s`} />
      <div className="mb-3 rounded-2xl bg-white/10 p-4 text-center">
        <div className="text-5xl">🙂</div>
        <div className="mt-1 text-[11px] text-muted">leaves in {customerLeft.toFixed(1)}s</div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-accent-2 transition-all" style={{ width: `${Math.min(100, conviction)}%` }} />
        </div>
        <div className="mt-1 text-[11px] text-muted">conviction {Math.min(100, Math.round(conviction))}/100</div>
      </div>
      <button onPointerDown={pitch} className="flex h-44 w-full items-center justify-center rounded-3xl bg-accent text-2xl font-bold text-black active:brightness-90">
        🗣️ PITCH!
      </button>
    </div>
  );
}
