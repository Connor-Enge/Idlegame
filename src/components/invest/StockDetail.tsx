"use client";

import { useState } from "react";
import { gameActions, useGame } from "@/lib/store";
import { money, pct, shortNum } from "@/lib/format";
import type { MarketAsset } from "@/lib/game/types";
import PriceChart, { type ChartDisplay } from "./PriceChart";
import OrderTicket from "./OrderTicket";
import { RH_GREEN, RH_RED, trendColor } from "./theme";

export default function StockDetail({ assetId, onBack }: { assetId: string; onBack: () => void }) {
  const state = useGame((s) => s.state)!;
  const run = useGame((s) => s.run);
  const asset = state.assets.find((a) => a.id === assetId);
  const [display, setDisplay] = useState<ChartDisplay | null>(null);
  const [ticket, setTicket] = useState<"buy" | "sell" | null>(null);

  if (!asset) return null;

  const holding = state.holdings.find((h) => h.assetId === assetId);
  const watchlist = state.investing.watchlists.find((w) => w.id === "default");
  const watched = watchlist?.assetIds.includes(assetId) ?? false;
  const orders = state.investing.orders.filter((o) => o.assetId === assetId);
  const recurring = state.investing.recurring.filter((r) => r.assetId === assetId);

  // The big header value tracks the chart cursor; defaults to live price.
  const headPrice = display ? display.value : asset.price;
  const changeAbs = display?.changeAbs ?? 0;
  const changePct = display?.changePct ?? 0;
  const up = display ? display.up : true;
  const color = trendColor(up);

  const stats = fabricateStats(asset);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-muted active:text-white">
          ← Back
        </button>
        <button
          onClick={() => run(gameActions.toggleWatch(state, assetId))}
          className="text-xl active:scale-110"
          title={watched ? "Remove from list" : "Add to list"}
        >
          {watched ? "★" : "☆"}
        </button>
      </div>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{asset.logo ?? "📈"}</span>
          <h1 className="text-xl font-bold">{asset.name}</h1>
        </div>
        <div className="mt-2 text-3xl font-extrabold tabular-nums">{money(headPrice)}</div>
        <div className="text-sm font-semibold tabular-nums" style={{ color }}>
          {changeAbs >= 0 ? "+" : "−"}
          {money(Math.abs(changeAbs))} ({pct(changePct)}){" "}
          <span className="text-muted">{display?.scrubbing ? "selected" : "today"}</span>
        </div>
      </div>

      <PriceChart data={asset.history ?? []} onDisplay={setDisplay} />

      {/* Position */}
      {holding && (
        <Section title="Your position">
          <div className="grid grid-cols-2 gap-y-3 text-sm">
            <Metric label="Shares" value={holding.quantity.toFixed(4)} />
            <Metric label="Equity" value={money(holding.quantity * asset.price)} />
            <Metric label="Avg cost" value={money(holding.avgCost)} />
            <Metric
              label="Total return"
              value={`${money((asset.price - holding.avgCost) * holding.quantity)}`}
              color={trendColor(asset.price >= holding.avgCost)}
            />
          </div>
        </Section>
      )}

      {/* Resting orders */}
      {(orders.length > 0 || recurring.length > 0) && (
        <Section title="Open orders">
          <div className="space-y-2 text-sm">
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between">
                <span>
                  <span className="font-semibold capitalize" style={{ color: o.side === "buy" ? RH_GREEN : RH_RED }}>
                    {o.trigger} {o.side}
                  </span>{" "}
                  <span className="text-muted">
                    {o.shares} sh @ {money(o.price)}
                  </span>
                </span>
                <button onClick={() => run(gameActions.cancelOrder(state, o.id))} className="text-xs text-muted active:text-white">
                  Cancel
                </button>
              </div>
            ))}
            {recurring.map((r) => (
              <div key={r.id} className="flex items-center justify-between">
                <span>
                  <span className="font-semibold" style={{ color: RH_GREEN }}>
                    Recurring
                  </span>{" "}
                  <span className="text-muted">{money(r.amount)} / cycle</span>
                </span>
                <button onClick={() => run(gameActions.cancelRecurring(state, r.id))} className="text-xs text-muted active:text-white">
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Stats */}
      <Section title="Stats">
        <div className="grid grid-cols-2 gap-y-3 text-sm">
          <Metric label="Market cap" value={stats.marketCap} />
          <Metric label="Volume" value={stats.volume} />
          <Metric label="P/E ratio" value={stats.pe} />
          <Metric label="Volatility" value={`${(asset.volatility * 100).toFixed(1)}%`} />
          <Metric label="52-wk high" value={money(stats.high)} />
          <Metric label="52-wk low" value={money(stats.low)} />
          {asset.dividendYield ? <Metric label="Dividend yield" value={`${asset.dividendYield.toFixed(1)}%`} /> : null}
          <Metric label="Class" value={cap(asset.class)} />
        </div>
      </Section>

      {/* About */}
      {asset.blurb && (
        <Section title={`About ${asset.symbol}`}>
          <p className="text-sm leading-relaxed text-muted">{asset.blurb}</p>
        </Section>
      )}

      {/* Sector news */}
      {state.economy.activeEvents.length > 0 && (
        <Section title="News">
          <ul className="space-y-2">
            {state.economy.activeEvents.map((e) => {
              const relevant = e.effects.sectorBoost?.sector === asset.sector;
              return (
                <li key={e.id} className="text-sm">
                  <span className="font-semibold" style={{ color: relevant ? color : undefined }}>
                    {e.title}
                    {relevant && " ●"}
                  </span>
                  <span className="text-muted"> — {e.description}</span>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {/* Sticky action bar */}
      <div className="sticky bottom-24 flex gap-3 pt-2">
        <button
          onClick={() => setTicket("buy")}
          className="flex-1 rounded-xl py-3 text-base font-bold"
          style={{ background: RH_GREEN, color: "#0a0a0f" }}
        >
          Buy
        </button>
        {holding && (
          <button
            onClick={() => setTicket("sell")}
            className="flex-1 rounded-xl py-3 text-base font-bold"
            style={{ background: RH_RED, color: "#0a0a0f" }}
          >
            Sell
          </button>
        )}
      </div>

      {ticket && <OrderTicket asset={asset} initialSide={ticket} onClose={() => setTicket(null)} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-bg-card p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{title}</div>
      {children}
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted">{label}</div>
      <div className="font-semibold tabular-nums" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

// Deterministic but believable fundamentals derived from the asset's profile.
function fabricateStats(asset: MarketAsset) {
  const h = hash(asset.id);
  const sharesOut = 5e7 + (h % 9000) * 1e6; // 50M–9B shares
  const history = asset.history ?? [asset.price];
  const high = Math.max(...history);
  const low = Math.min(...history);
  const peBase = asset.class === "bond" ? 0 : 8 + (h % 32) + asset.drift * 4000;
  return {
    marketCap: "$" + shortNum(asset.price * sharesOut),
    volume: shortNum(1e5 + (h % 500) * 1e4),
    pe: peBase > 0 ? peBase.toFixed(1) : "—",
    high,
    low,
  };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
