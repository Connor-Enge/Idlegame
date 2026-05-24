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
      className="fixed bottom-20 left-1/2 z-40 w-[min(460px,calc(100vw-32px))] -translate-x-1/2 select-none text-left"
      style={{ touchAction: "manipulation" }}
    >
      {/* Outer dark frame */}
      <div
        style={{
          background: "#1f2937",
          padding: 4,
          borderRadius: 10,
          boxShadow:
            "0 8px 16px rgba(0,0,0,0.55), inset 0 0 0 2px #0f172a, 0 0 0 3px rgba(0,0,0,0.4)",
        }}
      >
        {/* Inner white border */}
        <div
          style={{
            background: "#f8fafc",
            padding: 3,
            borderRadius: 7,
            boxShadow: "inset 0 0 0 2px #475569",
          }}
        >
          {/* Content panel */}
          <div
            style={{
              background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
              borderRadius: 5,
              padding: "10px 14px",
              color: "#f8fafc",
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
            }}
          >
            {current.who && (
              <div style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    background: "#fbbf24",
                    color: "#451a03",
                    fontSize: 9,
                    fontWeight: 900,
                    padding: "2px 6px",
                    borderRadius: 4,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  {current.who}
                </span>
              </div>
            )}
            <div style={{ minHeight: "3.2em", fontSize: 13, lineHeight: 1.45, letterSpacing: "0.01em" }}>
              {current.text.slice(0, shown)}
              {!done && <span style={{ opacity: 0.7 }}>▍</span>}
            </div>
            <div
              style={{
                marginTop: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 10,
                color: "rgba(248,250,252,0.55)",
              }}
            >
              <span>{done ? `Tap to ${hasMore ? "continue" : "close"}` : "Tap to skip"}</span>
              <span
                style={{
                  color: "#fbbf24",
                  opacity: done ? 1 : 0,
                  animation: done ? "dialogBlink 0.9s ease-in-out infinite" : undefined,
                }}
              >
                ▼
              </span>
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes dialogBlink {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(3px); }
        }
      `}</style>
    </button>
  );
}
