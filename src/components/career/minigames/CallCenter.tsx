"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 14;
const WORDS = ["HOME", "CASH", "GAME", "BOSS", "SHOP", "BANK", "HIRE", "RICH", "GOLD", "DEAL", "RING", "DIAL", "CALL", "WORK", "WAGE"];
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function pickWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

export default function CallCenter({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [word, setWord] = useState(pickWord);
  const [typed, setTyped] = useState(0);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [wrong, setWrong] = useState(false);
  const wordRef = useRef(word);
  const typedRef = useRef(0);
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

  function tap(letter: string) {
    if (letter === wordRef.current[typedRef.current]) {
      typedRef.current += 1;
      if (typedRef.current >= wordRef.current.length) {
        scoreRef.current += 1;
        setScore(scoreRef.current);
        const nw = pickWord();
        wordRef.current = nw;
        typedRef.current = 0;
        setWord(nw);
      }
      setTyped(typedRef.current);
    } else {
      typedRef.current = 0;
      setTyped(0);
      setWrong(true);
      setTimeout(() => setWrong(false), 180);
    }
  }

  if (!running) {
    return (
      <StartScreen icon="🎧" name="Call Center" blurb="Type each word by tapping its letters in order on the keypad. Wrong letter? Start the word over." onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Logged" value={score} right={`${left.toFixed(1)}s`} />
      <div className={`mb-3 rounded-2xl bg-white/10 py-5 text-center text-3xl font-black tracking-[0.3em] ${wrong ? "ring-2 ring-danger" : ""}`}>
        {word.split("").map((ch, i) => (
          <span key={i} className={i < typed ? "text-accent" : "text-white"}>{ch}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {ALPHA.map((l) => (
          <button key={l} onPointerDown={() => tap(l)} className="rounded-md bg-accent/20 py-3 text-sm font-bold text-accent active:bg-accent/40">
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}
