"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 13;
const HIT_LINE = 82; // % from top where notes should be tapped
const PERFECT = 5;
const GOOD = 11;
type Note = { id: number; y: number; done: boolean };

export default function Barista({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [judge, setJudge] = useState("");
  const notesRef = useRef<Note[]>([]);
  const scoreRef = useRef(0);
  const idRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    let raf = 0;
    let last = performance.now();
    let spawn = 0.4;
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      spawn += dt;
      if (spawn > 0.72) { spawn = 0; notesRef.current.push({ id: idRef.current++, y: -6, done: false }); }
      for (const n of notesRef.current) n.y += 46 * dt;
      notesRef.current = notesRef.current.filter((n) => n.y < 100 && !n.done);
      setNotes([...notesRef.current]);
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

  function tap() {
    // judge the note nearest the hit line
    let best: Note | null = null;
    let bestD = 999;
    for (const n of notesRef.current) {
      if (n.done) continue;
      const d = Math.abs(n.y - HIT_LINE);
      if (d < bestD) { bestD = d; best = n; }
    }
    if (best && bestD <= GOOD) {
      best.done = true;
      const gained = bestD <= PERFECT ? 2 : 1;
      scoreRef.current += gained;
      setScore(scoreRef.current);
      setJudge(bestD <= PERFECT ? "Perfect!" : "Good");
    } else {
      setJudge("Miss");
    }
    setTimeout(() => setJudge(""), 250);
  }

  if (!running) {
    return (
      <StartScreen icon="☕" name="Barista" blurb="Pull each shot on beat — tap when a bean reaches the line. Nail the timing for bonus points." onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Shots" value={score} right={`${left.toFixed(1)}s`} />
      <div className="relative h-72 w-full overflow-hidden rounded-2xl bg-amber-950/40">
        <div className="absolute inset-x-0 border-y-2 border-accent/70 bg-accent/20" style={{ top: `${HIT_LINE - PERFECT}%`, height: `${PERFECT * 2}%` }} />
        {notes.map((n) => (
          <div key={n.id} className="absolute left-1/2 -translate-x-1/2 text-2xl" style={{ top: `${n.y}%` }}>☕</div>
        ))}
        {judge && (
          <div className="absolute inset-0 flex items-center justify-center text-2xl font-black text-accent-2">{judge}</div>
        )}
      </div>
      <button onPointerDown={tap} className="mt-4 w-full rounded-xl bg-accent py-4 text-sm font-bold text-black active:brightness-90">☕ Pull shot</button>
    </div>
  );
}
