"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 7; // seconds
const CELLS = 9;

export default function Whack({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [active, setActive] = useState(-1);
  const [hits, setHits] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const hitsRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    // Move the target around on its own cadence.
    const mover = setInterval(() => setActive(Math.floor(Math.random() * CELLS)), 650);
    setActive(Math.floor(Math.random() * CELLS));
    const ticker = setInterval(() => {
      const rem = Math.max(0, DURATION - (Date.now() - start) / 1000);
      setLeft(rem);
      if (rem <= 0) {
        clearInterval(mover);
        clearInterval(ticker);
        onFinish(Math.max(1, hitsRef.current));
      }
    }, 100);
    return () => { clearInterval(mover); clearInterval(ticker); };
  }, [running, onFinish]);

  function tap(i: number) {
    if (i !== active) return;
    hitsRef.current += 1;
    setHits(hitsRef.current);
    setActive(Math.floor(Math.random() * CELLS)); // immediately relocate
  }

  if (!running) {
    return (
      <StartScreen
        icon="🎯"
        name="Target Rush"
        blurb="Tap the glowing tile before it jumps away. As many as you can in 7 seconds."
        onStart={() => setRunning(true)}
      />
    );
  }

  return (
    <div>
      <ScoreStrip label="Hits" value={hits} right={`${left.toFixed(1)}s`} />
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: CELLS }).map((_, i) => (
          <button
            key={i}
            onPointerDown={() => tap(i)}
            className={`h-24 rounded-2xl transition ${i === active ? "bg-accent active:brightness-110" : "bg-white/10"}`}
          />
        ))}
      </div>
    </div>
  );
}
