"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 13;
const NAMES = ["A. Smith", "B. Jones", "C. Patel", "D. Garcia", "E. Chen", "F. Khan", "G. Brown", "H. Lee"];

function pickRound() {
  const claimed = NAMES[Math.floor(Math.random() * NAMES.length)];
  const onId = Math.random() < 0.5 ? claimed : NAMES[Math.floor(Math.random() * NAMES.length)];
  return { claimed, onId, match: claimed === onId };
}

export default function BankTeller({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [round, setRound] = useState(pickRound);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [flash, setFlash] = useState<"" | "good" | "bad">("");
  const roundRef = useRef(round);
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

  function judge(approve: boolean) {
    if (approve === roundRef.current.match) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      setFlash("good");
    } else setFlash("bad");
    setTimeout(() => {
      setFlash("");
      const r = pickRound();
      roundRef.current = r;
      setRound(r);
    }, 220);
  }

  if (!running) {
    return (
      <StartScreen icon="🏦" name="Bank Teller" blurb="Compare the customer's name to the ID. Approve if they match, decline if they don't." onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Verified" value={score} right={`${left.toFixed(1)}s`} />
      <div className={`mb-4 grid grid-cols-2 gap-3 rounded-2xl bg-white/10 p-4 ${flash === "good" ? "ring-2 ring-accent-2" : flash === "bad" ? "ring-2 ring-danger" : ""}`}>
        <div className="rounded-xl bg-white/5 p-3 text-center">
          <div className="text-[10px] uppercase text-muted">Customer claims</div>
          <div className="mt-1 text-xl font-bold">{round.claimed}</div>
        </div>
        <div className="rounded-xl bg-white/5 p-3 text-center">
          <div className="text-[10px] uppercase text-muted">ID shows</div>
          <div className="mt-1 text-xl font-bold">{round.onId}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onPointerDown={() => judge(true)} className="rounded-xl bg-emerald-400/30 py-5 text-lg font-bold text-emerald-200 active:brightness-110">✅ Approve</button>
        <button onPointerDown={() => judge(false)} className="rounded-xl bg-rose-400/30 py-5 text-lg font-bold text-rose-200 active:brightness-110">❌ Decline</button>
      </div>
    </div>
  );
}
