"use client";

import { useGame, gameActions } from "@/lib/store";
import { money } from "@/lib/format";
import { Button, Card, SectionTitle, Pill, LockedScreen, ProgressBar } from "@/components/ui";
import { BUSINESS_TYPES, FEATURE_UNLOCKS } from "@/lib/game/data";
import {
  BANKRUPT_GRACE_TICKS,
  IPO_DIVIDEND_RATIO,
  MANAGER_SPECIALTIES,
  MAX_LOCATIONS,
  categorySynergyMult,
  expansionCost,
  ipoEligible,
  ipoValuation,
  locationsFactor,
  managerSalary,
  mechanicFor,
  salePrice,
} from "@/lib/game/business";
import { hasFeature } from "@/lib/game/progression";
import type { ManagerSpecialty, OwnedBusiness } from "@/lib/game/types";

export default function BusinessPage() {
  const state = useGame((s) => s.state);
  const run = useGame((s) => s.run);
  if (!state) return null;
  const { businesses, stats, progression } = state;

  if (!hasFeature(state, "business")) {
    const need = FEATURE_UNLOCKS.find((r) => r.flag === "business")?.netWorth ?? 0;
    const remaining = Math.max(0, need - stats.netWorth);
    return (
      <LockedScreen
        icon="🏢"
        title="Businesses"
        requirement={`Reach ${money(need)} net worth to register a business. You're at ${money(stats.netWorth)} — ${money(remaining)} to go.`}
      />
    );
  }

  return (
    <div className="space-y-3 pb-6">
      <SectionTitle sub="Build income engines that work while you sleep. Don't let any go bankrupt.">
        Businesses
      </SectionTitle>

      {businesses.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Your Portfolio</div>
          {businesses.map((biz, i) => (
            <BusinessCard key={`${biz.businessId}-${i}`} biz={biz} index={i} cash={stats.cash} state={state} run={run} />
          ))}
        </div>
      )}

      <Marketplace state={state} run={run} progressionLevel={progression.level} cash={stats.cash} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-business card — surfaces mechanic, manager, event, and actions
// ---------------------------------------------------------------------------

function BusinessCard({
  biz,
  index,
  cash,
  state,
  run,
}: {
  biz: OwnedBusiness;
  index: number;
  cash: number;
  state: ReturnType<typeof useGame.getState>["state"];
  run: ReturnType<typeof useGame.getState>["run"];
}) {
  const def = BUSINESS_TYPES.find((b) => b.id === biz.businessId);
  if (!def || !state) return null;
  const mech = mechanicFor(biz);

  // ----- IPO'd: passive dividend card, no management UI -----
  if (biz.isPublic) {
    const locFactor = locationsFactor(biz.locations);
    const dividend = def.baseRevenuePerTick * biz.level * locFactor * IPO_DIVIDEND_RATIO * (1 + state.economy.gdpGrowth) * 0.12; // BIZ_PROFIT_SCALE
    return (
      <Card className="border-accent-2/40 bg-accent-2/5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{def.icon}</span>
            <div>
              <div className="text-base font-bold leading-tight">{def.name}</div>
              <div className="text-[11px] text-muted">
                {def.category} · Lv {biz.level} · {biz.locations} location{biz.locations > 1 ? "s" : ""}
              </div>
            </div>
          </div>
          <Pill tone="up">📈 Public</Pill>
        </div>
        <div className="mt-3 rounded-xl bg-white/5 p-3 text-center text-xs">
          <div className="text-muted">Passive dividend</div>
          <div className="text-lg font-bold text-accent-2">{money(dividend)}/tick</div>
        </div>
        <button
          onClick={() => run(gameActions.sellBusiness(state, index))}
          className="mt-2 w-full text-center text-[11px] text-muted active:text-white"
        >
          Sell shares for {money(salePrice(biz))}
        </button>
      </Card>
    );
  }

  // ----- Active business -----
  // Estimate per-tick profit so the player can see whether they're bleeding.
  const macroMult = 1 + state.economy.gdpGrowth;
  const mktgMult = 1 + biz.marketingLevel * 0.12;
  const locFactor = locationsFactor(biz.locations);
  const synergy = categorySynergyMult(def.category, state);
  const revenue = def.baseRevenuePerTick * biz.level * locFactor * mech.revMult(biz.mState) * mktgMult * macroMult * synergy * (biz.manager ? MANAGER_SPECIALTIES[biz.manager.specialty].revMult : 1);
  const cost = def.baseCostPerTick * biz.level * locFactor * mech.costMult(biz.mState) * (biz.manager ? MANAGER_SPECIALTIES[biz.manager.specialty].costMult : 1) + (biz.manager?.salaryPerTick ?? 0) * locFactor;
  const profit = revenue - cost;

  const inRed = biz.reserve < 0;
  const ticksToBankrupt = inRed ? Math.max(0, BANKRUPT_GRACE_TICKS - biz.redTicks) : null;
  const upgradeCost = def.startupCost * 0.5 * biz.level;
  const marketingCost = 5000 * (biz.marketingLevel + 1);
  const opsCost = Math.round(def.startupCost * 0.06 * biz.level);
  const expandCost = expansionCost(biz);
  const canExpand = biz.locations < MAX_LOCATIONS;
  const ipoGate = ipoEligible(biz);
  const ipoPrice = ipoValuation(biz);

  return (
    <Card className={inRed ? "border-danger/50" : "border-accent/30"}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{def.icon}</span>
          <div>
            <div className="text-base font-bold leading-tight">{def.name}</div>
            <div className="text-[11px] text-muted">
              {def.category} · Lv {biz.level} · {biz.locations}× loc
              {synergy > 1 && <span className="text-accent-2"> · synergy +{Math.round((synergy - 1) * 100)}%</span>}
            </div>
          </div>
        </div>
        <Pill tone={profit >= 0 ? "up" : "down"}>{money(profit)}/tick</Pill>
      </div>

      {/* Reserve gauge — bankruptcy countdown when red */}
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[11px] text-muted">
          <span>Cash reserve</span>
          <span className={inRed ? "text-danger font-semibold" : ""}>
            {money(biz.reserve)}{ticksToBankrupt != null && ` · ${ticksToBankrupt}s to bankruptcy`}
          </span>
        </div>
        <ProgressBar value={Math.max(0, Math.min(100, (biz.reserve / Math.max(1, def.startupCost * 0.1)) * 100))} />
      </div>

      {/* Mechanic state */}
      <MechanicWidget biz={biz} index={index} cash={cash} run={run} state={state} />

      {/* Active event (if any) */}
      {biz.event && (
        <div className="mt-3 rounded-xl border border-amber-300/40 bg-amber-300/10 p-3">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-200">
            <span>{biz.event.icon}</span>
            <span>{biz.event.title}</span>
            <span className="ml-auto text-[10px] text-muted">{biz.event.ticksRemaining}s left</span>
          </div>
          <div className="mt-1 text-[12px] text-amber-100/90">{biz.event.description}</div>
          {biz.event.reserveDrainPerTick != null && (
            <div className="mt-1 text-[10px] text-danger">−{biz.event.reserveDrainPerTick}/tick reserve drain while unresolved</div>
          )}
          <div className="mt-2 flex flex-col gap-1.5">
            {biz.event.options.map((opt, oi) => (
              <button
                key={oi}
                onClick={() => run(gameActions.resolveEvent(state, index, oi))}
                disabled={opt.cost != null && opt.cost > cash}
                className="flex items-center justify-between rounded-lg bg-white/10 px-3 py-1.5 text-left text-xs font-semibold active:bg-white/20 disabled:opacity-50"
              >
                <span>{opt.label}</span>
                {opt.cost != null && <span className="text-muted">{money(opt.cost)}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Manager */}
      <ManagerWidget biz={biz} index={index} cash={cash} state={state} run={run} />

      {/* Actions */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button variant="secondary" disabled={upgradeCost > cash} onClick={() => run(gameActions.upgradeBusiness(state, index))}>
          ⬆️ Upgrade
        </Button>
        <Button variant="secondary" disabled={marketingCost > cash} onClick={() => run(gameActions.investMarketing(state, index))}>
          📣 Market
        </Button>
        <Button variant="secondary" disabled={opsCost > cash} onClick={() => run(gameActions.investBusinessOps(state, index))}>
          🔧 Invest
        </Button>
      </div>
      <div className="mt-1 grid grid-cols-3 gap-2 text-[10px] text-muted text-center">
        <span>{money(upgradeCost)}</span>
        <span>{money(marketingCost)}</span>
        <span>{money(opsCost)}</span>
      </div>

      {/* Chain expansion + IPO */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          disabled={!canExpand || expandCost > cash}
          onClick={() => run(gameActions.expandBusiness(state, index))}
        >
          🏬 {canExpand ? `Expand (${money(expandCost)})` : "Max chain"}
        </Button>
        <Button
          variant="secondary"
          disabled={!ipoGate.ok}
          onClick={() => run(gameActions.ipoBusiness(state, index))}
          title={ipoGate.reason}
        >
          📈 {ipoGate.ok ? `IPO (${money(ipoPrice)})` : ipoGate.reason}
        </Button>
      </div>

      <button
        onClick={() => run(gameActions.sellBusiness(state, index))}
        className="mt-3 w-full text-center text-[11px] text-muted active:text-white"
      >
        Sell for {money(salePrice(biz))}
      </button>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Mechanic-specific widget — each mechanic renders differently
// ---------------------------------------------------------------------------

function MechanicWidget({
  biz,
  index,
  cash: _cash,
  state,
  run,
}: {
  biz: OwnedBusiness;
  index: number;
  cash: number;
  state: NonNullable<ReturnType<typeof useGame.getState>["state"]>;
  run: ReturnType<typeof useGame.getState>["run"];
}) {
  const mech = mechanicFor(biz);
  const def = BUSINESS_TYPES.find((b) => b.id === biz.businessId)!;
  const pct = ((biz.mState - mech.min) / (mech.max - mech.min)) * 100;

  // For menu mechanic, give a quick +/- slider so players can experiment.
  if (def.mechanic === "menu") {
    return (
      <div className="mt-3 rounded-xl bg-white/5 p-3">
        <div className="mb-1 flex justify-between text-[11px] text-muted">
          <span>{mech.label}</span>
          <span className="font-semibold text-accent">{biz.mState.toFixed(2)}{mech.unit}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => run(gameActions.setBusinessMState(state, index, biz.mState - 0.1))}
            className="rounded-lg bg-white/10 px-3 py-1 text-sm font-bold active:bg-white/20"
          >−</button>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
          <button
            onClick={() => run(gameActions.setBusinessMState(state, index, biz.mState + 0.1))}
            className="rounded-lg bg-white/10 px-3 py-1 text-sm font-bold active:bg-white/20"
          >+</button>
        </div>
        <div className="mt-1 text-[10px] text-muted">
          Higher markup = more per sale, fewer customers. Sweet spot ≈ 1.2.
        </div>
      </div>
    );
  }

  // Everything else: a labelled bar showing how healthy the mechanic state is.
  const tone = pct < 25 ? "bg-danger" : pct < 50 ? "bg-amber-400" : "bg-accent-2";
  const value = biz.mState.toFixed(mech.unit === "" ? 0 : 0);
  return (
    <div className="mt-3 rounded-xl bg-white/5 p-3">
      <div className="mb-1 flex justify-between text-[11px] text-muted">
        <span>{mech.label}</span>
        <span className="font-semibold text-accent-2">{value}{mech.unit}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-[10px] text-muted">{mechanicHelp(def.mechanic)}</div>
    </div>
  );
}

function mechanicHelp(m: string): string {
  switch (m) {
    case "churn": return "Members drop ~1%/tick. Marketing / Invest brings them back.";
    case "quality": return "Quality drifts down without attention. Invest to restore it.";
    case "hype": return "Hype decays fast. Marketing creates a spike — ride the wave.";
    case "capacity": return "Occupancy decays without marketing. Higher = more revenue.";
    case "menu": return "Slide markup to find your sweet spot.";
  }
  return "";
}

// ---------------------------------------------------------------------------
// Manager — hire / promote / fire
// ---------------------------------------------------------------------------

function ManagerWidget({
  biz,
  index,
  cash,
  state,
  run,
}: {
  biz: OwnedBusiness;
  index: number;
  cash: number;
  state: NonNullable<ReturnType<typeof useGame.getState>["state"]>;
  run: ReturnType<typeof useGame.getState>["run"];
}) {
  const def = BUSINESS_TYPES.find((b) => b.id === biz.businessId)!;
  if (biz.manager) {
    const spec = MANAGER_SPECIALTIES[biz.manager.specialty];
    const promoteCost = managerSalary(biz.manager.level + 1, biz) * 60;
    return (
      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{spec.icon}</span>
            <div>
              <div className="text-sm font-bold">{biz.manager.name}</div>
              <div className="text-[10px] text-muted">
                {spec.label} · Lv {biz.manager.level} · {money(biz.manager.salaryPerTick)}/tick
              </div>
            </div>
          </div>
          <div className="text-right text-[10px] text-muted">
            {spec.revMult !== 1 && <div>×{spec.revMult.toFixed(2)} rev</div>}
            {spec.costMult !== 1 && <div>×{spec.costMult.toFixed(2)} cost</div>}
          </div>
        </div>
        <div className="mt-2 flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            disabled={biz.manager.level >= 5 || promoteCost > cash}
            onClick={() => run(gameActions.promoteManager(state, index))}
          >
            Promote ({money(promoteCost)})
          </Button>
          <Button
            variant="ghost"
            onClick={() => run(gameActions.fireManager(state, index))}
          >
            Fire
          </Button>
        </div>
      </div>
    );
  }

  // No manager — show the three hire options.
  const hireCost = (lvl: number) => Math.round(def.startupCost * (0.04 + 0.03 * lvl));
  return (
    <div className="mt-3 rounded-xl border border-dashed border-white/10 bg-white/5 p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted">Hire a manager</div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {(Object.entries(MANAGER_SPECIALTIES) as [ManagerSpecialty, typeof MANAGER_SPECIALTIES.ops][]).map(([key, spec]) => {
          const c = hireCost(1);
          return (
            <button
              key={key}
              disabled={c > cash}
              onClick={() => run(gameActions.hireManager(state, index, key, 1))}
              className="flex flex-col items-center gap-0.5 rounded-lg bg-white/10 p-2 text-center text-[11px] font-semibold active:bg-white/20 disabled:opacity-40"
            >
              <span className="text-lg">{spec.icon}</span>
              <span>{spec.label}</span>
              <span className="text-[10px] text-muted">{money(c)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Marketplace — group by category
// ---------------------------------------------------------------------------

function Marketplace({
  state,
  run,
  progressionLevel,
  cash,
}: {
  state: NonNullable<ReturnType<typeof useGame.getState>["state"]>;
  run: ReturnType<typeof useGame.getState>["run"];
  progressionLevel: number;
  cash: number;
}) {
  // Group by category for browsing.
  const byCategory: Record<string, typeof BUSINESS_TYPES> = {};
  for (const b of BUSINESS_TYPES) (byCategory[b.category] ??= []).push(b);

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">
        Marketplace · {BUSINESS_TYPES.length} listings
      </div>
      {Object.entries(byCategory).map(([cat, list]) => (
        <div key={cat} className="space-y-2">
          <div className="text-[11px] font-semibold text-muted">{cat}</div>
          {list.map((b) => {
            const levelLocked = b.unlockLevel != null && progressionLevel < b.unlockLevel;
            const affordable = b.startupCost <= cash;
            return (
              <Card key={b.id} className={levelLocked ? "opacity-60" : ""}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{b.icon}</span>
                    <div>
                      <div className="text-sm font-bold">{b.name}</div>
                      <div className="text-[11px] text-muted">
                        {b.description} · {mechanicLabel(b.mechanic)}
                      </div>
                    </div>
                  </div>
                  <Button
                    disabled={levelLocked || !affordable}
                    onClick={() => run(gameActions.startBusiness(state, b.id))}
                  >
                    {levelLocked ? `Lv ${b.unlockLevel}` : affordable ? money(b.startupCost) : "🔒"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function mechanicLabel(m: string): string {
  return ({ menu: "Menu pricing", churn: "Subscription", quality: "Quality-driven", hype: "Hype-cycle", capacity: "Capacity" } as Record<string, string>)[m] ?? m;
}
