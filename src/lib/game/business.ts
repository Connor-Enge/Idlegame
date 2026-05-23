// Business simulation: per-tick economics, mechanic-specific drift / decisions,
// random events, and bankruptcy. Imports are kept lean so this can be used by
// both the engine and the actions layer without circular pulls.

import { BIZ_PROFIT_SCALE, BUSINESS_TYPES } from "./data";
import { incomeMultiplier } from "./progression";
import type {
  BizEvent,
  BusinessMechanic,
  GameState,
  Manager,
  ManagerSpecialty,
  OwnedBusiness,
} from "./types";

// ---------------------------------------------------------------------------
// Mechanic definitions — each business type is tagged with one of these. The
// mechanic supplies (a) a default starting mState value, (b) a per-tick drift
// that nudges mState toward its idle baseline, and (c) revenue/cost
// multipliers that depend on mState. The universal income formula then folds
// these in alongside level / marketing / GDP / manager / incomeMultiplier.
// ---------------------------------------------------------------------------

export interface MechanicSpec {
  label: string;
  unit: string;
  // mState a brand-new business of this mechanic should start with.
  initial(): number;
  // Where mState drifts toward each tick when the player doesn't act.
  driftTarget(state: number): number;
  // How aggressively it drifts (per tick fraction of the gap).
  driftRate: number;
  // Revenue multiplier derived from mState (1.0 = baseline).
  revMult(mState: number): number;
  // Cost multiplier derived from mState (1.0 = baseline).
  costMult(mState: number): number;
  // Min / max clamp.
  min: number;
  max: number;
}

export const MECHANICS: Record<BusinessMechanic, MechanicSpec> = {
  // ---- Menu pricing: markup × demand_curve. Higher prices = more revenue
  //      per customer but fewer customers; sweet spot ~1.0–1.2x markup.
  menu: {
    label: "Menu markup",
    unit: "×",
    initial: () => 1.0,
    driftTarget: () => 1.0, // bleeds back to neutral if untouched
    driftRate: 0.01,
    revMult: (m) => {
      // demand = max(0, 1.4 - 0.4m) ; revenue = m * demand
      const demand = Math.max(0.1, 1.4 - 0.4 * m);
      return m * demand; // peaks at m≈1.75 but high m kills demand → loss
    },
    costMult: () => 1,
    min: 0.5,
    max: 2.0,
  },

  // ---- Subscription churn: mState = active members. Drains every tick.
  //      A near-empty business loses money fast (rev floor 0.3); a full one
  //      mints it (peaks ~1.7). Marketing / Invest brings members back.
  churn: {
    label: "Members",
    unit: "",
    initial: () => 1000,
    driftTarget: () => 0,
    driftRate: 0.012, // ~1.2% members lost per tick
    revMult: (m) => 0.3 + (m / 1000) * 0.6,
    costMult: () => 1,
    min: 0,
    max: 5000,
  },

  // ---- Quality (services): drifts down without maintenance. Low quality is
  //      a real loss-maker (rev floor 0.3) — player must invest to keep it
  //      above the break-even line.
  quality: {
    label: "Quality",
    unit: "/100",
    initial: () => 75,
    driftTarget: () => 30,
    driftRate: 0.005,
    revMult: (m) => 0.3 + (m / 100) * 1.1, // 30%..140% revenue
    costMult: (m) => 1 - (m / 100) * 0.1, // high quality slightly cuts waste
    min: 0,
    max: 100,
  },

  // ---- Hype (entertainment / apps): wave-like. Decays fast. Cold hype is
  //      a hard loss; peak hype is enormous. Marketing creates a big spike.
  hype: {
    label: "Hype",
    unit: "/100",
    initial: () => 60,
    driftTarget: () => 15,
    driftRate: 0.022,
    revMult: (m) => 0.2 + (m / 100) * 2.6, // 20%..280%
    costMult: () => 1,
    min: 0,
    max: 100,
  },

  // ---- Capacity utilization: occupancy %. Climbs with marketing, decays
  //      without. Revenue scales linearly with occupancy. Fixed costs are
  //      brutal at low occupancy — half-empty places hemorrhage cash.
  capacity: {
    label: "Occupancy",
    unit: "%",
    initial: () => 55,
    driftTarget: () => 25,
    driftRate: 0.006,
    revMult: (m) => 0.1 + (m / 100) * 1.6, // 10%..170%
    costMult: () => 1,
    min: 0,
    max: 100,
  },
};

// ---------------------------------------------------------------------------
// Manager specialties — hired managers buff a specific lever.
// ---------------------------------------------------------------------------

export const MANAGER_SPECIALTIES: Record<ManagerSpecialty, { label: string; icon: string; revMult: number; costMult: number; driftMult: number }> = {
  // Ops manager: cuts costs, slows the "bad" drift of churn / quality / hype.
  ops: { label: "Operations", icon: "📊", revMult: 1, costMult: 0.78, driftMult: 0.6 },
  // Marketing manager: bumps revenue, boosts mState upward each tick.
  marketing: { label: "Marketing", icon: "📣", revMult: 1.18, costMult: 1, driftMult: 1 },
  // Finance manager: boosts profit retention (cuts cost a bit, less reserve drain on events).
  finance: { label: "Finance", icon: "💼", revMult: 1.05, costMult: 0.9, driftMult: 1 },
};

const FIRST_NAMES = ["Alex", "Jordan", "Riley", "Casey", "Morgan", "Taylor", "Sam", "Jamie", "Drew", "Pat", "Skyler", "Quinn"];
const LAST_NAMES = ["Lee", "Patel", "Garcia", "Chen", "Khan", "Brown", "Walker", "Park", "Adams", "Cole", "Bryant", "Hayes"];

export function randomManagerName(): string {
  return `${FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`;
}

export function managerSalary(level: number, business: OwnedBusiness): number {
  const def = BUSINESS_TYPES.find((b) => b.id === business.businessId);
  // Salary = a fraction of the business's gross revenue, scaling with manager level.
  const baseRev = def?.baseRevenuePerTick ?? 100;
  return Math.round(baseRev * (0.08 + level * 0.04) * business.level);
}

// ---------------------------------------------------------------------------
// Events — random crises (or windfalls) that spawn on a business. The player
// picks an option; the chosen effect applies; the event clears. Ignoring it
// burns reserve every tick and the event eventually expires on its own.
// ---------------------------------------------------------------------------

interface EventTemplate {
  id: string;
  title: string;
  description: string;
  icon: string;
  // Probability per tick. ~0.0008 = roughly one event per ~20 minutes per business.
  weight: number;
  options: Array<{ label: string; effect: { reserveDelta?: number; mStateDelta?: number; cashDelta?: number; bankrupt?: boolean }; costScale?: number }>;
  reserveDrainPerTick?: number;
  // Optional filter — restrict to certain mechanics.
  mechanics?: BusinessMechanic[];
}

const EVENT_POOL: EventTemplate[] = [
  {
    id: "inspector", title: "Health Inspector", icon: "🚨",
    description: "Pay for fixes or risk a fine and a hit to quality.",
    weight: 0.0006,
    reserveDrainPerTick: 8,
    options: [
      { label: "Pay for repairs", effect: {}, costScale: 0.4 },
      { label: "Bribe inspector", effect: {}, costScale: 0.2 },
      { label: "Ignore", effect: { mStateDelta: -25, reserveDelta: -2000 } },
    ],
  },
  {
    id: "viral-hit", title: "Viral Hit", icon: "🚀",
    description: "Your business is trending. Capitalize or stay humble.",
    weight: 0.0005,
    options: [
      { label: "Run a promo", effect: { mStateDelta: 30 }, costScale: 0.1 },
      { label: "Ride the wave", effect: { mStateDelta: 12 } },
    ],
  },
  {
    id: "rent-hike", title: "Landlord Raises Rent", icon: "📈",
    description: "Pay the bump, negotiate a multi-year lock, or move out.",
    weight: 0.0005,
    reserveDrainPerTick: 4,
    options: [
      { label: "Accept", effect: { reserveDelta: -500 } },
      { label: "Lock 3-yr lease", effect: {}, costScale: 0.25 },
      { label: "Move locations", effect: { mStateDelta: -15 }, costScale: 0.05 },
    ],
  },
  {
    id: "supply-shock", title: "Supply Shock", icon: "📦",
    description: "Costs spiking. Hedge, pass-through, or absorb.",
    weight: 0.0006,
    reserveDrainPerTick: 6,
    options: [
      { label: "Hedge contracts", effect: {}, costScale: 0.2 },
      { label: "Raise prices", effect: { mStateDelta: -10 } },
      { label: "Absorb the hit", effect: { reserveDelta: -3000 } },
    ],
  },
  {
    id: "lawsuit", title: "Lawsuit", icon: "⚖️",
    description: "A customer's threatening to sue. Settle quietly or fight in court.",
    weight: 0.0003,
    reserveDrainPerTick: 12,
    options: [
      { label: "Settle out of court", effect: {}, costScale: 0.5 },
      { label: "Fight it", effect: { reserveDelta: -10_000, mStateDelta: -5 } },
      { label: "Insurance handles it", effect: { reserveDelta: -2_000 } },
    ],
  },
  {
    id: "ransomware", title: "Ransomware Attack", icon: "🦠",
    description: "Systems locked. Pay up, restore from backup, or shrug.",
    weight: 0.0003,
    reserveDrainPerTick: 15,
    options: [
      { label: "Pay ransom", effect: {}, costScale: 0.6 },
      { label: "Restore from backups", effect: { mStateDelta: -10 }, costScale: 0.1 },
      { label: "Tell them to pound sand", effect: { reserveDelta: -8_000, mStateDelta: -20 } },
    ],
    mechanics: ["churn", "hype", "capacity"],
  },
  {
    id: "celebrity", title: "Celebrity Cameo", icon: "🤩",
    description: "A celebrity dropped in. Use it or lose it.",
    weight: 0.0004,
    options: [
      { label: "Big publicity push", effect: { mStateDelta: 35 }, costScale: 0.15 },
      { label: "Soft mention", effect: { mStateDelta: 12 } },
    ],
  },
  {
    id: "key-employee", title: "Star Hire Available", icon: "🌟",
    description: "A top-tier candidate is interviewing nearby. Snap them up?",
    weight: 0.0004,
    options: [
      { label: "Sign them on", effect: { mStateDelta: 18 }, costScale: 0.3 },
      { label: "Pass", effect: {} },
    ],
  },
  {
    id: "windfall", title: "Tax Refund", icon: "💰",
    description: "The accountant found a deduction. Free money lands in the books.",
    weight: 0.0003,
    options: [
      { label: "Bank it", effect: { reserveDelta: 5000 } },
    ],
  },
  {
    id: "competitor-fail", title: "Competitor Folded", icon: "🏚️",
    description: "A rival went under — their customers are looking for somewhere new.",
    weight: 0.0004,
    options: [
      { label: "Welcome them in", effect: { mStateDelta: 25 } },
      { label: "Aggressive ad buy", effect: { mStateDelta: 40 }, costScale: 0.18 },
    ],
  },
  {
    id: "regulation", title: "New Regulation", icon: "📜",
    description: "Compliance just got more expensive. Lobby, comply, or fight it.",
    weight: 0.0005,
    reserveDrainPerTick: 5,
    options: [
      { label: "Lobby your way out", effect: {}, costScale: 0.4 },
      { label: "Comply", effect: { reserveDelta: -3000 } },
      { label: "Ignore (gamble)", effect: { mStateDelta: -10, reserveDelta: -1000 } },
    ],
  },
];

function pickEvent(business: OwnedBusiness, def: { mechanic: BusinessMechanic }): BizEvent | null {
  // Weighted roll across event pool, gated by mechanic filter.
  const eligible = EVENT_POOL.filter((e) => !e.mechanics || e.mechanics.includes(def.mechanic));
  let total = 0;
  for (const e of eligible) total += e.weight;
  if (Math.random() > total) return null; // no event this tick
  let r = Math.random() * total;
  for (const e of eligible) {
    if (r < e.weight) {
      return {
        id: `${e.id}-${Math.random().toString(36).slice(2, 7)}`,
        title: e.title,
        description: e.description,
        icon: e.icon,
        options: e.options.map((o) => ({
          label: o.label,
          effect: { ...o.effect },
          cost: o.costScale != null ? Math.round((BUSINESS_TYPES.find((b) => b.id === business.businessId)?.startupCost ?? 1000) * o.costScale) : undefined,
        })),
        ticksRemaining: 40 + Math.floor(Math.random() * 40),
        reserveDrainPerTick: e.reserveDrainPerTick,
      };
    }
    r -= e.weight;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Bankruptcy
// ---------------------------------------------------------------------------

export const BANKRUPT_GRACE_TICKS = 90; // ~1.5 minutes of red before delisting

// Multi-location: each new outlet beyond the first contributes 95% of the
// last one's economics (diminishing returns), so chains scale meaningfully
// but a single mega-chain doesn't dwarf the rest of the portfolio.
const LOC_DECAY = 0.95;
export function locationsFactor(locations: number): number {
  // 1 location → 1.0; 5 → ~4.5; 10 → ~8.0
  let total = 0;
  for (let i = 0; i < Math.max(1, locations); i++) total += Math.pow(LOC_DECAY, i);
  return total;
}
export function expansionCost(b: OwnedBusiness): number {
  const def = BUSINESS_TYPES.find((x) => x.id === b.businessId);
  if (!def) return Infinity;
  // Each new location costs 75% of startup × an inflating multiplier.
  return Math.round(def.startupCost * 0.75 * Math.pow(1.3, b.locations));
}
export const MAX_LOCATIONS = 10;

// Category synergy: each owned business in the same category buffs the
// others by 5%. Owning 3 cafes nets each a +10% revenue bonus.
const SYNERGY_PER_PEER = 0.05;
export function categorySynergyMult(category: string, s: GameState): number {
  let n = 0;
  for (const b of s.businesses) {
    const d = BUSINESS_TYPES.find((x) => x.id === b.businessId);
    if (d && d.category === category) n++;
  }
  return 1 + Math.max(0, n - 1) * SYNERGY_PER_PEER;
}

// IPO: convert a profitable business to a passive dividend stream. The
// player gets a one-time cash injection ≈ several years' projected profit;
// the business keeps paying ~30% of that profit forever, but the player
// gives up management (no mechanic, no events, no upgrades).
export const IPO_DIVIDEND_RATIO = 0.35;
export const IPO_MIN_LEVEL = 3;
export const IPO_MIN_LOCATIONS = 2;
export function ipoEligible(b: OwnedBusiness): { ok: boolean; reason?: string } {
  if (b.isPublic) return { ok: false, reason: "Already public" };
  if (b.level < IPO_MIN_LEVEL) return { ok: false, reason: `Need level ${IPO_MIN_LEVEL}` };
  if (b.locations < IPO_MIN_LOCATIONS) return { ok: false, reason: `Need ${IPO_MIN_LOCATIONS} locations` };
  if (b.reserve < 0) return { ok: false, reason: "Books in the red" };
  return { ok: true };
}
export function ipoValuation(b: OwnedBusiness): number {
  const def = BUSINESS_TYPES.find((x) => x.id === b.businessId);
  if (!def) return 0;
  // ~12 years (4380 ticks) of expected gross revenue at current scale.
  const locFactor = locationsFactor(b.locations);
  const grossPerTick = def.baseRevenuePerTick * b.level * locFactor;
  return Math.round(grossPerTick * 4380 * 0.55); // 55% of 12 years gross
}

// ---------------------------------------------------------------------------
// Per-tick simulation step for one owned business. Returns the NEW snapshot
// (immutable transform). Bankruptcies are flagged via b.redTicks crossing the
// threshold; the engine sweeps and removes them.
// ---------------------------------------------------------------------------

export interface BusinessTickResult {
  next: OwnedBusiness;
  cashDelta: number; // signed — added to player cash
  bankrupt: boolean;
}

export function stepBusiness(b: OwnedBusiness, s: GameState): BusinessTickResult {
  const def = BUSINESS_TYPES.find((x) => x.id === b.businessId);
  if (!def) return { next: b, cashDelta: 0, bankrupt: false };

  // Public (IPO'd) businesses are pure passive dividend — no mechanic, no
  // events, no manager, no bankruptcy. Pay out a flat fraction of base revenue
  // each tick scaled by locations.
  if (b.isPublic) {
    const locFactor = locationsFactor(b.locations);
    const dividend = def.baseRevenuePerTick * b.level * locFactor * IPO_DIVIDEND_RATIO * (1 + s.economy.gdpGrowth) * BIZ_PROFIT_SCALE;
    return { next: b, cashDelta: dividend, bankrupt: false };
  }

  const mech = MECHANICS[def.mechanic];
  const mgrSpec = b.manager ? MANAGER_SPECIALTIES[b.manager.specialty] : null;

  // 1. Drift mState toward its idle baseline. Marketing managers slow the
  //    decay slightly; ops managers reduce drift further (they steady ops).
  const driftMult = mgrSpec ? mgrSpec.driftMult : 1;
  const target = mech.driftTarget(b.mState);
  let mState = b.mState + (target - b.mState) * mech.driftRate * driftMult;
  mState = Math.max(mech.min, Math.min(mech.max, mState));

  // 2. Compute revenue / cost. Multi-location scales both with diminishing
  //    returns (each new outlet adds 95% of the prior). Category synergy
  //    buffs revenue when the player runs several businesses of the same
  //    category — diversification penalty is implicit (no synergy).
  const macroMult = 1 + s.economy.gdpGrowth;
  const incomeMult = incomeMultiplier(s.progression);
  const revMechMult = mech.revMult(mState);
  const costMechMult = mech.costMult(mState);
  const mktgMult = 1 + b.marketingLevel * 0.12;
  const mgrRevMult = mgrSpec?.revMult ?? 1;
  const mgrCostMult = mgrSpec?.costMult ?? 1;
  const locFactor = locationsFactor(b.locations);
  const synergyMult = categorySynergyMult(def.category, s);

  const revenue = def.baseRevenuePerTick * b.level * locFactor * revMechMult * mktgMult * macroMult * mgrRevMult * incomeMult * synergyMult;
  let cost = def.baseCostPerTick * b.level * locFactor * costMechMult * mgrCostMult;
  if (b.manager) cost += b.manager.salaryPerTick * locFactor; // manager scales with locations

  let profit = revenue - cost;
  // 3. Bankruptcy gravity: reserve absorbs profit. Cash payout to player is
  //    the AFTER-RESERVE profit so they only "pull profits" from a healthy
  //    business. A profitable business with low reserve refills the reserve
  //    first; a deeply-negative business doesn't pay out at all.
  let reserve = b.reserve;
  let cashDelta = 0;

  // Apply any reserve drain from the active event.
  if (b.event?.reserveDrainPerTick) {
    reserve -= b.event.reserveDrainPerTick;
  }

  reserve += profit;

  // Pay out profits to the player only above a buffer threshold (~1 month of
  // running cost). Keeps the reserve healthy automatically.
  const buffer = Math.max(500, cost * 60);
  if (reserve > buffer) {
    const excess = reserve - buffer;
    cashDelta = excess * BIZ_PROFIT_SCALE;
    reserve = buffer;
  }

  // 4. Bankruptcy bookkeeping.
  const redTicks = reserve < 0 ? b.redTicks + 1 : 0;
  const bankrupt = redTicks >= BANKRUPT_GRACE_TICKS;

  // 5. Tick down or possibly spawn an event.
  let event = b.event;
  if (event) {
    event = { ...event, ticksRemaining: event.ticksRemaining - 1 };
    if (event.ticksRemaining <= 0) event = null;
  } else {
    event = pickEvent(b, def);
  }

  return {
    next: { ...b, mState, reserve, redTicks, event },
    cashDelta,
    bankrupt,
  };
}

// ---------------------------------------------------------------------------
// Helpers for the UI / actions layer
// ---------------------------------------------------------------------------

export function mechanicFor(business: OwnedBusiness): MechanicSpec {
  const def = BUSINESS_TYPES.find((b) => b.id === business.businessId);
  const mech = def?.mechanic ?? "menu";
  return MECHANICS[mech];
}

export function freshBusiness(businessId: string): OwnedBusiness {
  const def = BUSINESS_TYPES.find((b) => b.id === businessId);
  const mech = MECHANICS[def?.mechanic ?? "menu"];
  return {
    businessId,
    level: 1,
    marketingLevel: 0,
    locations: 1,
    reserve: (def?.startupCost ?? 1000) * 0.05, // small buffer to start
    mState: mech.initial(),
    manager: null,
    event: null,
    redTicks: 0,
    foundedAt: Date.now(),
  };
}

// Sale price for selling a business — most of its capital invested back, plus
// goodwill from accumulated reserve, the upgrade level, and any extra outlets.
export function salePrice(b: OwnedBusiness): number {
  const def = BUSINESS_TYPES.find((x) => x.id === b.businessId);
  if (!def) return 0;
  const sunkCost = def.startupCost * 0.6 * b.level * locationsFactor(b.locations);
  const reserveValue = Math.max(0, b.reserve);
  return Math.round(sunkCost + reserveValue);
}

export function makeManager(specialty: ManagerSpecialty, level: number, business: OwnedBusiness): Manager {
  return {
    name: randomManagerName(),
    specialty,
    level,
    salaryPerTick: managerSalary(level, business),
  };
}

// Migrate an old-shape OwnedBusiness (pre v5) into the new shape so existing
// saves don't drop their owned businesses on load.
export function migrateBusiness(raw: unknown): OwnedBusiness {
  const r = raw as Partial<OwnedBusiness> & { employees?: number };
  const businessId = r.businessId ?? "food-truck";
  const fresh = freshBusiness(businessId);
  return {
    businessId,
    level: typeof r.level === "number" ? r.level : 1,
    marketingLevel: typeof r.marketingLevel === "number" ? r.marketingLevel : 0,
    locations: typeof r.locations === "number" && r.locations >= 1 ? r.locations : 1,
    isPublic: r.isPublic ?? false,
    reserve: typeof r.reserve === "number" ? r.reserve : fresh.reserve,
    mState: typeof r.mState === "number" ? r.mState : fresh.mState,
    manager: r.manager ?? null,
    event: r.event ?? null,
    redTicks: typeof r.redTicks === "number" ? r.redTicks : 0,
    foundedAt: typeof r.foundedAt === "number" ? r.foundedAt : Date.now(),
  };
}
