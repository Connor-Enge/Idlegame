"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const ROUNDS = 5;

export default function Reaction({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [state, setState] = useState<"wait" | "go" | "early">("wait");
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const goAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function armRound() {
    setState("wait");
    const delay = 900 + Math.random() * 2200;
    timer.current = setTimeout(() => {
      goAt.current = Date.now();
      setState("go");
    }, delay);
  }

  useEffect(() => {
    if (running) armRound();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [running]);

  function finishRound(gained: number) {
    const ns = scoreRef.current + gained;
    scoreRef.current = ns;
    setScore(ns);
    const nr = round + 1;
    setRound(nr);
    if (nr >= ROUNDS) onFinish(Math.max(1, ns));
    else armRound();
  }

  function tap() {
    if (state === "wait") {
      // Tapped too early — void this round (0 points) and re-arm.
      if (timer.current) clearTimeout(timer.current);
      setState("early");
      setTimeout(() => finishRound(0), 600);
    } else if (state === "go") {
      const ms = Date.now() - goAt.current;
      // <250ms = 5 pts, scaling down to 1 by ~700ms.
      const gained = Math.max(1, Math.round(5 - (ms - 250) / 110));
      finishRound(Math.min(5, gained));
    }
  }

  if (!running) {
    return (
      <StartScreen
        icon="⚡"
        name="Quick Reflex"
        blurb="Wait for the panel to turn green, then tap as fast as you can. Don't jump the gun!"
        onStart={() => setRunning(true)}
      />
    );
  }

  const bg =
    state === "go" ? "bg-accent text-black" : state === "early" ? "bg-danger text-white" : "bg-white/10 text-muted";
  const label = state === "go" ? "TAP!" : state === "early" ? "Too early!" : "Wait…";

  return (
    <div>
      <ScoreStrip label="Points" value={score} right={`Round ${Math.min(round + 1, ROUNDS)}/${ROUNDS}`} />
      <button
        onPointerDown={tap}
        className={`flex h-72 w-full select-none items-center justify-center rounded-3xl text-3xl font-black ${bg}`}
      >
        {label}
      </button>
    </div>
  );
}
