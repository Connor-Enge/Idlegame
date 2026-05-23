"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 13;
type Table = { state: "empty" | "menu" | "preparing" | "ready"; timer: number };

const PREP_TIME = 1.6;
const EMPTY_TO_MENU = 1.4;
const MENU_PATIENCE = 4.0;
const READY_FADE = 5.0;

function fresh(): Table {
  return { state: "empty", timer: EMPTY_TO_MENU };
}

export default function Waiter({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [tables, setTables] = useState<Table[]>([fresh(), fresh(), fresh()]);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const tRef = useRef<Table[]>(tables);
  const scoreRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const start = Date.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      tRef.current = tRef.current.map((t) => {
        const nt = { ...t, timer: t.timer - dt };
        if (nt.timer <= 0) {
          if (nt.state === "empty") return { state: "menu", timer: MENU_PATIENCE };
          if (nt.state === "menu") return fresh(); // patron walked away
          if (nt.state === "preparing") return { state: "ready", timer: READY_FADE };
          if (nt.state === "ready") return fresh(); // food cold, patron leaves
        }
        return nt;
      });
      setTables([...tRef.current]);
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

  function tap(i: number) {
    const t = tRef.current[i];
    if (t.state === "menu") {
      tRef.current[i] = { state: "preparing", timer: PREP_TIME };
      setTables([...tRef.current]);
    } else if (t.state === "ready") {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      tRef.current[i] = fresh();
      setTables([...tRef.current]);
    }
  }

  if (!running) {
    return (
      <StartScreen icon="🍷" name="Waiter" blurb="Tap a table holding a menu 📋 to take the order, then tap it again when the plate 🍽️ is ready. Don't keep them waiting!" onStart={() => setRunning(true)} />
    );
  }

  const labels: Record<Table["state"], string> = { empty: "🪑", menu: "📋", preparing: "⌛", ready: "🍽️" };
  const tones: Record<Table["state"], string> = {
    empty: "bg-white/5",
    menu: "bg-amber-300/30",
    preparing: "bg-white/10",
    ready: "bg-emerald-400/30",
  };

  return (
    <div>
      <ScoreStrip label="Served" value={score} right={`${left.toFixed(1)}s`} />
      <div className="grid grid-cols-3 gap-3">
        {tables.map((t, i) => (
          <button key={i} onPointerDown={() => tap(i)} className={`flex h-32 flex-col items-center justify-center rounded-2xl text-4xl transition active:brightness-110 ${tones[t.state]}`}>
            <span>{labels[t.state]}</span>
            {(t.state === "menu" || t.state === "ready") && (
              <span className="mt-2 text-[10px] uppercase text-muted">tap!</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
