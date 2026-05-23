"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 12;
const EMP = ["Tom", "Sue", "Bob"];
const DAYS = ["Mon", "Tue", "Wed"];

function pick() {
  return { e: Math.floor(Math.random() * EMP.length), d: Math.floor(Math.random() * DAYS.length) };
}

export default function ShiftLead({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [req, setReq] = useState(pick);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [wrong, setWrong] = useState(false);
  const reqRef = useRef(req);
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

  function tap(e: number, d: number) {
    if (e === reqRef.current.e && d === reqRef.current.d) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      const next = pick();
      reqRef.current = next;
      setReq(next);
    } else {
      setWrong(true);
      setTimeout(() => setWrong(false), 180);
    }
  }

  if (!running) {
    return (
      <StartScreen icon="📋" name="Shift Lead" blurb="Read each request and tap the matching cell in the schedule grid." onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Scheduled" value={score} right={`${left.toFixed(1)}s`} />
      <div className={`mb-3 rounded-2xl bg-white/10 py-4 text-center text-lg font-bold ${wrong ? "ring-2 ring-danger" : ""}`}>
        Schedule <span className="text-accent">{EMP[req.e]}</span> on <span className="text-accent">{DAYS[req.d]}</span>
      </div>
      <div className="rounded-2xl bg-white/5 p-2">
        <div className="grid grid-cols-4 gap-1.5 text-[11px]">
          <div />
          {DAYS.map((d) => (<div key={d} className="text-center font-bold text-muted">{d}</div>))}
          {EMP.map((emp, e) => (
            <Fragment key={e}>
              <div className="flex items-center font-bold text-muted">{emp}</div>
              {DAYS.map((_, d) => (
                <button key={d} onPointerDown={() => tap(e, d)} className="h-12 rounded-md bg-accent/15 active:bg-accent/40" />
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
