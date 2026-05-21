"use client";

import { useGame } from "@/lib/store";
import { pct } from "@/lib/format";
import { Card, SectionTitle, Pill } from "@/components/ui";

const PHASE_BLURB: Record<string, string> = {
  boom: "Risk-on. Everything goes up. Enjoy it while it lasts.",
  expansion: "Steady growth. Hiring is strong, markets grind higher.",
  peak: "The top feels permanent. It never is.",
  recession: "Contraction. Cash is king, bargains appear.",
  depression: "Deep freeze. Survival mode for most businesses.",
  recovery: "Green shoots. The brave start buying.",
};

export default function EconomyPage() {
  const state = useGame((s) => s.state);
  if (!state) return null;
  const e = state.economy;

  return (
    <div className="space-y-3">
      <SectionTitle sub="One simulated world. Everything reacts to it.">Global Economy</SectionTitle>

      <Card>
        <div className="flex items-center justify-between">
          <div className="text-2xl font-extrabold capitalize">{e.phase}</div>
          <Pill tone={e.marketSentiment >= 0 ? "up" : "down"}>
            sentiment {e.marketSentiment.toFixed(2)}
          </Pill>
        </div>
        <p className="mt-1 text-sm text-muted">{PHASE_BLURB[e.phase]}</p>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Metric label="GDP Growth" value={pct(e.gdpGrowth * 100)} good={e.gdpGrowth >= 0} />
        <Metric label="Inflation" value={`${e.inflation.toFixed(1)}%`} good={e.inflation < 4} />
        <Metric label="Interest Rate" value={`${e.interestRate.toFixed(1)}%`} good={e.interestRate < 5} />
        <Metric label="Unemployment" value={`${e.unemployment.toFixed(1)}%`} good={e.unemployment < 6} />
      </div>

      <Card>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
          Active Events ({e.activeEvents.length})
        </div>
        {e.activeEvents.length === 0 ? (
          <p className="text-sm text-muted">Quiet on the wires. For now.</p>
        ) : (
          <ul className="space-y-3">
            {e.activeEvents.map((ev) => (
              <li key={ev.id}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-accent">{ev.title}</span>
                  <span className="text-[11px] text-muted">{ev.ticksRemaining}t left</span>
                </div>
                <p className="text-xs text-muted">{ev.description}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="text-center text-[11px] text-muted">Economic tick #{e.tick}</div>
    </div>
  );
}

function Metric({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <Card className="py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`text-lg font-bold ${good ? "text-accent-2" : "text-danger"}`}>{value}</div>
    </Card>
  );
}
