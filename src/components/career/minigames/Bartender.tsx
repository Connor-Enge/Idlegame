"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

// One drink at a time. Hold the pour button to fill the glass; release when
// it's in the green target band. Each cocktail's a single quick precision tap,
// so a session yields ~10 cocktails (in line with every other minigame). The
// previous 3-glass / 9-pour design produced only ~2 cocktails per session.
const DURATION = 14;
const POUR_RATE = 70; // % per second while held
const PERFECT_BAND = 8; // half-width of perfect zone
const OK_BAND = 18; // half-width of partial-credit zone

function randomTarget() {
  return 50 + Math.random() * 35; // 50%..85% target line
}

export default function Bartender({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [fill, setFill] = useState(0);
  const [target, setTarget] = useState(randomTarget());
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [flash, setFlash] = useState<"" | "perfect" | "good" | "spill">("");
  const pouring = useRef(false);
  const fillRef = useRef(0);
  const scoreRef = useRef(0);

  // Pour loop — while held, the glass fills; overflowing past 100 spills it.
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (pouring.current) {
        const nf = fillRef.current + POUR_RATE * dt;
        if (nf >= 100) {
          fillRef.current = 100;
          setFill(100);
          serve(true);
        } else {
          fillRef.current = nf;
          setFill(nf);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const start = Date.now();
    const ticker = setInterval(() => {
      const rem = Math.max(0, DURATION - (Date.now() - start) / 1000);
      setLeft(rem);
      if (rem <= 0) {
        clearInterval(ticker);
        cancelAnimationFrame(raf);
        onFinish(Math.max(1, scoreRef.current));
      }
    }, 100);
    return () => { cancelAnimationFrame(raf); clearInterval(ticker); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function serve(spilled: boolean) {
    pouring.current = false;
    const d = Math.abs(fillRef.current - target);
    let gained = 0;
    let f: "perfect" | "good" | "spill" = "spill";
    if (!spilled) {
      if (d <= PERFECT_BAND) { gained = 2; f = "perfect"; }
      else if (d <= OK_BAND) { gained = 1; f = "good"; }
    }
    scoreRef.current += gained;
    setScore(scoreRef.current);
    setFlash(f);
    setTimeout(() => {
      setFlash("");
      fillRef.current = 0;
      setFill(0);
      setTarget(randomTarget());
    }, 220);
  }

  if (!running) {
    return (
      <StartScreen icon="🍸" name="Bartender" blurb="Hold to pour, release at the green line. Closer to centre pays double — overfill and it spills!" onStart={() => setRunning(true)} />
    );
  }

  const serving = flash !== "";

  return (
    <div>
      <ScoreStrip label="Cocktails" value={score} right={`${left.toFixed(1)}s`} />
      <div
        onPointerDown={() => { if (!serving) pouring.current = true; }}
        onPointerUp={() => { if (pouring.current && !serving) serve(false); }}
        onPointerLeave={() => { if (pouring.current && !serving) serve(false); }}
        className="relative mx-auto flex h-72 w-32 select-none items-end overflow-hidden rounded-b-3xl rounded-t-md border-4 border-white/30 bg-white/5"
      >
        <div
          className={`w-full transition-none ${flash === "spill" ? "bg-danger/60" : "bg-fuchsia-400/80"}`}
          style={{ height: `${fill}%` }}
        />
        <div className="absolute inset-x-0 border-y-2 border-emerald-300/80 bg-emerald-300/20"
          style={{ bottom: `${target - PERFECT_BAND}%`, height: `${PERFECT_BAND * 2}%` }} />
        {flash === "perfect" && (
          <div className="absolute inset-0 flex items-center justify-center text-2xl font-black text-accent-2">Perfect!</div>
        )}
        {flash === "good" && (
          <div className="absolute inset-0 flex items-center justify-center text-lg font-black text-accent">Served</div>
        )}
        {flash === "spill" && (
          <div className="absolute inset-0 flex items-center justify-center text-xl font-black text-danger">Spilled!</div>
        )}
      </div>
      <p className="mt-3 text-center text-xs text-muted">Hold to pour · release at the line</p>
    </div>
  );
}
