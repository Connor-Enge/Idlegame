"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 13;
const MIN_SCORE = 620;
const MIN_INCOME = 40;

function pickApp() {
  const score = 450 + Math.floor(Math.random() * 380);
  const income = 18 + Math.floor(Math.random() * 70);
  return { score, income, ok: score >= MIN_SCORE && income >= MIN_INCOME };
}

export default function LoanOfficer({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [app, setApp] = useState(pickApp);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [flash, setFlash] = useState<"" | "good" | "bad">("");
  const appRef = useRef(app);
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
    if (approve === appRef.current.ok) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      setFlash("good");
    } else setFlash("bad");
    setTimeout(() => {
      setFlash("");
      const a = pickApp();
      appRef.current = a;
      setApp(a);
    }, 200);
  }

  if (!running) {
    return (
      <StartScreen icon="💳" name="Loan Officer" blurb={`Approve only if credit score ≥ ${MIN_SCORE} AND income ≥ $${MIN_INCOME}k. Read fast — applicants stack up!`} onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Decisions" value={score} right={`${left.toFixed(1)}s`} />
      <div className={`mb-4 rounded-2xl bg-white/10 p-4 ${flash === "good" ? "ring-2 ring-accent-2" : flash === "bad" ? "ring-2 ring-danger" : ""}`}>
        <div className="text-[10px] uppercase text-muted">Application</div>
        <div className="mt-2 grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl bg-white/5 py-3">
            <div className="text-[10px] uppercase text-muted">Credit</div>
            <div className={`text-2xl font-black ${app.score >= MIN_SCORE ? "text-accent-2" : "text-danger"}`}>{app.score}</div>
          </div>
          <div className="rounded-xl bg-white/5 py-3">
            <div className="text-[10px] uppercase text-muted">Income</div>
            <div className={`text-2xl font-black ${app.income >= MIN_INCOME ? "text-accent-2" : "text-danger"}`}>${app.income}k</div>
          </div>
        </div>
        <div className="mt-2 text-center text-[11px] text-muted">Rule: score ≥ {MIN_SCORE} AND income ≥ ${MIN_INCOME}k</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onPointerDown={() => judge(true)} className="rounded-xl bg-emerald-400/30 py-5 text-lg font-bold text-emerald-200 active:brightness-110">✅ Approve</button>
        <button onPointerDown={() => judge(false)} className="rounded-xl bg-rose-400/30 py-5 text-lg font-bold text-rose-200 active:brightness-110">❌ Reject</button>
      </div>
    </div>
  );
}
