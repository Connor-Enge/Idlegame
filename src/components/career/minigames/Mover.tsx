"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 11;
const STEP = 14;

export default function Mover({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [boxes, setBoxes] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [wrong, setWrong] = useState<"L" | "R" | "">("");
  const lastSide = useRef<"L" | "R" | null>(null);
  const progRef = useRef(0);
  const boxesRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    const iv = setInterval(() => {
      const rem = Math.max(0, DURATION - (Date.now() - start) / 1000);
      setLeft(rem);
      if (rem <= 0) { clearInterval(iv); onFinish(Math.max(1, boxesRef.current)); }
    }, 100);
    return () => clearInterval(iv);
  }, [running, onFinish]);

  function step(side: "L" | "R") {
    if (lastSide.current === side) {
      progRef.current = Math.max(0, progRef.current - STEP * 0.5);
      setWrong(side);
      setTimeout(() => setWrong(""), 160);
    } else {
      progRef.current += STEP;
      if (progRef.current >= 100) {
        boxesRef.current += 1;
        setBoxes(boxesRef.current);
        progRef.current = 0;
        lastSide.current = null;
        setProgress(0);
        return;
      }
    }
    lastSide.current = side;
    setProgress(progRef.current);
  }

  if (!running) {
    return (
      <StartScreen icon="💪" name="Mover" blurb="Alternate left-right steps to carry each box. Double-tap the same side and you stumble!" onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Boxes" value={boxes} right={`${left.toFixed(1)}s`} />
      <div className="mb-3 h-3 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onPointerDown={() => step("L")} className={`h-32 rounded-2xl text-2xl font-bold transition ${wrong === "L" ? "bg-danger/40" : "bg-accent text-black"} active:brightness-90`}>
          🦵 Left
        </button>
        <button onPointerDown={() => step("R")} className={`h-32 rounded-2xl text-2xl font-bold transition ${wrong === "R" ? "bg-danger/40" : "bg-accent text-black"} active:brightness-90`}>
          Right 🦵
        </button>
      </div>
    </div>
  );
}
