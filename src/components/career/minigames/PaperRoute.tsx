"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 9; // seconds

export default function PaperRoute({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [delivered, setDelivered] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [pos, setPos] = useState({ x: 10, y: 30 });
  const deliveredRef = useRef(0);
  const motion = useRef({ x: 10, y: 30, vx: 38, dir: 1 });

  function relocate() {
    motion.current.y = 12 + Math.random() * 64;
    motion.current.x = Math.random() * 70;
    motion.current.vx = 38 + deliveredRef.current * 3; // speeds up as you go
    setPos({ x: motion.current.x, y: motion.current.y });
  }

  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const m = motion.current;
      m.x += m.dir * m.vx * dt;
      if (m.x >= 78) { m.x = 78; m.dir = -1; }
      if (m.x <= 0) { m.x = 0; m.dir = 1; }
      setPos({ x: m.x, y: m.y });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const ticker = setInterval(() => {
      const rem = Math.max(0, DURATION - (Date.now() - start) / 1000);
      setLeft(rem);
      if (rem <= 0) {
        clearInterval(ticker);
        cancelAnimationFrame(raf);
        onFinish(Math.max(1, deliveredRef.current));
      }
    }, 100);
    relocate();
    return () => { cancelAnimationFrame(raf); clearInterval(ticker); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  if (!running) {
    return (
      <StartScreen
        icon="📰"
        name="Paper Route"
        blurb="Tap each porch to land the paper. They move faster with every delivery — be quick!"
        onStart={() => setRunning(true)}
      />
    );
  }

  return (
    <div>
      <ScoreStrip label="Delivered" value={delivered} right={`${left.toFixed(1)}s`} />
      <div className="relative h-72 w-full overflow-hidden rounded-2xl bg-sky-900/30">
        <button
          onPointerDown={() => {
            deliveredRef.current += 1;
            setDelivered(deliveredRef.current);
            relocate();
          }}
          style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          className="absolute flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-200/20 text-3xl active:scale-95"
        >
          🏠
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-muted">Tap the house to toss the paper</p>
    </div>
  );
}
