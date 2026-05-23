"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 14;
const ROLES = ["🧑‍💻", "🧑‍🎨", "🧑‍💼", "🧑‍🔬"];
const GRID = 12;

function newRound() {
  const role = ROLES[Math.floor(Math.random() * ROLES.length)];
  const need = 2 + Math.floor(Math.random() * 3); // hire 2..4
  const grid: string[] = [];
  for (let i = 0; i < GRID; i++) {
    grid.push(Math.random() < 0.45 ? role : ROLES[Math.floor(Math.random() * ROLES.length)]);
  }
  // Guarantee at least `need` of the role exist in the grid.
  let count = grid.filter((g) => g === role).length;
  while (count < need) {
    const i = Math.floor(Math.random() * GRID);
    if (grid[i] !== role) { grid[i] = role; count++; }
  }
  return { role, need, grid };
}

export default function HRCoordinator({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [round, setRound] = useState(newRound);
  const [hired, setHired] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [wrong, setWrong] = useState(false);
  const roundRef = useRef(round);
  const hiredRef = useRef<number[]>([]);
  const scoreRef = useRef(0);

  function nextRound() {
    roundRef.current = newRound();
    hiredRef.current = [];
    setRound(roundRef.current);
    setHired([]);
  }

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

  function tap(i: number) {
    if (hiredRef.current.includes(i)) return;
    if (roundRef.current.grid[i] !== roundRef.current.role) {
      setWrong(true);
      setTimeout(() => setWrong(false), 180);
      return;
    }
    hiredRef.current = [...hiredRef.current, i];
    setHired([...hiredRef.current]);
    if (hiredRef.current.length === roundRef.current.need) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      nextRound();
    }
  }

  if (!running) {
    return (
      <StartScreen icon="👥" name="HR Coordinator" blurb="Hire the exact headcount the brief asks for — tap only the matching role, no more, no less." onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Filled" value={score} right={`${left.toFixed(1)}s`} />
      <div className={`mb-3 rounded-2xl bg-white/10 py-3 text-center text-lg font-bold ${wrong ? "ring-2 ring-danger" : ""}`}>
        Hire <span className="text-accent">{round.need}</span> <span className="text-2xl">{round.role}</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {round.grid.map((face, i) => (
          <button
            key={i}
            onPointerDown={() => tap(i)}
            className={`flex h-16 items-center justify-center rounded-xl text-2xl transition ${hired.includes(i) ? "bg-accent-2/30 opacity-60" : "bg-white/5 active:bg-white/10"}`}
          >
            {face}
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-muted">{hired.length}/{round.need} hired</p>
    </div>
  );
}
