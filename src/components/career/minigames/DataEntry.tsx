"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 14;
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".split("");

function randomCode(len = 4) {
  return Array.from({ length: len }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");
}
function distractor(real: string): string {
  const arr = real.split("");
  const i = Math.floor(Math.random() * arr.length);
  let c = CHARS[Math.floor(Math.random() * CHARS.length)];
  while (c === arr[i]) c = CHARS[Math.floor(Math.random() * CHARS.length)];
  arr[i] = c;
  return arr.join("");
}

export default function DataEntry({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<"show" | "choose">("show");
  const [code, setCode] = useState(() => randomCode());
  const [options, setOptions] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [flash, setFlash] = useState<"" | "good" | "bad">("");
  const codeRef = useRef(code);
  const scoreRef = useRef(0);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function nextRound() {
    const c = randomCode();
    codeRef.current = c;
    setCode(c);
    setPhase("show");
    showTimer.current = setTimeout(() => {
      const opts = [c, distractor(c), distractor(c)];
      for (let i = opts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [opts[i], opts[j]] = [opts[j], opts[i]];
      }
      setOptions(opts);
      setPhase("choose");
    }, 1100);
  }

  useEffect(() => {
    if (!running) return;
    nextRound();
    const start = Date.now();
    const iv = setInterval(() => {
      const rem = Math.max(0, DURATION - (Date.now() - start) / 1000);
      setLeft(rem);
      if (rem <= 0) { clearInterval(iv); onFinish(Math.max(1, scoreRef.current)); }
    }, 100);
    return () => { clearInterval(iv); if (showTimer.current) clearTimeout(showTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function pick(opt: string) {
    if (opt === codeRef.current) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      setFlash("good");
    } else setFlash("bad");
    setTimeout(() => { setFlash(""); nextRound(); }, 250);
  }

  if (!running) {
    return (
      <StartScreen icon="⌨️" name="Data Entry" blurb="A code flashes for a second. Memorize it, then tap the correct one when the options appear." onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Entered" value={score} right={`${left.toFixed(1)}s`} />
      <div className={`mb-4 flex h-32 items-center justify-center rounded-2xl bg-white/10 text-4xl font-black tracking-[0.4em] ${flash === "good" ? "ring-2 ring-accent-2" : flash === "bad" ? "ring-2 ring-danger" : ""}`}>
        {phase === "show" ? code : "?"}
      </div>
      <div className={`grid grid-cols-3 gap-2 transition-opacity ${phase === "choose" ? "opacity-100" : "pointer-events-none opacity-40"}`}>
        {(phase === "choose" ? options : ["—", "—", "—"]).map((o, i) => (
          <button key={i} onPointerDown={() => phase === "choose" && pick(o)} className="rounded-xl bg-accent/20 py-5 text-lg font-bold tracking-widest text-accent active:bg-accent/40">
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
