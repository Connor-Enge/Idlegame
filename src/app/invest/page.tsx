"use client";

import { useState } from "react";
import { useGame, gameActions } from "@/lib/store";
import { money, pct } from "@/lib/format";
import { Button, Card, SectionTitle, Pill, LockedScreen } from "@/components/ui";
import { educationById, hasFeature, nextUnlock } from "@/lib/game/progression";

export default function InvestPage() {
  const state = useGame((s) => s.state);
  const run = useGame((s) => s.run);
  const [selected, setSelected] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  if (!state) return null;
  const { assets, holdings, stats, progression } = state;

  if (!hasFeature(state, "invest")) {
    const nu = nextUnlock(state);
    return (
      <LockedScreen
        icon="📈"
        title="Markets"
        requirement={
          nu && nu.flag === "invest"
            ? `Reach ${money(nu.netWorth)} net worth to open a brokerage account. (You: ${money(stats.netWorth)})`
            : "Build more net worth to unlock investing."
        }
      />
    );
  }

  // Reveal assets gradually by level; advanced instruments need a credential.
  const visible = assets.filter((a) => !a.unlockLevel || progression.level >= a.unlockLevel);
  const asset = visible.find((a) => a.id === selected);
  const holding = holdings.find((h) => h.assetId === selected);
  const credentialMissing = Boolean(
    asset?.requiresCredential && !progression.credentials.includes(asset.requiresCredential),
  );

  return (
    <div className="space-y-3">
      <SectionTitle sub="Buy low. Sell high. In theory.">Markets</SectionTitle>

      {holdings.length > 0 && (
        <Card>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Your Portfolio
          </div>
          <div className="space-y-2">
            {holdings.map((h) => {
              const a = assets.find((x) => x.id === h.assetId)!;
              const value = a.price * h.quantity;
              const cost = h.avgCost * h.quantity;
              const gain = ((value - cost) / cost) * 100;
              return (
                <div key={h.assetId} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-semibold">{a.symbol}</span>
                    <span className="ml-2 text-xs text-muted">{h.quantity.toFixed(2)} @ {money(h.avgCost)}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{money(value)}</div>
                    <Pill tone={gain >= 0 ? "up" : "down"}>{pct(gain)}</Pill>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {visible.map((a) => {
          const locked = a.requiresCredential && !progression.credentials.includes(a.requiresCredential);
          return (
            <button
              key={a.id}
              onClick={() => {
                setSelected(a.id);
                setQty(1);
              }}
              className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${
                selected === a.id ? "border-accent bg-accent/10" : "border-white/5 bg-bg-card"
              }`}
            >
              <div>
                <div className="text-sm font-semibold">
                  {a.symbol} <span className="text-[10px] uppercase text-muted">{a.class}</span>
                  {locked && <span className="ml-1 text-[10px] text-danger">🔒 {educationById(a.requiresCredential!)?.short}</span>}
                </div>
                <div className="text-[11px] text-muted">{a.name}</div>
              </div>
              <div className="text-right">
                <div className="font-bold">{money(a.price)}</div>
                <div className="text-[10px] text-muted">vol {(a.volatility * 100).toFixed(1)}%</div>
              </div>
            </button>
          );
        })}
        <div className="pt-1 text-center text-[11px] text-muted">
          More instruments unlock as you level up.
        </div>
      </div>

      {asset && (
        <Card className="sticky bottom-24 border-accent/30">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{asset.symbol}</div>
            <div className="font-bold text-accent">{money(asset.price)}</div>
          </div>
          <input
            type="number"
            value={qty}
            min={0}
            step={0.1}
            onChange={(e) => setQty(Math.max(0, Number(e.target.value) || 0))}
            className="mt-2 w-full rounded-lg bg-white/5 px-3 py-2 text-lg font-bold outline-none"
          />
          <div className="mt-1 text-xs text-muted">
            Cost {money(asset.price * qty)} · Cash {money(stats.cash)}
            {holding && ` · You own ${holding.quantity.toFixed(2)}`}
          </div>
          {credentialMissing && (
            <div className="mt-1 text-[11px] text-danger">
              Requires {educationById(asset.requiresCredential!)?.name}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <Button
              className="flex-1"
              disabled={asset.price * qty > stats.cash || qty <= 0 || credentialMissing}
              onClick={() => run(gameActions.buyAsset(state, asset.id, qty))}
            >
              Buy
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={!holding || qty <= 0 || (holding?.quantity ?? 0) < qty}
              onClick={() => run(gameActions.sellAsset(state, asset.id, qty))}
            >
              Sell
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
