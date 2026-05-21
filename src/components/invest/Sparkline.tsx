"use client";

import { useMemo } from "react";
import { trendColor } from "./theme";

// A tiny non-interactive trend line for list rows.
export default function Sparkline({
  data,
  points = 36,
  width = 72,
  height = 28,
}: {
  data: number[];
  points?: number;
  width?: number;
  height?: number;
}) {
  const slice = useMemo(() => data.slice(Math.max(0, data.length - points)), [data, points]);
  if (slice.length < 2) return <svg width={width} height={height} />;

  const min = Math.min(...slice);
  const max = Math.max(...slice);
  const range = max - min || 1;
  const up = slice[slice.length - 1] >= slice[0];
  const pad = 3;
  const d = slice
    .map((v, i) => {
      const x = (i / (slice.length - 1)) * width;
      const y = height - pad - ((v - min) / range) * (height - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height}>
      <path d={d} fill="none" stroke={trendColor(up)} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
