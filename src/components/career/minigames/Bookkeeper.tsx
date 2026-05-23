"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 14;
const PAIRS = 4;

type Side = "inv" | "pay";

function newRound() {
  const amounts = new Set<number>();
  while (amounts.size < PAIRS) amounts.add(20 + Math.floor(Math.random() * 80));
  const invoices = [...amounts];
  const payments = [...amounts].sort(() => Math.random() - 0.5);
  return { invoices, payments };
}

export default function Bookkeeper({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [round, setRound] = useState(newRound);
  const [matched, setMatched] = useState<Set<number>>(new Set()); // set of amounts already paired
  const [sel, setSel] = useState<{ side: Side; i: number } | null>(null);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [wrong, setWrong] = useState(false);
  const roundRef = useRef(round);
  const matchedRef = useRef<Set<number>>(new Set());
  const selRef = useRef<{ side: Side; i: number } | null>(null);
  const scoreRef = useRef(0);

  function nextRound() {
    roundRef.current = newRound();
    matchedRef.current = new Set();
    selRef.current = null;
    setRound(roundRef.current);
    setMatched(new Set());
    setSel(null);
  }

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

  function tap(side: Side, i: number) {
    const amt = side === "inv" ? roundRef.current.invoices[i] : roundRef.current.payments[i];
    if (matchedRef.current.has(amt)) return;
    if (!selRef.current) {
      selRef.current = { side, i };
      setSel({ side, i });
      return;
    }
    if (selRef.current.side === side) {
      // changed mind — replace selection
      selRef.current = { side, i };
      setSel({ side, i });
      return;
    }
    const otherAmt = selRef.current.side === "inv"
      ? roundRef.current.invoices[selRef.current.i]
      : roundRef.current.payments[selRef.current.i];
    if (amt === otherAmt) {
      matchedRef.current = new Set([...matchedRef.current, amt]);
      scoreRef.current += 1;
      setScore(scoreRef.current);
      setMatched(new Set(matchedRef.current));
      selRef.current = null;
      setSel(null);
      if (matchedRef.current.size >= PAIRS) nextRound();
    } else {
      setWrong(true);
      setTimeout(() => setWrong(false), 200);
      selRef.current = null;
      setSel(null);
    }
  }

  if (!running) {
    return (
      <StartScreen icon="📒" name="Bookkeeper" blurb="Tap an invoice, then the payment that matches its amount. Clear all four pairs to bank a round." onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Rounds" value={score} right={`${left.toFixed(1)}s`} />
      <div className={`grid grid-cols-2 gap-3 ${wrong ? "ring-2 ring-danger rounded-2xl" : ""}`}>
        <div>
          <div className="mb-1 text-[10px] uppercase text-muted">Invoices</div>
          <div className="space-y-2">
            {round.invoices.map((a, i) => {
              const done = matched.has(a);
              const picked = sel?.side === "inv" && sel.i === i;
              return (
                <button
                  key={i}
                  disabled={done}
                  onPointerDown={() => tap("inv", i)}
                  className={`w-full rounded-xl py-3 text-base font-bold transition ${done ? "bg-accent-2/20 opacity-50" : picked ? "bg-accent text-black" : "bg-white/5 active:bg-white/10"}`}
                >
                  ${a}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase text-muted">Payments</div>
          <div className="space-y-2">
            {round.payments.map((a, i) => {
              const done = matched.has(a);
              const picked = sel?.side === "pay" && sel.i === i;
              return (
                <button
                  key={i}
                  disabled={done}
                  onPointerDown={() => tap("pay", i)}
                  className={`w-full rounded-xl py-3 text-base font-bold transition ${done ? "bg-accent-2/20 opacity-50" : picked ? "bg-accent text-black" : "bg-white/5 active:bg-white/10"}`}
                >
                  ${a}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
