import {
  BASE_ASSETS,
  BUSINESS_TYPES,
  PROPERTIES,
  RENT_SCALE,
} from "./data";
import { migrateBusiness, stepBusiness } from "./business";
import { freshCareer, normalizeCareer } from "./career";
import { initialEconomy } from "./economy";
import { defaultInvesting, ensureHistory, processInvestingTick } from "./investing";
import {
  currentAge,
  defaultLife,
  defaultProgression,
  grantXp,
  incomeMultiplier,
  lifeCredits,
  refreshUnlocks,
} from "./progression";
import type { GameState, MarketAsset } from "./types";

export const STATE_VERSION = 5;

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
    progression: defaultProgression(),
    career: freshCareer(),
    holdings: [],
    properties: [],
    businesses: [],
    economy: initialEconomy(),
    assets: BASE_ASSETS.map((a) => ensureHistory({ ...a })),
    investing: defaultInvesting(),
    life: defaultLife(),
    version: STATE_VERSION,
  };
}

// A new life: full reset (like prestige) but carrying legacy credits forward
// and recording a death recap. Triggered when the player dies of old age.
// Permanent things — achievements, legacy points, retirements counter, the
// playerId itself — survive across lives. Everything else resets.
function rebirth(prev: GameState): GameState {
  const netWorth = computeNetWorth(prev);
  const credits = lifeCredits(netWorth);
  const fresh = createInitialState(prev.playerId);
  fresh.progression.legacyPoints = prev.progression.legacyPoints + credits;
  fresh.progression.retirements = prev.progression.retirements + 1;
  fresh.progression.achievements = [...prev.progression.achievements];
  fresh.life.generation = prev.life.generation + 1;
  fresh.life.deathReport = { age: Math.floor(currentAge(prev.life)), netWorth, credits };
  return fresh;
}

// Backfill fields added in newer versions so older saves don't crash. Mutates.
export function normalizeState(s: GameState): GameState {
  const incomingVersion = s.version;
  if (!s.progression) {
    s.progression = defaultProgression();
    // Reward returning players for any net worth already accrued.
    s.progression.level = 1;
  }
  const p = s.progression;
  if (p.credentials == null) p.credentials = [];
  if (p.unlocks == null) p.unlocks = [];
  if (p.studyingId === undefined) p.studyingId = null;
  if (p.studyTicksRemaining == null) p.studyTicksRemaining = 0;
  if (p.legacyPoints == null) p.legacyPoints = 0;
  if (p.retirements == null) p.retirements = 0;
  if (p.achievements == null) p.achievements = [];
  if (p.level == null || p.level < 1) p.level = 1;
  if (p.xp == null) p.xp = 0;

  // Career sub-state migration (v4 replaced the whole career model).
  s.career = normalizeCareer(s.career);

  // v5: business records grew (reserve, mState, manager, event, redTicks).
  // Run every owned business through the migrator so old saves keep them.
  if (Array.isArray(s.businesses)) {
    s.businesses = s.businesses.map(migrateBusiness);
  } else {
    s.businesses = [];
  }

  // Life/mortality migration for saves created before it existed.
  if (!s.life) {
    s.life = defaultLife();
  } else {
    const l = s.life;
    if (l.ageTicks == null) l.ageTicks = 0;
    if (l.startAge == null) l.startAge = 18;
    if (l.deathAge == null || l.deathAge < 50) l.deathAge = 65 + Math.floor(Math.random() * 36);
    if (l.generation == null) l.generation = 1;
    if (l.deathReport === undefined) l.deathReport = null;
    // v3 changed the clock from 5 ticks/day (1825 ticks/year) to 1 tick/day
    // (365/year). Rescale lived ticks so a player's age is preserved rather
    // than instantly multiplying past their death age.
    if (incomingVersion != null && incomingVersion < 3) {
      l.ageTicks = Math.round(l.ageTicks / 5);
    }
  }

  // The shared server market (src/lib/market/server.ts) owns assets now.
  // Whatever's currently in s.assets is the latest snapshot the client has
  // polled — DON'T rebuild it from BASE_ASSETS each tick or procedural IPOs
  // and current prices get clobbered. Just ensure history exists for charts.
  if (!s.assets || s.assets.length === 0) {
    s.assets = BASE_ASSETS.map((a) => ensureHistory({ ...a }));
  } else {
    s.assets = s.assets.map((a) => ensureHistory({ ...a }));
  }

  // Backfill the brokerage layer for saves created before it existed.
  if (!s.investing) {
    s.investing = defaultInvesting();
  } else {
    const inv = s.investing;
    const d = defaultInvesting();
    if (inv.portfolioHistory == null) inv.portfolioHistory = d.portfolioHistory;
    if (inv.watchlists == null) inv.watchlists = d.watchlists;
    if (inv.orders == null) inv.orders = [];
    if (inv.recurring == null) inv.recurring = [];
    if (inv.gold == null) inv.gold = false;
    if (inv.goldSince === undefined) inv.goldSince = null;
    if (inv.marginUsed == null) inv.marginUsed = 0;
    if (inv.realizedPL == null) inv.realizedPL = 0;
    if (inv.dividendsEarned == null) inv.dividendsEarned = 0;
    if (inv.tradeCount == null) inv.tradeCount = 0;
  }

  refreshUnlocks(s);
  s.version = STATE_VERSION;
  return s;
}

// Advance the whole simulation by `ticks` steps. Pure-ish: returns new state.
export function advance(state: GameState, ticks: number): GameState {
  let s: GameState = normalizeState(structuredCloneSafe(state));
  for (let i = 0; i < ticks; i++) {
    s = stepOnce(s);
  }
  s.stats.netWorth = computeNetWorth(s);
  refreshUnlocks(s);
  s.stats.lastTick = Date.now();
  return s;
}

function stepOnce(s: GameState): GameState {
  // 0. Advance any in-progress study; grant the credential when it completes.
  if (s.progression.studyingId && s.progression.studyTicksRemaining > 0) {
    s.progression.studyTicksRemaining -= 1;
    if (s.progression.studyTicksRemaining <= 0) {
      if (!s.progression.credentials.includes(s.progression.studyingId)) {
        s.progression.credentials.push(s.progression.studyingId);
      }
      grantXp(s.progression, 40);
      s.progression.studyingId = null;
    }
  }

  // 1. Economy + asset prices are now owned by the shared server market
  //    (see src/lib/market/server.ts) — the client polls /api/market and
  //    overwrites s.economy + s.assets in the store. The engine just reads
  //    whatever's currently in state for income / portfolio calcs.
  const mult = incomeMultiplier(s.progression);
  let income = 0;

  // Careers are now active-only — income from jobs comes from playing their
  // minigames (see actions.workJob), not from passive salary while idle.

  // 3. Real estate net rent (occupancy is stochastic).
  for (const owned of s.properties) {
    const def = PROPERTIES.find((p) => p.id === owned.propertyId);
    if (!def) continue;
    const occupied = owned.rented && Math.random() < def.occupancyChance;
    const rent = occupied ? def.rentPerTick * (1 + s.economy.inflation / 100) * mult : 0;
    income += (rent - def.upkeepPerTick) * RENT_SCALE;
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

  // 4. Businesses — each runs its own mechanic, accumulates a cash reserve,
  //    pays profits out above a buffer threshold, can spawn events, and
  //    bankrupts after sustained losses. See src/lib/game/business.ts.
  const survivors: typeof s.businesses = [];
  for (const biz of s.businesses) {
    const { next, cashDelta, bankrupt } = stepBusiness(biz, s);
    income += cashDelta;
    if (!bankrupt) survivors.push(next);
  }
  s.businesses = survivors;

  s.stats.cash = Math.max(0, s.stats.cash + income);

  // 5. Brokerage: dividends, Gold interest/fees, margin, recurring & resting
  //    orders, and the portfolio-value snapshot for charts.
  processInvestingTick(s);

  // 6. Energy regenerates slowly each tick (used by jobs / actions).
  s.stats.energy = Math.min(s.stats.maxEnergy, s.stats.energy + 0.5);

  // 7. Trickle XP from positive passive income so idle play still progresses.
  if (income > 0) grantXp(s.progression, Math.min(5, Math.log10(income + 1)));

  // 8. Aging & mortality. Time marches on; when the player reaches their rolled
  //    death age, this life ends — net worth converts to legacy credits and a
  //    fresh life begins (the recap is surfaced via life.deathReport).
  // Player ages 10 days per engine tick so a full life clears in ~37 min of
  // continuous play (was ~6 hours), making prestige loops feel responsive.
  s.life.ageTicks += 10;
  if (currentAge(s.life) >= s.life.deathAge) {
    return rebirth(s);
  }

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
  // Margin debt is a liability against net worth.
  if (s.investing?.marginUsed) nw -= s.investing.marginUsed;
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
