"use client";

import { useGame, gameActions } from "@/lib/store";
import { money } from "@/lib/format";
import { Button, Card, SectionTitle, Pill } from "@/components/ui";
import { PROPERTIES } from "@/lib/game/data";

export default function RealEstatePage() {
  const state = useGame((s) => s.state);
  const run = useGame((s) => s.run);
  if (!state) return null;
  const { properties, stats } = state;

  return (
    <div className="space-y-3">
      <SectionTitle sub="Own the land. Collect the rent.">Real Estate</SectionTitle>

      {properties.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Portfolio</div>
          {properties.map((owned, i) => {
            const def = PROPERTIES.find((p) => p.id === owned.propertyId)!;
            const equity = owned.currentValue - owned.mortgageRemaining;
            return (
              <Card key={i}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">{def.name}</div>
                    <div className="text-[11px] text-muted">
                      {def.region} · {def.type}
                    </div>
                  </div>
                  <Pill tone={owned.rented ? "up" : "neutral"}>{owned.rented ? "Rented" : "Vacant"}</Pill>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <Info label="Value" value={money(owned.currentValue)} />
                  <Info label="Equity" value={money(equity)} />
                  <Info label="Rent/tick" value={money(def.rentPerTick)} />
                </div>
                {owned.mortgageRemaining > 0 && (
                  <div className="mt-1 text-[11px] text-danger">
                    Mortgage: {money(owned.mortgageRemaining)} remaining
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  {def.rentPerTick > 0 && (
                    <Button variant="secondary" className="flex-1" onClick={() => run(gameActions.toggleRent(state, i))}>
                      {owned.rented ? "Clear tenant" : "List for rent"}
                    </Button>
                  )}
                  <Button variant="danger" className="flex-1" onClick={() => run(gameActions.sellProperty(state, i))}>
                    Sell
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">Market Listings</div>
        {PROPERTIES.map((p) => {
          const down = p.baseValue * 0.2;
          return (
            <Card key={p.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-[11px] text-muted">
                    {p.region} · {p.type} · {p.rentPerTick > 0 ? `${money(p.rentPerTick)}/tick rent` : "no rent"}
                  </div>
                </div>
                <div className="text-right text-sm font-bold">{money(p.baseValue)}</div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  className="flex-1"
                  disabled={p.baseValue > stats.cash}
                  onClick={() => run(gameActions.buyProperty(state, p.id, false))}
                >
                  Buy cash
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={down > stats.cash}
                  onClick={() => run(gameActions.buyProperty(state, p.id, true))}
                >
                  Mortgage ({money(down)} down)
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/5 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
