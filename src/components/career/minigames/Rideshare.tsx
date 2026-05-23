"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 13;
const CORNERS = [0, 1, 2, 3];

function pickPair() {
  const a = Math.floor(Math.random() * 4);
  let b = Math.floor(Math.random() * 4);
  while (b === a) b = Math.floor(Math.random() * 4);
  return { pickup: a, dropoff: b };
}

export default function Rideshare({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [ride, setRide] = useState(pickPair);
  const [phase, setPhase] = useState<"pickup" | "dropoff">("pickup");
  const [surge, setSurge] = useState(() => Math.floor(Math.random() * 4));
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [wrong, setWrong] = useState(false);
  const phaseRef = useRef<"pickup" | "dropoff">("pickup");
  const rideRef = useRef(ride);
  const surgeRef = useRef(surge);
  const wasSurge = useRef(false);
  const scoreRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    const iv = setInterval(() => {
      const rem = Math.max(0, DURATION - (Date.now() - start) / 1000);
      setLeft(rem);
      if (rem <= 0) { clearInterval(iv); onFinish(Math.max(1, scoreRef.current)); }
    }, 100);
    // periodically shuffle the surge corner
    const surgeRoll = setInterval(() => {
      const ns = Math.floor(Math.random() * 4);
      surgeRef.current = ns;
      setSurge(ns);
    }, 2400);
    return () => { clearInterval(iv); clearInterval(surgeRoll); };
  }, [running, onFinish]);

  function tap(corner: number) {
    if (phaseRef.current === "pickup") {
      if (corner === rideRef.current.pickup) {
        wasSurge.current = corner === surgeRef.current;
        phaseRef.current = "dropoff";
        setPhase("dropoff");
      } else {
        setWrong(true); setTimeout(() => setWrong(false), 160);
      }
    } else {
      if (corner === rideRef.current.dropoff) {
        scoreRef.current += wasSurge.current ? 2 : 1;
        setScore(scoreRef.current);
        const next = pickPair();
        rideRef.current = next;
        phaseRef.current = "pickup";
        setRide(next);
        setPhase("pickup");
      } else {
        setWrong(true); setTimeout(() => setWrong(false), 160);
      }
    }
  }

  if (!running) {
    return (
      <StartScreen icon="🚗" name="Rideshare" blurb="Tap the pickup corner, then the drop-off corner. Pick up from the ✨ surge corner for double pay." onStart={() => setRunning(true)} />
    );
  }

  const marker = (corner: number) => {
    if (phase === "pickup" && corner === ride.pickup) return "🧍";
    if (phase === "dropoff" && corner === ride.dropoff) return "🎯";
    return "";
  };

  return (
    <div>
      <ScoreStrip label="Fares" value={score} right={`${left.toFixed(1)}s`} />
      <div className="mb-3 text-center text-xs text-muted">{phase === "pickup" ? "Pick up the passenger" : "Drop off the passenger"}</div>
      <div className={`grid grid-cols-2 gap-3 ${wrong ? "ring-2 ring-danger" : ""}`}>
        {CORNERS.map((c) => (
          <button key={c} onPointerDown={() => tap(c)} className={`relative flex h-32 items-center justify-center rounded-2xl text-4xl active:brightness-110 ${c === surge ? "bg-amber-300/30" : "bg-white/5"}`}>
            {marker(c) || "·"}
            {c === surge && <span className="absolute right-2 top-2 text-xs font-bold text-amber-300">✨ SURGE</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
