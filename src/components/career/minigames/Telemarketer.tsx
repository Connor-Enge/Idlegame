"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 12;
const DECAY = 9; // interest lost per second
const WINDOW = 0.75; // window length in seconds
const SPIKE_BONUS = 28; // interest restored on a successful pitch

export default function Telemarketer({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [interest, setInterest] = useState(100);
  const [windowOpen, setWindowOpen] = useState(false);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [judge, setJudge] = useState("");
  const intRef = useRef(100);
  const winRef = useRef(false);
  const winUntil = useRef(0);
  const nextWindow = useRef(0);
  const scoreRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const start = Date.now();
    nextWindow.current = (Date.now() - start) / 1000 + 1.0;
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const t = (Date.now() - start) / 1000;
      intRef.current = Math.max(0, intRef.current - DECAY * dt);
      if (intRef.current <= 0) {
        // hang-up — fresh customer
        intRef.current = 100;
      }
      // window timing
      if (!winRef.current && t >= nextWindow.current) {
        winRef.current = true;
        winUntil.current = t + WINDOW;
        setWindowOpen(true);
      }
      if (winRef.current && t > winUntil.current) {
        winRef.current = false;
        setWindowOpen(false);
        nextWindow.current = t + 1.0 + Math.random() * 1.3;
      }
      setInterest(intRef.current);
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

  function pitch() {
    if (winRef.current) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      intRef.current = Math.min(100, intRef.current + SPIKE_BONUS);
      winRef.current = false;
      setWindowOpen(false);
      setJudge("Hooked!");
      setTimeout(() => setJudge(""), 220);
    } else {
      // Tapping cold loses interest faster.
      intRef.current = Math.max(0, intRef.current - 6);
      setJudge("Annoyed");
      setTimeout(() => setJudge(""), 200);
    }
  }

  if (!running) {
    return (
      <StartScreen icon="☎️" name="Telemarketer" blurb="Watch for the 💚 PITCH NOW window — tap during it for a sale. Tap any other time and they get annoyed." onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Sales" value={score} right={`${left.toFixed(1)}s`} />
      <div className="mb-3 rounded-2xl bg-white/10 p-4">
        <div className="mb-1 flex justify-between text-[11px] text-muted">
          <span>Customer interest</span>
          <span>{Math.round(interest)}/100</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-white/10">
          <div className={`h-full transition-all ${interest < 30 ? "bg-danger" : "bg-accent-2"}`} style={{ width: `${interest}%` }} />
        </div>
        <div className="mt-2 text-center text-sm font-bold">{judge || "…"}</div>
      </div>
      <button onPointerDown={pitch} className={`flex h-40 w-full items-center justify-center rounded-3xl text-2xl font-black transition ${windowOpen ? "bg-accent text-black" : "bg-white/10 text-muted"}`}>
        {windowOpen ? "💚 PITCH NOW!" : "Wait for the window…"}
      </button>
    </div>
  );
}
