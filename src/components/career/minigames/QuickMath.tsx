"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 12; // seconds

interface Problem {
  text: string;
  answer: number;
  choices: number[];
}

function makeProblem(): Problem {
  const op = Math.random() < 0.5 ? "+" : "-";
  let a = 2 + Math.floor(Math.random() * 18);
  let b = 2 + Math.floor(Math.random() * 18);
  if (op === "-" && b > a) [a, b] = [b, a];
  const answer = op === "+" ? a + b : a - b;
  const choices = new Set<number>([answer]);
  while (choices.size < 4) {
    const delta = Math.floor(Math.random() * 9) - 4;
    const c = answer + (delta === 0 ? 5 : delta);
    if (c >= 0) choices.add(c);
  }
  return { text: `${a} ${op} ${b}`, answer, choices: shuffle([...choices]) };
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function QuickMath({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [problem, setProblem] = useState<Problem>(() => makeProblem());
  const [solved, setSolved] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [wrong, setWrong] = useState(false);
  const solvedRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    const iv = setInterval(() => {
      const rem = Math.max(0, DURATION - (Date.now() - start) / 1000);
      setLeft(rem);
      if (rem <= 0) {
        clearInterval(iv);
        onFinish(Math.max(1, solvedRef.current));
      }
    }, 100);
    return () => clearInterval(iv);
  }, [running, onFinish]);

  function answer(c: number) {
    if (c === problem.answer) {
      solvedRef.current += 1;
      setSolved(solvedRef.current);
      setProblem(makeProblem());
    } else {
      setWrong(true);
      setTimeout(() => setWrong(false), 250);
    }
  }

  if (!running) {
    return (
      <StartScreen
        icon="🧮"
        name="Quick Maths"
        blurb="Solve as many sums as you can in 12 seconds. Pick the right answer to move on."
        onStart={() => setRunning(true)}
      />
    );
  }

  return (
    <div>
      <ScoreStrip label="Solved" value={solved} right={`${left.toFixed(1)}s`} />
      <div className={`mb-4 rounded-2xl bg-white/10 py-8 text-center text-4xl font-black ${wrong ? "text-danger" : ""}`}>
        {problem.text} = ?
      </div>
      <div className="grid grid-cols-2 gap-3">
        {problem.choices.map((c, i) => (
          <button
            key={i}
            onPointerDown={() => answer(c)}
            className="rounded-xl bg-accent/20 py-5 text-xl font-bold text-accent active:bg-accent/40"
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
