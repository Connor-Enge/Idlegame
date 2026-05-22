"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const TILES = [
  { id: 0, on: "bg-rose-400", off: "bg-rose-500/30" },
  { id: 1, on: "bg-sky-400", off: "bg-sky-500/30" },
  { id: 2, on: "bg-amber-400", off: "bg-amber-500/30" },
  { id: 3, on: "bg-emerald-400", off: "bg-emerald-500/30" },
];
const MAX_ROUNDS = 9;

export default function Memory({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [seq, setSeq] = useState<number[]>([]);
  const [flash, setFlash] = useState<number | null>(null);
  const [showing, setShowing] = useState(false);
  const [inputIdx, setInputIdx] = useState(0);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);

  function playSequence(s: number[]) {
    setShowing(true);
    setInputIdx(0);
    let i = 0;
    const step = () => {
      setFlash(s[i]);
      setTimeout(() => {
        setFlash(null);
        i += 1;
        if (i < s.length) setTimeout(step, 220);
        else setShowing(false);
      }, 420);
    };
    setTimeout(step, 400);
  }

  function nextRound(prev: number[]) {
    const s = [...prev, Math.floor(Math.random() * 4)];
    setSeq(s);
    playSequence(s);
  }

  useEffect(() => {
    if (running) nextRound([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function tap(id: number) {
    if (showing || !running) return;
    if (id === seq[inputIdx]) {
      const ni = inputIdx + 1;
      if (ni >= seq.length) {
        // Completed the round — award its length, advance or finish.
        const ns = scoreRef.current + seq.length * 3;
        scoreRef.current = ns;
        setScore(ns);
        if (seq.length >= MAX_ROUNDS) onFinish(ns);
        else setTimeout(() => nextRound(seq), 450);
      } else {
        setInputIdx(ni);
      }
    } else {
      // Wrong tile — end the game with whatever's banked (min 1).
      onFinish(Math.max(1, scoreRef.current));
    }
  }

  if (!running) {
    return (
      <StartScreen
        icon="🧠"
        name="Memory Match"
        blurb="Watch the tiles light up, then repeat the sequence. It grows each round — go as far as you can."
        onStart={() => setRunning(true)}
      />
    );
  }

  return (
    <div>
      <ScoreStrip label="Points" value={score} right={showing ? "Watch…" : `Length ${seq.length}`} />
      <div className="grid grid-cols-2 gap-3">
        {TILES.map((t) => (
          <button
            key={t.id}
            disabled={showing}
            onPointerDown={() => tap(t.id)}
            className={`h-32 rounded-2xl transition ${flash === t.id ? t.on : t.off} ${showing ? "" : "active:brightness-125"}`}
          />
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-muted">{showing ? "Memorize the pattern" : "Your turn — repeat it"}</p>
    </div>
  );
}
