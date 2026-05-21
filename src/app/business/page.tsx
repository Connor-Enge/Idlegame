"use client";

import { useGame, gameActions } from "@/lib/store";
import { money } from "@/lib/format";
import { Button, Card, SectionTitle, Pill } from "@/components/ui";
import { BUSINESS_TYPES } from "@/lib/game/data";

export default function BusinessPage() {
  const state = useGame((s) => s.state);
  const run = useGame((s) => s.run);
  if (!state) return null;
  const { businesses, stats, economy } = state;

  return (
    <div className="space-y-3">
      <SectionTitle sub="Build income engines that work while you sleep.">Businesses</SectionTitle>

      {businesses.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">You Own</div>
          {businesses.map((biz, i) => {
            const def = BUSINESS_TYPES.find((b) => b.id === biz.businessId)!;
            const revMult = biz.level * (1 + biz.marketingLevel * 0.15) * (1 + economy.gdpGrowth);
            const revenue = def.baseRevenuePerTick * revMult;
            const cost = def.baseCostPerTick * biz.level + biz.employees * 5;
            const profit = revenue - cost;
            const upgradeCost = def.startupCost * 0.5 * biz.level;
            return (
              <Card key={i}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">{def.name}</div>
                    <div className="text-[11px] text-muted">{def.category}</div>
                  </div>
                  <Pill tone={profit >= 0 ? "up" : "down"}>{money(profit)}/tick</Pill>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <Info label="Level" value={`${biz.level}`} />
                  <Info label="Staff" value={`${biz.employees}`} />
                  <Info label="Marketing" value={`${biz.marketingLevel}`} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Button
                    variant="secondary"
                    disabled={upgradeCost > stats.cash}
                    onClick={() => run(gameActions.upgradeBusiness(state, i))}
                  >
                    Upgrade
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={2000 * (biz.employees + 1) > stats.cash}
                    onClick={() => run(gameActions.hireEmployee(state, i))}
                  >
                    Hire
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={5000 * (biz.marketingLevel + 1) > stats.cash}
                    onClick={() => run(gameActions.investMarketing(state, i))}
                  >
                    Market
                  </Button>
                </div>
                <div className="mt-1 text-[11px] text-muted">Next upgrade: {money(upgradeCost)}</div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">Start a Business</div>
        {BUSINESS_TYPES.map((b) => (
          <Card key={b.id}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">{b.name}</div>
                <div className="text-[11px] text-muted">{b.description}</div>
                <div className="mt-1 text-[11px] text-muted">
                  ~{money(b.baseRevenuePerTick - b.baseCostPerTick)}/tick base profit
                </div>
              </div>
              <div className="text-right text-sm font-bold">{money(b.startupCost)}</div>
            </div>
            <Button
              className="mt-3 w-full"
              disabled={b.startupCost > stats.cash}
              onClick={() => run(gameActions.startBusiness(state, b.id))}
            >
              Found ({money(b.startupCost)})
            </Button>
          </Card>
        ))}
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
