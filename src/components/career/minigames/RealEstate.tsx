"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 13;
const SLOTS = 4;

function randomPrice() {
  return 240 + Math.floor(Math.random() * 760); // $240k..$1000k
}

export default function RealEstate({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [offers, setOffers] = useState<number[]>(() => Array.from({ length: SLOTS }, randomPrice));
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [flash, setFlash] = useState<"" | "good" | "bad">("");
  const offersRef = useRef<number[]>(offers);
  const scoreRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    // periodically replace one offer with a new random price
    const shuffler = setInterval(() => {
      const i = Math.floor(Math.random() * SLOTS);
      offersRef.current[i] = randomPrice();
      setOffers([...offersRef.current]);
    }, 850);
    const iv = setInterval(() => {
      const rem = Math.max(0, DURATION - (Date.now() - start) / 1000);
      setLeft(rem);
      if (rem <= 0) { clearInterval(iv); clearInterval(shuffler); onFinish(Math.max(1, scoreRef.current)); }
    }, 100);
    return () => { clearInterval(iv); clearInterval(shuffler); };
  }, [running, onFinish]);

  function accept(i: number) {
    const max = Math.max(...offersRef.current);
    if (offersRef.current[i] === max) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      setFlash("good");
    } else {
      scoreRef.current = Math.max(0, scoreRef.current - 1);
      setScore(scoreRef.current);
      setFlash("bad");
    }
    offersRef.current[i] = randomPrice();
    setOffers([...offersRef.current]);
    setTimeout(() => setFlash(""), 180);
  }

  if (!running) {
    return (
      <StartScreen icon="🏡" name="Bidding War" blurb="Offers change every second. Always accept the highest visible offer. Lock in a lower one and the seller blames you!" onStart={() => setRunning(true)} />
    );
  }

  const max = Math.max(...offers);

  return (
    <div>
      <ScoreStrip label="Closed" value={score} right={`${left.toFixed(1)}s`} />
      <div className={`grid grid-cols-2 gap-3 ${flash === "good" ? "ring-2 ring-accent-2 rounded-2xl" : flash === "bad" ? "ring-2 ring-danger rounded-2xl" : ""}`}>
        {offers.map((p, i) => (
          <button key={i} onPointerDown={() => accept(i)} className={`flex flex-col items-center gap-1 rounded-2xl p-4 active:brightness-110 ${p === max ? "bg-emerald-400/20" : "bg-white/5"}`}>
            <span className="text-2xl">🏠</span>
            <span className="text-xl font-black text-accent-2">${p}k</span>
            {p === max && <span className="text-[10px] font-bold text-emerald-300">HIGH</span>}
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-muted">Tap the highest offer — wrong pick costs you</p>
    </div>
  );
}
