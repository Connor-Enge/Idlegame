"use client";

import { useEffect, useRef, useState } from "react";
import { MinigameProps, ScoreStrip, StartScreen } from "./shared";

const DURATION = 16;
const FACES = ["📄", "📎", "✉️", "🖇️", "📑", "📌"];

type Card = { id: number; face: string; flipped: boolean; matched: boolean };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newDeck(): Card[] {
  return shuffle(FACES.flatMap((f, i) => [
    { id: i * 2, face: f, flipped: false, matched: false },
    { id: i * 2 + 1, face: f, flipped: false, matched: false },
  ]));
}

export default function OfficeManager({ onFinish }: MinigameProps) {
  const [running, setRunning] = useState(false);
  const [deck, setDeck] = useState<Card[]>(newDeck);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const deckRef = useRef<Card[]>(deck);
  const firstIdx = useRef<number | null>(null);
  const lockRef = useRef(false);
  const scoreRef = useRef(0);

  function resetDeck() {
    deckRef.current = newDeck();
    firstIdx.current = null;
    lockRef.current = false;
    setDeck(deckRef.current);
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

  function flip(i: number) {
    if (lockRef.current) return;
    const c = deckRef.current[i];
    if (c.flipped || c.matched) return;
    c.flipped = true;
    setDeck([...deckRef.current]);
    if (firstIdx.current == null) {
      firstIdx.current = i;
      return;
    }
    const a = deckRef.current[firstIdx.current];
    const b = c;
    if (a.face === b.face) {
      a.matched = true; b.matched = true;
      scoreRef.current += 1;
      setScore(scoreRef.current);
      firstIdx.current = null;
      setDeck([...deckRef.current]);
      if (deckRef.current.every((x) => x.matched)) {
        // bonus: completed deck — refresh for more
        setTimeout(resetDeck, 250);
      }
    } else {
      lockRef.current = true;
      setTimeout(() => {
        a.flipped = false; b.flipped = false;
        firstIdx.current = null;
        lockRef.current = false;
        setDeck([...deckRef.current]);
      }, 520);
    }
  }

  if (!running) {
    return (
      <StartScreen icon="🗃️" name="Office Manager" blurb="Flip two cards to find a matching pair. Clear the whole stack to reshuffle." onStart={() => setRunning(true)} />
    );
  }

  return (
    <div>
      <ScoreStrip label="Pairs" value={score} right={`${left.toFixed(1)}s`} />
      <div className="grid grid-cols-4 gap-2">
        {deck.map((c, i) => (
          <button
            key={c.id}
            onPointerDown={() => flip(i)}
            disabled={c.matched}
            className={`flex h-16 items-center justify-center rounded-xl text-2xl transition ${c.matched ? "bg-accent-2/20 opacity-40" : c.flipped ? "bg-accent/30" : "bg-white/10 active:bg-white/20"}`}
          >
            {c.flipped || c.matched ? c.face : "·"}
          </button>
        ))}
      </div>
    </div>
  );
}
