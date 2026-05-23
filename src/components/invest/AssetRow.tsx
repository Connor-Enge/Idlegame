"use client";

import { money, pct } from "@/lib/format";
import type { MarketAsset } from "@/lib/game/types";
import Sparkline from "./Sparkline";
import { trendColor } from "./theme";

// Percent change across a trailing window of the asset's price history.
export function windowChange(asset: MarketAsset, window = 96): number {
  const h = asset.history ?? [];
  if (h.length < 2) return 0;
  const slice = h.slice(Math.max(0, h.length - window));
  const open = slice[0];
  return open ? ((slice[slice.length - 1] - open) / open) * 100 : 0;
}

export default function AssetRow({
  asset,
  onClick,
  shares,
  locked,
}: {
  asset: MarketAsset;
  onClick: () => void;
  shares?: number;
  locked?: boolean;
}) {
  const change = windowChange(asset);
  const color = trendColor(change >= 0);
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 py-2.5 text-left active:opacity-70 ${locked ? "opacity-60" : ""}`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-base">
        {asset.logo ?? asset.symbol.slice(0, 1)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 truncate text-sm font-bold">
          {asset.symbol}
          {locked && <span className="text-[10px] font-semibold text-amber-300">🔒</span>}
        </div>
        <div className="truncate text-[11px] text-muted">
          {shares != null ? `${trimShares(shares)} shares` : asset.name}
        </div>
      </div>
      <Sparkline data={asset.history ?? []} />
      <div className="w-20 shrink-0 text-right">
        <div className="text-sm font-bold tabular-nums">{money(asset.price)}</div>
        <div className="text-[11px] font-semibold tabular-nums" style={{ color }}>
          {pct(change)}
        </div>
      </div>
    </button>
  );
}

function trimShares(n: number): string {
  return n >= 100 ? n.toFixed(0) : n.toFixed(n < 1 ? 4 : 2);
}
