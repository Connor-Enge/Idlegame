"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PRICE_PERIODS, trendColor, type Period } from "./theme";

export interface ChartDisplay {
  value: number; // value at the cursor (or latest)
  open: number; // first value in the window
  changeAbs: number;
  changePct: number;
  up: boolean;
  scrubbing: boolean;
}

// A Robinhood-style line chart: thin line, dashed baseline at the period's
// open, and finger/mouse scrubbing that reports the value under the cursor.
export default function PriceChart({
  data,
  height = 180,
  periods = PRICE_PERIODS,
  onDisplay,
}: {
  data: number[];
  height?: number;
  periods?: Period[];
  onDisplay?: (d: ChartDisplay) => void;
}) {
  const [periodId, setPeriodId] = useState("1d");
  const [cursor, setCursor] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const period = periods.find((p) => p.id === periodId) ?? periods[0];
  const slice = useMemo(() => {
    if (!data.length) return [] as number[];
    const n = period.points === Infinity ? data.length : Math.min(data.length, period.points);
    return data.slice(data.length - n);
  }, [data, period.points]);

  const n = slice.length;
  const open = slice[0] ?? 0;
  const last = slice[n - 1] ?? 0;
  const cursorIdx = cursor != null ? Math.min(n - 1, Math.max(0, cursor)) : n - 1;
  const value = slice[cursorIdx] ?? last;
  const up = value >= open;
  const color = trendColor(up);

  // Report the current display (cursor value or latest) to the parent header.
  useEffect(() => {
    if (!n) return;
    onDisplay?.({
      value,
      open,
      changeAbs: value - open,
      changePct: open ? ((value - open) / open) * 100 : 0,
      up,
      scrubbing: cursor != null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, open, up, cursor, n]);

  const W = 1000;
  const H = 300;
  const pad = 24;
  const min = n ? Math.min(...slice) : 0;
  const max = n ? Math.max(...slice) : 1;
  const range = max - min || 1;
  const x = (i: number) => (n > 1 ? (i / (n - 1)) * W : 0);
  const y = (v: number) => H - pad - ((v - min) / range) * (H - pad * 2);

  const linePath = useMemo(() => {
    if (n < 2) return "";
    return slice.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slice]);

  function handleMove(clientX: number) {
    const el = svgRef.current;
    if (!el || n < 2) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setCursor(Math.round(ratio * (n - 1)));
  }

  const baselineY = y(open);
  const cursorX = x(cursorIdx);
  const cursorY = y(value);

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        width="100%"
        height={height}
        style={{ touchAction: "pan-y", display: "block" }}
        onMouseMove={(e) => handleMove(e.clientX)}
        onMouseLeave={() => setCursor(null)}
        onTouchStart={(e) => handleMove(e.touches[0].clientX)}
        onTouchMove={(e) => handleMove(e.touches[0].clientX)}
        onTouchEnd={() => setCursor(null)}
      >
        {/* Dashed baseline at the period's opening value. */}
        {n > 1 && (
          <line
            x1={0}
            x2={W}
            y1={baselineY}
            y2={baselineY}
            stroke="#5b5b6b"
            strokeWidth={1.5}
            strokeDasharray="6 8"
          />
        )}
        {linePath && (
          <path d={linePath} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {/* Scrub guide + dot. */}
        {cursor != null && n > 1 && (
          <>
            <line x1={cursorX} x2={cursorX} y1={0} y2={H} stroke="#ffffff" strokeOpacity={0.25} strokeWidth={1.5} />
            <circle cx={cursorX} cy={cursorY} r={7} fill={color} stroke="#0a0a0f" strokeWidth={3} />
          </>
        )}
      </svg>

      <div className="mt-3 flex justify-between px-1">
        {periods.map((p) => {
          const active = p.id === period.id;
          return (
            <button
              key={p.id}
              onClick={() => {
                setPeriodId(p.id);
                setCursor(null);
              }}
              className="rounded-md px-2 py-1 text-xs font-bold tracking-wide transition"
              style={{
                color: active ? color : "#9ca3af",
                background: active ? `${color}1f` : "transparent",
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
