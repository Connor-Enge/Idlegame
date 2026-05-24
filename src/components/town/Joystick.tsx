"use client";

// Virtual joystick for touch — a fixed circle with a draggable inner knob.
// Outputs a normalized (-1..1, -1..1) vector via the onMove callback. Also
// listens to keyboard WASD/arrow keys for desktop play.

import { useEffect, useRef, useState } from "react";

export interface Vec2 { x: number; y: number; }

export default function Joystick({ onMove }: { onMove: (v: Vec2) => void }) {
  const [knob, setKnob] = useState<Vec2>({ x: 0, y: 0 });
  const baseRef = useRef<HTMLDivElement>(null);
  const activeId = useRef<number | null>(null);
  const keysDown = useRef<Set<string>>(new Set());
  const RADIUS = 50;

  // Keyboard fallback — WASD + arrow keys produce the same vector as the
  // joystick so desktop testing works without touch.
  useEffect(() => {
    const send = () => {
      let x = 0, y = 0;
      if (keysDown.current.has("w") || keysDown.current.has("arrowup")) y -= 1;
      if (keysDown.current.has("s") || keysDown.current.has("arrowdown")) y += 1;
      if (keysDown.current.has("a") || keysDown.current.has("arrowleft")) x -= 1;
      if (keysDown.current.has("d") || keysDown.current.has("arrowright")) x += 1;
      const len = Math.hypot(x, y);
      if (len > 0) { x /= len; y /= len; }
      onMove({ x, y });
    };
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
        keysDown.current.add(k);
        send();
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (keysDown.current.delete(k)) send();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [onMove]);

  function pointerDown(e: React.PointerEvent) {
    if (activeId.current != null) return;
    activeId.current = e.pointerId;
    update(e);
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function pointerMove(e: React.PointerEvent) {
    if (activeId.current !== e.pointerId) return;
    update(e);
  }
  function pointerUp(e: React.PointerEvent) {
    if (activeId.current !== e.pointerId) return;
    activeId.current = null;
    setKnob({ x: 0, y: 0 });
    onMove({ x: 0, y: 0 });
  }
  function update(e: React.PointerEvent) {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > RADIUS) { dx = (dx / dist) * RADIUS; dy = (dy / dist) * RADIUS; }
    setKnob({ x: dx, y: dy });
    onMove({ x: dx / RADIUS, y: dy / RADIUS });
  }

  return (
    <div
      ref={baseRef}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerUp}
      className="fixed bottom-8 left-8 z-30 h-28 w-28 touch-none select-none rounded-full border border-white/20 bg-white/10 backdrop-blur"
      style={{ touchAction: "none" }}
    >
      <div
        className="pointer-events-none absolute h-12 w-12 rounded-full bg-white/40 shadow"
        style={{
          left: `calc(50% + ${knob.x}px - 24px)`,
          top: `calc(50% + ${knob.y}px - 24px)`,
        }}
      />
    </div>
  );
}
