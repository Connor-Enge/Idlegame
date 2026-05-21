"use client";

import { useState } from "react";
import { gameActions, useGame } from "@/lib/store";
import { money } from "@/lib/format";
import { buyingPower } from "@/lib/game/investing";
import {
  GOLD_CASH_APY_PER_TICK,
  GOLD_FEE_PER_TICK,
  MARGIN_RATE_PER_TICK,
} from "@/lib/game/data";
import { RH_GOLD } from "./theme";

const PERKS = [
  { icon: "💵", title: "Interest on idle cash", desc: "Your uninvested cash earns interest every tick." },
  { icon: "⚡", title: "Margin investing", desc: "Borrow against your holdings to buy more than your cash allows." },
  { icon: "📊", title: "Pro research", desc: "Deeper stats and resting orders on every instrument." },
  { icon: "🎯", title: "Bigger instant deposits", desc: "Larger buying power, settled instantly." },
];

export default function GoldScreen({ onBack }: { onBack: () => void }) {
  const state = useGame((s) => s.state)!;
  const run = useGame((s) => s.run);
  const inv = state.investing;
  const [repay, setRepay] = useState("");

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-muted active:text-white">
        ← Back
      </button>

      <div
        className="rounded-3xl p-6 text-center"
        style={{ background: `linear-gradient(160deg, ${RH_GOLD}, #8a6d12)`, color: "#1a1405" }}
      >
        <div className="text-4xl">✨</div>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Robinhood Gold</h1>
        <p className="mt-1 text-sm font-medium opacity-80">Premium tools for serious investors.</p>
        <div className="mt-2 text-xs font-semibold opacity-70">{money(GOLD_FEE_PER_TICK)}/tick subscription</div>
      </div>

      <div className="space-y-2">
        {PERKS.map((p) => (
          <div key={p.title} className="flex gap-3 rounded-2xl border border-white/5 bg-bg-card p-4">
            <span className="text-2xl">{p.icon}</span>
            <div>
              <div className="text-sm font-bold">{p.title}</div>
              <div className="text-[12px] text-muted">{p.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/5 bg-bg-card p-4 text-sm">
        <Row label="Cash interest rate" value={`${(GOLD_CASH_APY_PER_TICK * 100).toFixed(3)}% / tick`} />
        <Row label="Margin interest rate" value={`${(MARGIN_RATE_PER_TICK * 100).toFixed(2)}% / tick`} />
        <Row label="Your buying power" value={money(buyingPower(state))} />
        {inv.gold && <Row label="Margin used" value={money(inv.marginUsed)} accent={inv.marginUsed > 0 ? RH_GOLD : undefined} />}
        <Row label="Lifetime dividends" value={money(inv.dividendsEarned)} />
      </div>

      {inv.gold && inv.marginUsed > 0 && (
        <div className="rounded-2xl border border-white/5 bg-bg-card p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Repay margin</div>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={repay}
              placeholder={money(inv.marginUsed)}
              onChange={(e) => setRepay(e.target.value)}
              className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-base font-bold outline-none"
            />
            <button
              onClick={() => {
                run(gameActions.repayMargin(state, parseFloat(repay) || inv.marginUsed));
                setRepay("");
              }}
              className="rounded-xl bg-white/10 px-4 text-sm font-semibold active:bg-white/20"
            >
              Repay
            </button>
          </div>
        </div>
      )}

      {inv.gold ? (
        <button
          onClick={() => run(gameActions.cancelGold(state))}
          className="w-full rounded-xl bg-white/10 py-3 text-sm font-bold active:bg-white/20"
        >
          Cancel Gold
        </button>
      ) : (
        <button
          onClick={() => run(gameActions.subscribeGold(state))}
          className="w-full rounded-xl py-3 text-base font-extrabold"
          style={{ background: RH_GOLD, color: "#1a1405" }}
        >
          Upgrade to Gold
        </button>
      )}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex justify-between border-t border-white/5 py-2 first:border-t-0">
      <span className="text-muted">{label}</span>
      <span className="font-semibold tabular-nums" style={accent ? { color: accent } : undefined}>
        {value}
      </span>
    </div>
  );
}
