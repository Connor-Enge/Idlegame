"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 12;
const ROWS = ["A", "B", "C", "D"];
const COLS = 5;

function pickSeat() {
  return `${ROWS[Math.floor(Math.random() * ROWS.length)]}${1 + Math.floor(Math.random() * COLS)}`;
}

export default function Usher({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [ticket, setTicket] = useState(pickSeat());
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [wrong, setWrong] = useState(false);
  const ticketRef = useRef(ticket);
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

  function tap(seat: string) {
    if (seat === ticketRef.current) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      const nt = pickSeat();
      ticketRef.current = nt;
      setTicket(nt);
    } else {
      setWrong(true);
      setTimeout(() => setWrong(false), 180);
    }
  }

  if (!running) {
    return (
      <StartScreen icon="🎬" name="Movie Usher" blurb="Each ticket shows a seat. Find the matching seat on the screen and tap it — quickly!" onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Seated" value={score} right={`${left.toFixed(1)}s`} />
      <div className={`mb-3 rounded-2xl bg-white/10 py-5 text-center text-3xl font-black ${wrong ? "ring-2 ring-danger" : ""}`}>
        🎟️ Seat {ticket}
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {ROWS.flatMap((r) =>
          Array.from({ length: COLS }, (_, i) => `${r}${i + 1}`).map((s) => (
            <button key={s} onPointerDown={() => tap(s)} className="rounded-md bg-accent/20 py-3 text-[11px] font-bold text-accent active:bg-accent/40">
              {s}
            </button>
          )),
        )}
      </div>
    </div>
  );
}
