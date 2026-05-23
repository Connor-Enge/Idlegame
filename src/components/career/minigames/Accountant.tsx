"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 14;
const PER_LEDGER = 4; // transactions per ledger
const TOLERANCE = 8;

function newLedger() {
  return Array.from({ length: PER_LEDGER }, () => 5 + Math.floor(Math.random() * 40));
}

export default function Accountant({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [txs, setTxs] = useState(newLedger);
  const [pos, setPos] = useState(0);
  const [debit, setDebit] = useState(0);
  const [credit, setCredit] = useState(0);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [flash, setFlash] = useState<"" | "good" | "bad">("");
  const txsRef = useRef(txs);
  const posRef = useRef(0);
  const debitRef = useRef(0);
  const creditRef = useRef(0);
  const scoreRef = useRef(0);

  function resetLedger() {
    txsRef.current = newLedger();
    posRef.current = 0;
    debitRef.current = 0;
    creditRef.current = 0;
    setTxs(txsRef.current);
    setPos(0);
    setDebit(0);
    setCredit(0);
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

  function allocate(side: "D" | "C") {
    const amt = txsRef.current[posRef.current];
    if (side === "D") debitRef.current += amt;
    else creditRef.current += amt;
    posRef.current += 1;
    setDebit(debitRef.current);
    setCredit(creditRef.current);
    setPos(posRef.current);
    if (posRef.current >= txsRef.current.length) {
      const diff = Math.abs(debitRef.current - creditRef.current);
      if (diff <= TOLERANCE) {
        scoreRef.current += 1;
        setScore(scoreRef.current);
        setFlash("good");
      } else setFlash("bad");
      setTimeout(() => { setFlash(""); resetLedger(); }, 400);
    }
  }

  const current = txs[pos];

  if (!running) {
    return (
      <StartScreen icon="🧮" name="Junior Accountant" blurb="Allocate each transaction to Debit or Credit. After four, the columns must balance within $8." onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Balanced" value={score} right={`${left.toFixed(1)}s`} />
      <div className={`mb-4 grid grid-cols-2 gap-3 rounded-2xl bg-white/10 p-3 text-center ${flash === "good" ? "ring-2 ring-accent-2" : flash === "bad" ? "ring-2 ring-danger" : ""}`}>
        <div>
          <div className="text-[10px] uppercase text-muted">Debit</div>
          <div className="text-2xl font-black text-accent">${debit}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-muted">Credit</div>
          <div className="text-2xl font-black text-accent-2">${credit}</div>
        </div>
      </div>
      <div className="mb-3 rounded-2xl bg-white/5 p-3 text-center">
        <div className="text-[10px] uppercase text-muted">Tx {pos + 1}/{PER_LEDGER}</div>
        <div className="text-3xl font-black">${current ?? "—"}</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onPointerDown={() => current != null && allocate("D")} className="rounded-xl bg-accent/30 py-5 text-lg font-bold text-accent active:bg-accent/50">→ Debit</button>
        <button onPointerDown={() => current != null && allocate("C")} className="rounded-xl bg-accent-2/30 py-5 text-lg font-bold text-accent-2 active:bg-accent-2/50">→ Credit</button>
      </div>
    </div>
  );
}
