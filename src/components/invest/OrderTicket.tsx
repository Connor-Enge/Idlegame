"use client";

import { useState } from "react";
import { gameActions, useGame } from "@/lib/store";
import { money } from "@/lib/format";
import { buyingPower } from "@/lib/game/investing";
import type { MarketAsset } from "@/lib/game/types";
import { RH_GREEN, RH_RED } from "./theme";

type Mode = "market" | "limit" | "stop" | "recurring";
type Unit = "dollars" | "shares";

const FREQS = [
  { label: "Frequent", ticks: 30 },
  { label: "Regular", ticks: 120 },
  { label: "Occasional", ticks: 300 },
];

export default function OrderTicket({
  asset,
  initialSide = "buy",
  onClose,
}: {
  asset: MarketAsset;
  initialSide?: "buy" | "sell";
  onClose: () => void;
}) {
  const state = useGame((s) => s.state)!;
  const run = useGame((s) => s.run);

  const [side, setSide] = useState<"buy" | "sell">(initialSide);
  const [mode, setMode] = useState<Mode>("market");
  const [unit, setUnit] = useState<Unit>("dollars");
  const [amount, setAmount] = useState("100");
  const [limitPrice, setLimitPrice] = useState(asset.price.toFixed(2));
  const [shares, setShares] = useState("1");
  const [freq, setFreq] = useState(FREQS[1].ticks);
  const [review, setReview] = useState(false);

  const bp = buyingPower(state);
  const holding = state.holdings.find((h) => h.assetId === asset.id);
  const ownedShares = holding?.quantity ?? 0;
  const accent = side === "buy" ? RH_GREEN : RH_RED;

  const amt = parseFloat(amount) || 0;
  const sh = parseFloat(shares) || 0;
  const lp = parseFloat(limitPrice) || 0;

  // Estimated shares/cost for the market summary line.
  const estShares = unit === "dollars" ? amt / asset.price : sh;
  const estCost = unit === "dollars" ? amt : sh * asset.price;

  function submit() {
    let result;
    if (mode === "recurring") {
      result = gameActions.addRecurring(state, asset.id, amt, freq);
    } else if (mode === "limit" || mode === "stop") {
      result = gameActions.placeOrder(state, asset.id, side, mode, lp, sh);
    } else if (side === "buy") {
      result =
        unit === "dollars"
          ? gameActions.buyAssetDollars(state, asset.id, amt)
          : gameActions.buyAsset(state, asset.id, sh);
    } else {
      result =
        unit === "dollars"
          ? gameActions.sellAssetDollars(state, asset.id, amt)
          : gameActions.sellAsset(state, asset.id, sh);
    }
    run(result);
    if (result.ok) onClose();
    else setReview(false);
  }

  // ---- Validation for the primary button ----
  let disabled = false;
  let cta = "";
  if (mode === "recurring") {
    disabled = amt <= 0;
    cta = `Set up recurring buy`;
  } else if (mode === "limit" || mode === "stop") {
    disabled = lp <= 0 || sh <= 0 || (side === "sell" && sh > ownedShares);
    cta = `Place ${mode} ${side} order`;
  } else if (side === "buy") {
    disabled = estCost <= 0 || estCost > bp;
    cta = `Review buy`;
  } else {
    disabled = estShares <= 0 || estShares > ownedShares + 1e-6;
    cta = `Review sell`;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[480px] rounded-t-3xl border-t border-white/10 bg-bg-elev p-5 pb-[max(env(safe-area-inset-bottom),20px)]">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-bold">
            {review ? "Review order" : `${side === "buy" ? "Buy" : "Sell"} ${asset.symbol}`}
          </div>
          <button onClick={onClose} className="text-2xl leading-none text-muted active:text-white">
            ×
          </button>
        </div>

        {review ? (
          <ReviewScreen
            asset={asset}
            side={side}
            mode={mode}
            estShares={estShares}
            estCost={estCost}
            accent={accent}
          />
        ) : (
          <>
            {/* Buy / Sell toggle */}
            <div className="mb-3 flex gap-2">
              {(["buy", "sell"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  className="flex-1 rounded-xl py-2 text-sm font-bold capitalize transition"
                  style={
                    side === s
                      ? { background: s === "buy" ? RH_GREEN : RH_RED, color: "#0a0a0f" }
                      : { background: "rgba(255,255,255,0.06)", color: "#9ca3af" }
                  }
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Order type */}
            <div className="mb-4 flex gap-1 rounded-xl bg-white/5 p-1 text-xs font-semibold">
              {(["market", "limit", "stop", "recurring"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="flex-1 rounded-lg py-1.5 capitalize transition"
                  style={mode === m ? { background: "rgba(255,255,255,0.12)", color: "#fff" } : { color: "#9ca3af" }}
                >
                  {m}
                </button>
              ))}
            </div>

            {mode === "market" && (
              <>
                <div className="mb-3 flex justify-end">
                  <button
                    onClick={() => setUnit(unit === "dollars" ? "shares" : "dollars")}
                    className="text-xs font-semibold text-muted active:text-white"
                  >
                    {unit === "dollars" ? "Switch to shares ⇄" : "Switch to dollars ⇄"}
                  </button>
                </div>
                <Field
                  label={unit === "dollars" ? "Amount ($)" : "Shares"}
                  value={unit === "dollars" ? amount : shares}
                  onChange={unit === "dollars" ? setAmount : setShares}
                  prefix={unit === "dollars" ? "$" : undefined}
                />
                <Row label="Market price" value={money(asset.price)} />
                <Row
                  label={unit === "dollars" ? "Est. shares" : "Est. cost"}
                  value={unit === "dollars" ? estShares.toFixed(4) : money(estCost)}
                />
              </>
            )}

            {(mode === "limit" || mode === "stop") && (
              <>
                <Field label={`${cap(mode)} price`} value={limitPrice} onChange={setLimitPrice} prefix="$" />
                <Field label="Shares" value={shares} onChange={setShares} />
                <Row label="Est. value" value={money(lp * sh)} />
                <p className="mt-2 text-[11px] leading-snug text-muted">
                  {mode === "limit"
                    ? side === "buy"
                      ? "Fills automatically if the price drops to your limit or lower."
                      : "Fills automatically if the price rises to your limit or higher."
                    : side === "buy"
                      ? "Triggers a buy if the price rises through your stop."
                      : "Triggers a sell if the price falls through your stop (stop-loss)."}
                </p>
              </>
            )}

            {mode === "recurring" && (
              <>
                <Field label="Amount per buy ($)" value={amount} onChange={setAmount} prefix="$" />
                <div className="mb-1 mt-2 text-xs text-muted">Frequency</div>
                <div className="mb-2 flex gap-2">
                  {FREQS.map((f) => (
                    <button
                      key={f.ticks}
                      onClick={() => setFreq(f.ticks)}
                      className="flex-1 rounded-lg py-2 text-xs font-semibold transition"
                      style={
                        freq === f.ticks
                          ? { background: RH_GREEN, color: "#0a0a0f" }
                          : { background: "rgba(255,255,255,0.06)", color: "#9ca3af" }
                      }
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] leading-snug text-muted">
                  Automatically buys {money(amt)} of {asset.symbol} on a recurring schedule — dollar-cost averaging on autopilot.
                </p>
              </>
            )}

            <div className="mt-4 flex justify-between text-xs text-muted">
              <span>{side === "buy" ? "Buying power" : "Shares owned"}</span>
              <span className="font-semibold text-white">
                {side === "buy" ? money(bp) : ownedShares.toFixed(4)}
              </span>
            </div>
          </>
        )}

        <button
          disabled={!review && disabled}
          onClick={() => {
            if (mode === "market" && side === "buy" && !review) return setReview(true);
            if (mode === "market" && side === "sell" && !review) return setReview(true);
            submit();
          }}
          className="mt-4 w-full rounded-xl py-3 text-base font-bold transition disabled:opacity-40"
          style={{ background: accent, color: "#0a0a0f" }}
        >
          {review ? `Submit ${side} order` : cta}
        </button>
        {review && (
          <button onClick={() => setReview(false)} className="mt-2 w-full py-2 text-sm text-muted active:text-white">
            Edit order
          </button>
        )}
      </div>
    </div>
  );
}

function ReviewScreen({
  asset,
  side,
  mode,
  estShares,
  estCost,
  accent,
}: {
  asset: MarketAsset;
  side: string;
  mode: string;
  estShares: number;
  estCost: number;
  accent: string;
}) {
  return (
    <div className="space-y-2 rounded-2xl bg-white/5 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg">
          {asset.logo ?? asset.symbol.slice(0, 1)}
        </div>
        <div>
          <div className="font-bold">{asset.name}</div>
          <div className="text-xs text-muted">
            {cap(side)} · {cap(mode)} order
          </div>
        </div>
      </div>
      <Row label="Shares" value={estShares.toFixed(4)} />
      <Row label="Market price" value={money(asset.price)} />
      <Row label={side === "buy" ? "Est. cost" : "Est. proceeds"} value={money(estCost)} bold accent={accent} />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  prefix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
}) {
  return (
    <div className="mb-2">
      <div className="mb-1 text-xs text-muted">{label}</div>
      <div className="flex items-center rounded-xl bg-white/5 px-3">
        {prefix && <span className="text-lg font-bold text-muted">{prefix}</span>}
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent px-1 py-3 text-lg font-bold outline-none"
        />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: string;
}) {
  return (
    <div className="flex justify-between border-t border-white/5 py-2 text-sm first:border-t-0">
      <span className="text-muted">{label}</span>
      <span className={bold ? "font-bold" : "font-semibold"} style={accent ? { color: accent } : undefined}>
        {value}
      </span>
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
