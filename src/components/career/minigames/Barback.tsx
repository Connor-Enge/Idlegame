"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 12;
type Cube = { id: number; x: number; y: number };

export default function Barback({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [cubes, setCubes] = useState<Cube[]>([]);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const cubesRef = useRef<Cube[]>([]);
  const scoreRef = useRef(0);
  const idRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    let spawn = 0;
    const start = Date.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      spawn += dt;
      if (spawn > 0.55) {
        spawn = 0;
        cubesRef.current.push({ id: idRef.current++, x: Math.random() * 86, y: -8 });
      }
      for (const c of cubesRef.current) c.y += 38 * dt;
      cubesRef.current = cubesRef.current.filter((c) => c.y < 102);
      setCubes([...cubesRef.current]);
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

  function catchCube(id: number) {
    if (!cubesRef.current.some((c) => c.id === id)) return;
    cubesRef.current = cubesRef.current.filter((c) => c.id !== id);
    scoreRef.current += 1;
    setScore(scoreRef.current);
    setCubes([...cubesRef.current]);
  }

  if (!running) {
    return (
      <StartScreen icon="🧊" name="Barback" blurb="Ice keeps spilling from the chute. Tap each cube before it hits the floor!" onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Caught" value={score} right={`${left.toFixed(1)}s`} />
      <div className="relative h-72 w-full overflow-hidden rounded-2xl bg-sky-950/40">
        <div className="absolute inset-x-0 bottom-0 h-2 bg-stone-600/60" />
        {cubes.map((c) => (
          <button key={c.id} onPointerDown={() => catchCube(c.id)} className="absolute h-10 w-10 text-2xl" style={{ left: `${c.x}%`, top: `${c.y}%` }}>
            🧊
          </button>
        ))}
      </div>
    </div>
  );
}
