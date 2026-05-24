"use client";

import { useEffect, useRef } from "react";
import type { Dir } from "./Sprite";

// On-screen D-pad for mobile. Each direction button updates the parent's
// held-direction state via the callback. Keyboard handling lives in the
// overworld itself so it stays close to the step loop.
export default function Dpad({
  onHeld,
}: {
  onHeld: (dir: Dir | null) => void;
}) {
  const held = useRef<Dir | null>(null);

  function setHeld(dir: Dir | null) {
    if (held.current === dir) return;
    held.current = dir;
    onHeld(dir);
  }

  useEffect(() => () => onHeld(null), [onHeld]);

  function makeBtn(dir: Dir, label: string, position: React.CSSProperties) {
    return (
      <button
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); setHeld(dir); }}
        onPointerUp={() => setHeld(null)}
        onPointerCancel={() => setHeld(null)}
        onPointerLeave={(e) => { if (e.buttons === 0) setHeld(null); }}
        className="absolute flex h-12 w-12 select-none items-center justify-center rounded-lg border border-white/30 bg-black/55 text-xl font-bold text-white shadow-md backdrop-blur active:bg-black/80"
        style={{ touchAction: "none", ...position }}
        aria-label={`Move ${dir}`}
      >
        {label}
      </button>
    );
  }

  return (
    <div
      className="pointer-events-none fixed left-4 z-30"
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))", width: 156, height: 156 }}
    >
      <div className="pointer-events-auto relative h-full w-full">
        {makeBtn("up",    "▲", { left: 52, top: 0 })}
        {makeBtn("left",  "◀", { left: 0, top: 52 })}
        {makeBtn("right", "▶", { left: 104, top: 52 })}
        {makeBtn("down",  "▼", { left: 52, top: 104 })}
      </div>
    </div>
  );
}
