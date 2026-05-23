"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 14;
const POUR = 9; // % per tap
const BAND = 10; // half-width of accept band

function newTargets(): number[] {
  return [0, 1, 2].map(() => 35 + Math.random() * 50);
}

export default function Bartender({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [fills, setFills] = useState([0, 0, 0]);
  const [targets, setTargets] = useState<number[]>(newTargets);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [wrong, setWrong] = useState(false);
  const fillsRef = useRef([0, 0, 0]);
  const targetsRef = useRef(targets);
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

  function pour(i: number) {
    fillsRef.current[i] = Math.min(100, fillsRef.current[i] + POUR);
    setFills([...fillsRef.current]);
  }

  function serve() {
    const ok = fillsRef.current.every((f, i) => Math.abs(f - targetsRef.current[i]) <= BAND);
    if (ok) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
    } else {
      setWrong(true);
      setTimeout(() => setWrong(false), 200);
    }
    fillsRef.current = [0, 0, 0];
    targetsRef.current = newTargets();
    setFills([0, 0, 0]);
    setTargets(targetsRef.current);
  }

  if (!running) {
    return (
      <StartScreen icon="🍸" name="Bartender" blurb="Pour each of three liquids to its line, then hit SERVE. Get them all in the band for the sale." onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Cocktails" value={score} right={`${left.toFixed(1)}s`} />
      <div className={`mb-3 grid grid-cols-3 gap-3 ${wrong ? "ring-2 ring-danger rounded-2xl" : ""}`}>
        {fills.map((f, i) => (
          <div key={i} className="relative h-44 overflow-hidden rounded-b-2xl rounded-t-md border-2 border-white/30 bg-white/5">
            <div className="absolute inset-x-0 bottom-0 bg-fuchsia-400/70" style={{ height: `${f}%` }} />
            <div className="absolute inset-x-0 border-y-2 border-emerald-300/80 bg-emerald-300/20" style={{ bottom: `${targets[i] - BAND}%`, height: `${BAND * 2}%` }} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <button key={i} onPointerDown={() => pour(i)} className="rounded-xl bg-accent/30 py-3 text-xs font-bold text-accent active:bg-accent/50">
            Pour {i + 1}
          </button>
        ))}
      </div>
      <button onPointerDown={serve} className="mt-3 w-full rounded-xl bg-accent py-4 text-sm font-bold text-black active:brightness-90">
        🍸 Serve
      </button>
    </div>
  );
}
