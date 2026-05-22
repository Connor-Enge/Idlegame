"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 12;

export default function Babysitter({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [patience, setPatience] = useState([100, 100, 100]);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const pRef = useRef([100, 100, 100]);
  const rates = useRef([10, 13, 16]);
  const scoreRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      let content = 0;
      pRef.current = pRef.current.map((p, i) => {
        const np = Math.max(0, p - rates.current[i] * dt);
        if (np > 0) content++;
        return np;
      });
      scoreRef.current += content * dt * 1.1;
      setScore(scoreRef.current);
      setPatience([...pRef.current]);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const ticker = setInterval(() => {
      const rem = Math.max(0, DURATION - (Date.now() - start) / 1000);
      setLeft(rem);
      if (rem <= 0) { clearInterval(ticker); cancelAnimationFrame(raf); onFinish(Math.max(1, Math.round(scoreRef.current))); }
    }, 100);
    return () => { cancelAnimationFrame(raf); clearInterval(ticker); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function soothe(i: number) {
    pRef.current[i] = 100;
    setPatience([...pRef.current]);
  }

  if (!running) {
    return (
      <StartScreen icon="🍼" name="Babysitter" blurb="Three babies, three patience bars draining at once. Tap a baby to soothe it — keep them all happy to bank points." onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Happy time" value={Math.round(score)} right={`${left.toFixed(1)}s`} />
      <div className="grid grid-cols-3 gap-3">
        {patience.map((p, i) => (
          <button key={i} onPointerDown={() => soothe(i)} className="flex flex-col items-center gap-2 rounded-2xl bg-white/5 p-3 active:bg-white/10">
            <span className="text-4xl">{p <= 0 ? "😭" : p < 35 ? "😟" : "😀"}</span>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div className={`h-full ${p < 35 ? "bg-danger" : "bg-accent-2"}`} style={{ width: `${p}%` }} />
            </div>
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-muted">Tap a baby to calm it before it cries</p>
    </div>
  );
}
