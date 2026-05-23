"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 16;
const HEADLINES = [
  "Buy One Get One Free",
  "Limited Time Offer Today",
  "Now Open All Weekend",
  "Hot New Deal Inside",
  "Save Big This Summer",
  "Free Shipping On Orders",
  "Join Now Save Later",
  "Best Prices Of Year",
];

function pickHeadline() {
  return HEADLINES[Math.floor(Math.random() * HEADLINES.length)];
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Copywriter({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [headline, setHeadline] = useState<string>(pickHeadline);
  const [shuffled, setShuffled] = useState<string[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [wrong, setWrong] = useState(false);
  const wordsRef = useRef<string[]>([]);
  const shuffledRef = useRef<string[]>([]);
  const pickedRef = useRef<number[]>([]);
  const scoreRef = useRef(0);

  function nextRound() {
    const h = pickHeadline();
    wordsRef.current = h.split(" ");
    shuffledRef.current = shuffle(wordsRef.current.map((w, i) => `${i}:${w}`));
    pickedRef.current = [];
    setHeadline(h);
    setShuffled(shuffledRef.current);
    setPicked([]);
  }

  useEffect(() => {
    if (!running) return;
    nextRound();
    const start = Date.now();
    const iv = setInterval(() => {
      const rem = Math.max(0, DURATION - (Date.now() - start) / 1000);
      setLeft(rem);
      if (rem <= 0) { clearInterval(iv); onFinish(Math.max(1, scoreRef.current)); }
    }, 100);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function tap(slotIdx: number) {
    if (pickedRef.current.includes(slotIdx)) return;
    const tag = shuffledRef.current[slotIdx];
    const originalIdx = parseInt(tag.split(":")[0], 10);
    if (originalIdx === pickedRef.current.length) {
      pickedRef.current = [...pickedRef.current, slotIdx];
      setPicked([...pickedRef.current]);
      if (pickedRef.current.length === wordsRef.current.length) {
        scoreRef.current += 1;
        setScore(scoreRef.current);
        nextRound();
      }
    } else {
      pickedRef.current = [];
      setPicked([]);
      setWrong(true);
      setTimeout(() => setWrong(false), 200);
    }
  }

  if (!running) {
    return (
      <StartScreen icon="✍️" name="Copywriter" blurb="The headline has been scrambled. Tap the words in order to put it back together." onStart={() => setRunning(true)} />
    );
  }

  const built = pickedRef.current.map((idx) => shuffled[idx].split(":")[1]).join(" ");

  return (
    <div>
      <ScoreStrip label="Headlines" value={score} right={`${left.toFixed(1)}s`} />
      <div className="mb-3 rounded-2xl bg-white/10 p-3 text-center">
        <div className="text-[10px] uppercase text-muted">Goal</div>
        <div className="mt-1 text-base font-bold text-accent-2">{headline}</div>
      </div>
      <div className={`mb-3 min-h-12 rounded-2xl bg-white/5 p-3 text-center text-base font-bold ${wrong ? "ring-2 ring-danger" : ""}`}>
        {built || <span className="text-muted">tap words below…</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {shuffled.map((tag, i) => {
          const word = tag.split(":")[1];
          const done = picked.includes(i);
          return (
            <button
              key={i}
              disabled={done}
              onPointerDown={() => tap(i)}
              className={`rounded-xl px-3 py-2 text-sm font-bold transition ${done ? "bg-accent-2/20 opacity-40" : "bg-accent/30 text-accent active:bg-accent/50"}`}
            >
              {word}
            </button>
          );
        })}
      </div>
    </div>
  );
}
