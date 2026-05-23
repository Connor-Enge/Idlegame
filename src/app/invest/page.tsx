"use client";

import { useState } from "react";
import { useGame } from "@/lib/store";
import { money, pct } from "@/lib/format";
import { LockedScreen } from "@/components/ui";
import { FEATURE_UNLOCKS } from "@/lib/game/data";
import { hasFeature } from "@/lib/game/progression";
import { buyingPower } from "@/lib/game/investing";
import type { MarketAsset } from "@/lib/game/types";
import AssetRow, { windowChange } from "@/components/invest/AssetRow";
import PriceChart, { type ChartDisplay } from "@/components/invest/PriceChart";
import StockDetail from "@/components/invest/StockDetail";
import GoldScreen from "@/components/invest/GoldScreen";
import { RH_GOLD, trendColor } from "@/components/invest/theme";

type View = { type: "home" } | { type: "detail"; id: string } | { type: "gold" };

export default function InvestPage() {
  const state = useGame((s) => s.state);
  const [view, setView] = useState<View>({ type: "home" });
  const [query, setQuery] = useState("");
  const [display, setDisplay] = useState<ChartDisplay | null>(null);

  if (!state) return null;
  const { assets, holdings, stats, progression, investing } = state;

  if (!hasFeature(state, "invest")) {
    const need = FEATURE_UNLOCKS.find((r) => r.flag === "invest")?.netWorth ?? 0;
    const remaining = Math.max(0, need - stats.netWorth);
    return (
      <LockedScreen
        icon="📈"
        title="Investing"
        requirement={`Reach ${money(need)} net worth to open a brokerage account. You're at ${money(stats.netWorth)} — ${money(remaining)} to go.`}
      />
    );
  }

  if (view.type === "detail") return <StockDetail assetId={view.id} onBack={() => setView({ type: "home" })} />;
  if (view.type === "gold") return <GoldScreen onBack={() => setView({ type: "home" })} />;

  const open = (id: string) => setView({ type: "detail", id });

  // Only assets the player has unlocked are tradable / shown.
  const visible = assets.filter((a) => !a.unlockLevel || progression.level >= a.unlockLevel);
  const byId = (id: string) => assets.find((a) => a.id === id);

  const holdingsValue = holdings.reduce((sum, h) => sum + (byId(h.assetId)?.price ?? 0) * h.quantity, 0);
  const portfolioOpen = investing.portfolioHistory[0] ?? holdingsValue;

  // Headline number tracks the chart cursor; defaults to live holdings value.
  const headValue = display ? display.value : holdingsValue;
  const changeAbs = display?.changeAbs ?? holdingsValue - portfolioOpen;
  const changePct = display?.changePct ?? (portfolioOpen ? ((holdingsValue - portfolioOpen) / portfolioOpen) * 100 : 0);
  const up = display ? display.up : holdingsValue >= portfolioOpen;
  const color = trendColor(up);

  // ---- Search ----
  if (query.trim()) {
    const q = query.toLowerCase();
    const results = visible.filter(
      (a) => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q),
    );
    return (
      <div className="space-y-3">
        <SearchBar query={query} setQuery={setQuery} />
        <div className="divide-y divide-white/5">
          {results.length ? (
            results.map((a) => <AssetRow key={a.id} asset={a} onClick={() => open(a.id)} />)
          ) : (
            <div className="py-10 text-center text-sm text-muted">No matches for “{query}”.</div>
          )}
        </div>
      </div>
    );
  }

  // ---- Lists ----
  const watchlist = investing.watchlists.find((w) => w.id === "default");
  const watched = (watchlist?.assetIds ?? []).map(byId).filter(Boolean) as MarketAsset[];
  const popular = visible.filter((a) => a.popular);
  const crypto = visible.filter((a) => a.class === "crypto");
  const funds = visible.filter((a) => a.class === "index" || a.class === "bond");
  const movers = [...visible].sort((a, b) => Math.abs(windowChange(b)) - Math.abs(windowChange(a))).slice(0, 5);
  const lockedCount = assets.length - visible.length;

  return (
    <div className="space-y-4">
      {/* Portfolio header */}
      <div>
        <div className="text-[11px] uppercase tracking-widest text-muted">Investing</div>
        <div className="text-4xl font-extrabold tabular-nums">{money(headValue)}</div>
        <div className="text-sm font-semibold tabular-nums" style={{ color }}>
          {changeAbs >= 0 ? "+" : "−"}
          {money(Math.abs(changeAbs))} ({pct(changePct)}){" "}
          <span className="text-muted">{display?.scrubbing ? "selected" : "today"}</span>
        </div>
      </div>

      <PriceChart data={investing.portfolioHistory} onDisplay={setDisplay} />

      {/* Buying power / Gold */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/5 bg-bg-card p-3">
          <div className="text-[11px] text-muted">Buying power</div>
          <div className="text-lg font-bold tabular-nums">{money(buyingPower(state))}</div>
          <div className="text-[10px] text-muted">Cash {money(stats.cash)}</div>
        </div>
        <button
          onClick={() => setView({ type: "gold" })}
          className="rounded-2xl border p-3 text-left active:scale-[0.98]"
          style={{ borderColor: `${RH_GOLD}55`, background: `${RH_GOLD}12` }}
        >
          <div className="text-[11px]" style={{ color: RH_GOLD }}>
            ✨ Robinhood Gold
          </div>
          <div className="text-lg font-bold" style={{ color: RH_GOLD }}>
            {investing.gold ? "Active" : "Upgrade"}
          </div>
          <div className="text-[10px] text-muted">
            {investing.marginUsed > 0 ? `Margin ${money(investing.marginUsed)}` : "Interest · margin"}
          </div>
        </button>
      </div>

      <SearchBar query={query} setQuery={setQuery} />

      {holdings.length > 0 && (
        <List title="Your stocks">
          {holdings.map((h) => {
            const a = byId(h.assetId);
            return a ? <AssetRow key={h.assetId} asset={a} shares={h.quantity} onClick={() => open(a.id)} /> : null;
          })}
        </List>
      )}

      {watched.length > 0 && (
        <List title={watchlist?.name ?? "Watchlist"}>
          {watched.map((a) => (
            <AssetRow key={a.id} asset={a} onClick={() => open(a.id)} />
          ))}
        </List>
      )}

      {popular.length > 0 && (
        <List title="Popular">
          {popular.map((a) => (
            <AssetRow key={a.id} asset={a} onClick={() => open(a.id)} />
          ))}
        </List>
      )}

      <List title="Daily movers">
        {movers.map((a) => (
          <AssetRow key={a.id} asset={a} onClick={() => open(a.id)} />
        ))}
      </List>

      {crypto.length > 0 && (
        <List title="Crypto · 24 Hour Market">
          {crypto.map((a) => (
            <AssetRow key={a.id} asset={a} onClick={() => open(a.id)} />
          ))}
        </List>
      )}

      {funds.length > 0 && (
        <List title="ETFs & bonds">
          {funds.map((a) => (
            <AssetRow key={a.id} asset={a} onClick={() => open(a.id)} />
          ))}
        </List>
      )}

      {/* News */}
      {state.economy.activeEvents.length > 0 && (
        <List title="News">
          <ul className="space-y-2 py-1">
            {state.economy.activeEvents.map((e) => (
              <li key={e.id} className="text-sm">
                <span className="font-semibold">{e.title}</span>
                <span className="text-muted"> — {e.description}</span>
              </li>
            ))}
          </ul>
        </List>
      )}

      {lockedCount > 0 && (
        <div className="rounded-2xl border border-white/5 bg-bg-card p-4 text-center text-[12px] text-muted">
          🔒 {lockedCount} more instrument{lockedCount > 1 ? "s" : ""} unlock as you level up.
        </div>
      )}
    </div>
  );
}

function SearchBar({ query, setQuery }: { query: string; setQuery: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5">
      <span className="text-muted">🔍</span>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search stocks, crypto, funds"
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
      />
      {query && (
        <button onClick={() => setQuery("")} className="text-muted active:text-white">
          ×
        </button>
      )}
    </div>
  );
}

function List({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">{title}</div>
      <div className="divide-y divide-white/5">{children}</div>
    </div>
  );
}
