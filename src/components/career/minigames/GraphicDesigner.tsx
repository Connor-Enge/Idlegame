"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 13;

// Each round picks a target color; the four swatches are near-shades plus the
// exact target. The eye-test is reading colors quickly under time pressure.
function randomHue() {
  return Math.floor(Math.random() * 360);
}
function color(h: number, s = 70, l = 55) {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function newRound() {
  const baseHue = randomHue();
  const target = color(baseHue);
  const options = [
    color(baseHue),
    color((baseHue + 18) % 360),
    color((baseHue + 36) % 360, 60, 50),
    color((baseHue + 350) % 360, 55, 60),
  ];
  // shuffle and remember which slot has the exact target
  const idxs = [0, 1, 2, 3];
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
  }
  const shuffled = idxs.map((i) => options[i]);
  const correct = idxs.indexOf(0);
  return { target, options: shuffled, correct };
}

export default function GraphicDesigner({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [round, setRound] = useState(newRound);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [flash, setFlash] = useState<"" | "good" | "bad">("");
  const roundRef = useRef(round);
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

  function pick(i: number) {
    if (i === roundRef.current.correct) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      setFlash("good");
    } else setFlash("bad");
    setTimeout(() => {
      setFlash("");
      roundRef.current = newRound();
      setRound(roundRef.current);
    }, 200);
  }

  if (!running) {
    return (
      <StartScreen icon="🎨" name="Color Match" blurb="One of the four swatches matches the target exactly. Tap it — the others are close, not the same." onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Matched" value={score} right={`${left.toFixed(1)}s`} />
      <div className={`mb-3 rounded-2xl bg-white/10 p-3 text-center ${flash === "good" ? "ring-2 ring-accent-2" : flash === "bad" ? "ring-2 ring-danger" : ""}`}>
        <div className="text-[10px] uppercase text-muted">Target</div>
        <div className="mx-auto mt-2 h-16 w-16 rounded-2xl border-2 border-white/40" style={{ background: round.target }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {round.options.map((c, i) => (
          <button key={i} onPointerDown={() => pick(i)} className="h-24 rounded-2xl border-2 border-white/10 active:brightness-110" style={{ background: c }} />
        ))}
      </div>
    </div>
  );
}
