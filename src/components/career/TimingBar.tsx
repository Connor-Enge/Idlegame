"use client";

import { useEffect, useRef, useState } from "react";
import type { ShiftQuality } from "@/lib/game/types";
import type { ShiftZones } from "@/lib/game/career";

const QUALITY_COLOR: Record<ShiftQuality, string> = {
  perfect: "text-accent-2",
  good: "text-accent",
  ok: "text-white",
  miss: "text-danger",
};

const QUALITY_LABEL: Record<ShiftQuality, string> = {
  perfect: "PERFECT!",
  good: "Good",
  ok: "Okay",
  miss: "Missed",
};

// A sweeping marker the player taps to stop inside skill-sized target zones.
// When `frozen` is set the bar is static (showing the landed position).
export default function TimingBar({
  zones,
  frozen,
  quality,
  speed = 125,
  buttonLabel = "STOP",
  onStop,
}: {
  zones: ShiftZones;
  frozen: number | null;
  quality: ShiftQuality | null;
  speed?: number;
  buttonLabel?: string;
  onStop: (pos: number) => void;
}) {
  const [pos, setPos] = useState(50);
  const posRef = useRef(50);
  const dirRef = useRef(1);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (frozen != null) return;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      posRef.current += dirRef.current * speed * dt;
      if (posRef.current >= 100) {
        posRef.current = 100;
        dirRef.current = -1;
      } else if (posRef.current <= 0) {
        posRef.current = 0;
        dirRef.current = 1;
      }
      setPos(posRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [frozen, speed]);

  const marker = frozen != null ? frozen : pos;
  // Band half-widths are about the center (50); convert to left/width %.
  const band = (hw: number) => ({ left: `${50 - hw}%`, width: `${hw * 2}%` });

  return (
    <div className="space-y-3">
      <div className="relative h-12 select-none overflow-hidden rounded-xl bg-white/5">
        <div className="absolute inset-y-0 rounded-md bg-white/10" style={band(zones.ok)} />
        <div className="absolute inset-y-0 bg-accent/30" style={band(zones.good)} />
        <div className="absolute inset-y-0 bg-accent-2/50" style={band(zones.perfect)} />
        <div
          className="absolute top-0 h-full w-[3px] -translate-x-1/2 rounded bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
          style={{ left: `${marker}%` }}
        />
      </div>

      {frozen != null && quality ? (
        <div className={`text-center text-lg font-black ${QUALITY_COLOR[quality]}`}>
          {QUALITY_LABEL[quality]}
        </div>
      ) : (
        <button
          onClick={() => onStop(posRef.current)}
          className="w-full rounded-xl bg-accent py-4 text-base font-black text-black active:brightness-90"
        >
          {buttonLabel}
        </button>
      )}
    </div>
  );
}
