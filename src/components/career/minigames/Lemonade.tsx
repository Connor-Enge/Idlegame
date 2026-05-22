"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const CUPS = 5; // customers per round
const FILL_SPEED = 62; // % per second while pouring
const PERFECT = 6; // half-width of the perfect band
const CLOSE = 14; // half-width of the partial-credit band

function randomTarget() {
  return 58 + Math.random() * 30; // ideal fill line, 58%..88%
}

export default function Lemonade({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [fill, setFill] = useState(0);
  const [target, setTarget] = useState(randomTarget());
  const [cup, setCup] = useState(0);
  const [score, setScore] = useState(0);
  const [flash, setFlash] = useState<"" | "good" | "spill">("");
  const pouring = useRef(false);
  const fillRef = useRef(0);
  const scoreRef = useRef(0);

  // Pour loop: while held, the cup fills; overflowing past 100 spills it.
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (pouring.current) {
        const nf = fillRef.current + FILL_SPEED * dt;
        if (nf >= 100) {
          fillRef.current = 100;
          setFill(100);
          serve(true); // spilled
        } else {
          fillRef.current = nf;
          setFill(nf);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function serve(spilled: boolean) {
    pouring.current = false;
    const d = Math.abs(fillRef.current - target);
    const gained = spilled ? 0 : d <= PERFECT ? 4 : d <= CLOSE ? 2 : 1;
    const ns = scoreRef.current + gained;
    scoreRef.current = ns;
    setScore(ns);
    setFlash(spilled ? "spill" : "good");

    const next = cup + 1;
    setTimeout(() => {
      setFlash("");
      if (next >= CUPS) {
        onFinish(Math.max(1, ns));
      } else {
        setCup(next);
        fillRef.current = 0;
        setFill(0);
        setTarget(randomTarget());
      }
    }, 420);
  }

  if (!running) {
    return (
      <StartScreen
        icon="🍋"
        name="Lemonade Stand"
        blurb="Hold the cup to pour, release when the lemonade reaches the line. Get close for more — overfill and it spills!"
        onStart={() => setRunning(true)}
      />
    );
  }

  const serving = flash !== "";

  return (
    <div>
      <ScoreStrip label="Tips" value={score} right={`Cup ${Math.min(cup + 1, CUPS)}/${CUPS}`} />
      <div
        onPointerDown={() => { if (!serving) pouring.current = true; }}
        onPointerUp={() => { if (pouring.current && !serving) serve(false); }}
        onPointerLeave={() => { if (pouring.current && !serving) serve(false); }}
        className="relative mx-auto flex h-72 w-44 select-none items-end overflow-hidden rounded-b-3xl rounded-t-xl border-4 border-white/30 bg-white/5"
      >
        {/* lemonade fill */}
        <div
          className={`w-full transition-none ${flash === "spill" ? "bg-danger/60" : "bg-yellow-300/80"}`}
          style={{ height: `${fill}%` }}
        />
        {/* target line band */}
        <div className="absolute inset-x-0 border-y-2 border-emerald-300/80 bg-emerald-300/20"
          style={{ bottom: `${target - PERFECT}%`, height: `${PERFECT * 2}%` }} />
        <div className="absolute inset-x-0 text-center text-[10px] font-bold text-emerald-200"
          style={{ bottom: `${target + PERFECT + 1}%` }}>
          fill to here
        </div>
        {flash === "good" && (
          <div className="absolute inset-0 flex items-center justify-center text-2xl font-black text-emerald-300">
            🍋 +
          </div>
        )}
        {flash === "spill" && (
          <div className="absolute inset-0 flex items-center justify-center text-2xl font-black text-danger">
            Spilled!
          </div>
        )}
      </div>
      <p className="mt-3 text-center text-xs text-muted">Hold to pour · release at the line</p>
    </div>
  );
}
