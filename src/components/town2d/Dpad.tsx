"use client";

import { useEffect, useRef } from "react";
import type { Dir } from "./Sprite";

// On-screen game-controller D-pad for mobile. Cross-shaped with raised
// buttons, recessed centre, drop shadow, and pressed-state inset. Each
// direction button updates the parent's held-direction state via the
// callback. Keyboard handling lives in the overworld itself so it stays
// close to the step loop.
export default function Dpad({
  onHeld,
}: {
  onHeld: (dir: Dir | null) => void;
}) {
  const held = useRef<Dir | null>(null);
  const pressedRef = useRef<{ [k in Dir]?: HTMLButtonElement | null }>({});

  function setHeld(dir: Dir | null) {
    if (held.current === dir) return;
    held.current = dir;
    onHeld(dir);
  }

  useEffect(() => () => onHeld(null), [onHeld]);

  function btn(dir: Dir, glyph: string, position: React.CSSProperties, rounded: React.CSSProperties) {
    return (
      <button
        ref={(el) => { pressedRef.current[dir] = el; }}
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); setHeld(dir); }}
        onPointerUp={() => setHeld(null)}
        onPointerCancel={() => setHeld(null)}
        onPointerLeave={(e) => { if (e.buttons === 0) setHeld(null); }}
        className="absolute select-none text-white"
        style={{
          ...position,
          ...rounded,
          width: 46,
          height: 46,
          background:
            "linear-gradient(180deg, #475569 0%, #1e293b 100%)",
          border: "2px solid #0f172a",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -2px 0 rgba(0,0,0,0.5), 0 2px 0 rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          fontWeight: 900,
          touchAction: "none",
          textShadow: "0 1px 0 rgba(0,0,0,0.6)",
        }}
        aria-label={`Move ${dir}`}
      >
        {glyph}
      </button>
    );
  }

  return (
    <div
      className="pointer-events-none fixed left-3 z-30"
      style={{ bottom: "max(0.9rem, env(safe-area-inset-bottom))", width: 140, height: 140 }}
    >
      {/* Base disc beneath the cross, plus a subtle drop shadow */}
      <div
        style={{
          position: "absolute",
          left: 9, top: 9,
          width: 122, height: 122,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 35% 35%, #4b5563 0%, #1f2937 70%, #0b1220 100%)",
          boxShadow:
            "0 6px 14px rgba(0,0,0,0.55), inset 0 2px 0 rgba(255,255,255,0.08), inset 0 -3px 0 rgba(0,0,0,0.45)",
          opacity: 0.85,
          pointerEvents: "none",
        }}
      />
      {/* Centre hub */}
      <div
        style={{
          position: "absolute",
          left: 56, top: 56,
          width: 28, height: 28,
          borderRadius: "50%",
          background: "radial-gradient(circle at 40% 40%, #1f2937, #0b1220)",
          border: "2px solid #0f172a",
          boxShadow:
            "inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 -2px 0 rgba(0,0,0,0.6)",
          pointerEvents: "none",
        }}
      />
      <div className="pointer-events-auto relative h-full w-full">
        {btn("up",    "▲", { left: 47, top: 0 }, { borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 })}
        {btn("left",  "◀", { left: 0, top: 47 }, { borderTopLeftRadius: 10, borderBottomLeftRadius: 10, borderTopRightRadius: 4, borderBottomRightRadius: 4 })}
        {btn("right", "▶", { left: 94, top: 47 }, { borderTopRightRadius: 10, borderBottomRightRadius: 10, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 })}
        {btn("down",  "▼", { left: 47, top: 94 }, { borderBottomLeftRadius: 10, borderBottomRightRadius: 10, borderTopLeftRadius: 4, borderTopRightRadius: 4 })}
      </div>
    </div>
  );
}
