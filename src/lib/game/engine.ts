import { BASE_ASSETS, BUSINESS_TYPES, CAREER_TRACKS, PROPERTIES } from "./data";
import { initialEconomy, stepAssetPrice, stepEconomy } from "./economy";
import type { GameState, MarketAsset } from "./types";

export const STATE_VERSION = 1;

export function createInitialState(playerId: string): GameState {
  const now = Date.now();
  return {
    playerId,
    stats: {
      cash: 500,
      netWorth: 500,
      reputation: 0,
      energy: 100,
      maxEnergy: 100,
      luck: 0,
      createdAt: now,
      lastTick: now,
    },
    career: { trackId: null, levelIndex: 0, shiftsWorked: 0, employedSince: null },
    holdings: [],
    properties: [],
    businesses: [],
    economy: initialEconomy(),
    assets: BASE_ASSETS.map((a) => ({ ...a })),
    version: STATE_VERSION,
  };
}

// Advance the whole simulation by `ticks` steps. Pure-ish: returns new state.
export function advance(state: GameState, ticks: number): GameState {
  let s: GameState = structuredCloneSafe(state);
  for (let i = 0; i < ticks; i++) {
    s = stepOnce(s);
  }
  s.stats.netWorth = computeNetWorth(s);
  s.stats.lastTick = Date.now();
  return s;
}

function stepOnce(s: GameState): GameState {
  // 1. Economy first — it prices everything downstream.
  s.economy = stepEconomy(s.economy);
  s.assets = s.assets.map((a) => ({ ...a, price: stepAssetPrice(a, s.economy) }));

  let income = 0;

  // 2. Salary (passive while employed).
  if (s.career.trackId) {
    const track = CAREER_TRACKS.find((t) => t.id === s.career.trackId);
    const level = track?.levels[s.career.levelIndex];
    if (level) {
      // Recession drags salary slightly; reputation grows on the job.
      const macroMult = 1 + s.economy.gdpGrowth;
      income += level.baseSalaryPerTick * macroMult;
      s.stats.reputation += 0.2;
    }
  }

  // 3. Real estate net rent (occupancy is stochastic).
  for (const owned of s.properties) {
    const def = PROPERTIES.find((p) => p.id === owned.propertyId);
    if (!def) continue;
    const occupied = owned.rented && Math.random() < def.occupancyChance;
    const rent = occupied ? def.rentPerTick * (1 + s.economy.inflation / 100) : 0;
    income += rent - def.upkeepPerTick;
    // Property value drifts with sentiment.
    owned.currentValue = Math.max(
      def.baseValue * 0.3,
      owned.currentValue * (1 + s.economy.marketSentiment * 0.0008 + 0.0001),
    );
    if (owned.mortgageRemaining > 0) {
      const payment = Math.min(owned.mortgageRemaining, def.baseValue * 0.0005);
      income -= payment;
      owned.mortgageRemaining -= payment;
    }
  }

  // 4. Business net profit (scales with level/employees/marketing).
  for (const biz of s.businesses) {
    const def = BUSINESS_TYPES.find((b) => b.id === biz.businessId);
    if (!def) continue;
    const revMult = biz.level * (1 + biz.marketingLevel * 0.15) * (1 + s.economy.gdpGrowth);
    const revenue = def.baseRevenuePerTick * revMult;
    const cost = def.baseCostPerTick * biz.level + biz.employees * 5;
    income += revenue - cost;
  }

  s.stats.cash = Math.max(0, s.stats.cash + income);

  // 5. Energy regenerates slowly each tick (used by jobs / actions).
  s.stats.energy = Math.min(s.stats.maxEnergy, s.stats.energy + 0.5);

  return s;
}

export function computeNetWorth(s: GameState): number {
  let nw = s.stats.cash;
  for (const h of s.holdings) {
    const asset = s.assets.find((a) => a.id === h.assetId);
    if (asset) nw += h.quantity * asset.price;
  }
  for (const p of s.properties) nw += p.currentValue - p.mortgageRemaining;
  for (const biz of s.businesses) {
    const def = BUSINESS_TYPES.find((b) => b.id === biz.businessId);
    if (def) nw += def.startupCost * biz.level * 0.8;
  }
  return Math.round(nw);
}

export function assetById(state: GameState, id: string): MarketAsset | undefined {
  return state.assets.find((a) => a.id === id);
}

// structuredClone exists in modern runtimes; fall back for older targets.
function structuredCloneSafe<T>(v: T): T {
  if (typeof structuredClone === "function") return structuredClone(v);
  return JSON.parse(JSON.stringify(v));
}
