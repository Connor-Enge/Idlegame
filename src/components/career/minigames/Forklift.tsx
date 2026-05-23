"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 12;
const WIDTHS = [1, 2, 3]; // pallet widths in cells

function pickSlot() {
  return WIDTHS[Math.floor(Math.random() * WIDTHS.length)];
}
function pickCandidates(correct: number): number[] {
  const others = WIDTHS.filter((w) => w !== correct);
  const set = [correct, others[0], others[1]];
  for (let i = set.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [set[i], set[j]] = [set[j], set[i]];
  }
  return set;
}

export default function Forklift({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [slot, setSlot] = useState<number>(pickSlot());
  const [cands, setCands] = useState<number[]>(() => pickCandidates(slot));
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [wrong, setWrong] = useState(false);
  const slotRef = useRef(slot);
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

  function pick(w: number) {
    if (w === slotRef.current) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      const ns = pickSlot();
      slotRef.current = ns;
      setSlot(ns);
      setCands(pickCandidates(ns));
    } else {
      setWrong(true);
      setTimeout(() => setWrong(false), 180);
    }
  }

  function PalletBox({ w }: { w: number }) {
    return (
      <div className="flex gap-0.5">
        {Array.from({ length: w }).map((_, i) => (
          <div key={i} className="h-10 w-7 rounded bg-amber-700" />
        ))}
      </div>
    );
  }

  if (!running) {
    return (
      <StartScreen icon="🚜" name="Forklift" blurb="Pick the pallet that matches the open slot. Width matters!" onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Loaded" value={score} right={`${left.toFixed(1)}s`} />
      <div className={`mb-4 flex items-center justify-center rounded-2xl bg-stone-700/30 px-4 py-6 ${wrong ? "ring-2 ring-danger" : ""}`}>
        <div className="text-[10px] uppercase text-muted mr-3">Slot:</div>
        <div className="flex gap-0.5">
          {Array.from({ length: slot }).map((_, i) => (
            <div key={i} className="h-10 w-7 rounded border-2 border-dashed border-accent" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {cands.map((w, i) => (
          <button key={i} onPointerDown={() => pick(w)} className="flex h-20 items-center justify-center rounded-xl bg-accent/20 active:bg-accent/40">
            <PalletBox w={w} />
          </button>
        ))}
      </div>
    </div>
  );
}
