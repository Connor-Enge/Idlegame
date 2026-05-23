"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 13;
const STARS = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

function pickCandidate() {
  return { stars: 1 + Math.floor(Math.random() * 5) };
}

export default function Recruiter({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [cand, setCand] = useState(pickCandidate);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [flash, setFlash] = useState<"" | "good" | "bad">("");
  const candRef = useRef(cand);
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

  function decide(call: boolean) {
    const good = candRef.current.stars >= 4;
    if (call === good) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      setFlash("good");
    } else setFlash("bad");
    setTimeout(() => {
      setFlash("");
      const c = pickCandidate();
      candRef.current = c;
      setCand(c);
    }, 180);
  }

  if (!running) {
    return (
      <StartScreen icon="🎯" name="Recruiter" blurb="Call back any candidate rated 4 stars or higher. Skip the rest — fast." onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Decisions" value={score} right={`${left.toFixed(1)}s`} />
      <div className={`mb-4 rounded-2xl bg-white/10 py-6 text-center ${flash === "good" ? "ring-2 ring-accent-2" : flash === "bad" ? "ring-2 ring-danger" : ""}`}>
        <div className="text-5xl">🧑‍💼</div>
        <div className="mt-3 text-2xl font-black text-amber-300 tracking-widest">{STARS(cand.stars)}</div>
        <div className="mt-1 text-[10px] uppercase text-muted">candidate rating</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onPointerDown={() => decide(true)} className="rounded-xl bg-emerald-400/30 py-5 text-lg font-bold text-emerald-200 active:brightness-110">📞 Call</button>
        <button onPointerDown={() => decide(false)} className="rounded-xl bg-rose-400/30 py-5 text-lg font-bold text-rose-200 active:brightness-110">❌ Skip</button>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted">Call ≥4★ · Skip &lt;4★</p>
    </div>
  );
}
