"use client";

// Pokemon-style dialog box, anchored to the bottom of the viewport. Owns its
// own typewriter effect — text reveals one char at a time, tapping skips to
// the end / advances to the next line. Closes when no more lines remain.

import { useEffect, useState } from "react";

export interface DialogLine {
  text: string;
  // Optional speaker label shown above the text.
  who?: string;
}

const CHARS_PER_SEC = 60;

export default function Dialog({
  lines,
  onClose,
}: {
  lines: DialogLine[];
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(0); // chars revealed in the current line

  const current = lines[idx];

  // Typewriter for the current line.
  useEffect(() => {
    setShown(0);
    if (!current) return;
    const tick = 1000 / CHARS_PER_SEC;
    const t = setInterval(() => {
      setShown((s) => {
        if (!current || s >= current.text.length) {
          clearInterval(t);
          return s;
        }
        return s + 1;
      });
    }, tick);
    return () => clearInterval(t);
  }, [idx, current]);

  function advance() {
    if (!current) return;
    if (shown < current.text.length) {
      // Skip the typewriter on this line.
      setShown(current.text.length);
      return;
    }
    if (idx + 1 < lines.length) {
      setIdx(idx + 1);
    } else {
      onClose();
    }
  }

  // Spacebar / Enter advances the dialog on desktop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        if (e.key === "Escape") onClose();
        else advance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, shown, current]);

  if (!current) return null;

  const done = shown >= current.text.length;
  const hasMore = idx + 1 < lines.length;

  return (
    <button
      onClick={advance}
      className="fixed bottom-20 left-1/2 z-40 w-[min(440px,calc(100vw-32px))] -translate-x-1/2 select-none rounded-xl border-4 border-white bg-slate-900 px-4 py-3 text-left text-white shadow-2xl"
      style={{ touchAction: "manipulation" }}
    >
      {current.who && (
        <div className="mb-1 text-[10px] uppercase tracking-widest text-amber-300">{current.who}</div>
      )}
      <div className="min-h-[3.2em] text-sm leading-snug">
        {current.text.slice(0, shown)}
        {!done && <span className="inline-block w-1.5 animate-pulse">▍</span>}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-white/60">
        <span>Tap to {done ? (hasMore ? "continue" : "close") : "skip"}</span>
        <span className={done ? "animate-bounce" : "opacity-0"}>▼</span>
      </div>
    </button>
  );
}
