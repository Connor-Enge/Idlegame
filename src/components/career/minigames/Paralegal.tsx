"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 14;
const CASES = ["Smith v. Jones", "Roe v. Wade", "Brown v. Board", "Marbury v. Madison", "Plessy v. Ferguson", "Miranda v. Arizona", "Loving v. Virginia", "Bush v. Gore"];

function newRound() {
  const picked = [...CASES].sort(() => Math.random() - 0.5).slice(0, 4);
  return picked.map((name) => ({ name, year: 1950 + Math.floor(Math.random() * 73) }));
}

export default function Paralegal({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [cards, setCards] = useState(newRound);
  const [taken, setTaken] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [wrong, setWrong] = useState(false);
  const cardsRef = useRef(cards);
  const takenRef = useRef<number[]>([]);
  const scoreRef = useRef(0);

  function nextRound() {
    cardsRef.current = newRound();
    takenRef.current = [];
    setCards(cardsRef.current);
    setTaken([]);
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
    if (takenRef.current.includes(i)) return;
    // Required next card: smallest year among not-yet-taken.
    const remaining = cardsRef.current
      .map((c, idx) => ({ idx, year: c.year }))
      .filter((c) => !takenRef.current.includes(c.idx));
    const want = remaining.reduce((a, b) => (a.year <= b.year ? a : b)).idx;
    if (i === want) {
      takenRef.current = [...takenRef.current, i];
      setTaken([...takenRef.current]);
      if (takenRef.current.length === cardsRef.current.length) {
        scoreRef.current += 1;
        setScore(scoreRef.current);
        nextRound();
      }
    } else {
      setWrong(true);
      setTimeout(() => setWrong(false), 200);
    }
  }

  if (!running) {
    return (
      <StartScreen icon="⚖️" name="Paralegal" blurb="Tap the cases in chronological order, earliest first. Wrong order and the whole stack stays." onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Filed" value={score} right={`${left.toFixed(1)}s`} />
      <div className={`grid grid-cols-2 gap-3 ${wrong ? "ring-2 ring-danger rounded-2xl" : ""}`}>
        {cards.map((c, i) => {
          const done = taken.includes(i);
          return (
            <button key={i} disabled={done} onPointerDown={() => tap(i)} className={`flex flex-col items-start gap-1 rounded-2xl p-3 text-left ${done ? "bg-accent-2/20 opacity-60" : "bg-white/5 active:bg-white/10"}`}>
              <span className="text-xs text-muted">{done ? `#${taken.indexOf(i) + 1} filed` : "tap to file"}</span>
              <span className="text-sm font-bold">{c.name}</span>
              <span className="text-xl font-black text-accent">{c.year}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-center text-xs text-muted">Earliest year first → latest year last</p>
    </div>
  );
}
