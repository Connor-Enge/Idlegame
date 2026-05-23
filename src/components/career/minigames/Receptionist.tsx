"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 13;
type Visitor = { id: number; allowed: boolean; x: number };

export default function Receptionist({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [flash, setFlash] = useState<"" | "good" | "bad">("");
  const vRef = useRef<Visitor[]>([]);
  const scoreRef = useRef(0);
  const idRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    let spawn = 0;
    const start = Date.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      spawn += dt;
      if (spawn > 0.78) {
        spawn = 0;
        vRef.current.push({ id: idRef.current++, allowed: Math.random() < 0.6, x: -10 });
      }
      // Move; if a visitor exits the right edge, resolve them passively.
      const next: Visitor[] = [];
      for (const v of vRef.current) {
        v.x += 24 * dt;
        if (v.x >= 100) {
          // Let-pass: green should have been tapped (miss), red is correct (no-op).
          if (v.allowed) { /* missed: no point */ }
        } else next.push(v);
      }
      vRef.current = next;
      setVisitors([...vRef.current]);
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

  function tap(id: number) {
    const v = vRef.current.find((x) => x.id === id);
    if (!v) return;
    if (v.allowed) {
      scoreRef.current += 1;
      setFlash("good");
    } else {
      scoreRef.current = Math.max(0, scoreRef.current - 1);
      setFlash("bad");
    }
    vRef.current = vRef.current.filter((x) => x.id !== id);
    setVisitors([...vRef.current]);
    setScore(scoreRef.current);
    setTimeout(() => setFlash(""), 160);
  }

  if (!running) {
    return (
      <StartScreen icon="🛎️" name="Receptionist" blurb="🟢 badges? Buzz them in (tap). 🔴 badges? Let them walk past — tap one by mistake and security gets mad." onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Cleared" value={score} right={`${left.toFixed(1)}s`} />
      <div className={`relative h-72 w-full overflow-hidden rounded-2xl bg-slate-800/40 ${flash === "good" ? "ring-2 ring-accent-2" : flash === "bad" ? "ring-2 ring-danger" : ""}`}>
        <div className="absolute inset-y-0 right-0 w-2 bg-white/20" />
        {visitors.map((v) => (
          <button key={v.id} onPointerDown={() => tap(v.id)} className="absolute top-1/2 -translate-y-1/2" style={{ left: `${v.x}%` }}>
            <div className="flex flex-col items-center">
              <span className="text-3xl">🧑</span>
              <span className={`mt-0.5 h-3 w-8 rounded ${v.allowed ? "bg-emerald-400" : "bg-rose-500"}`} />
            </div>
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-muted">Tap green badges only · 🟢 +1 · 🔴 -1</p>
    </div>
  );
}
