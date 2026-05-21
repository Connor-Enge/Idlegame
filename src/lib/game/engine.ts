import {
  BASE_ASSETS,
  BIZ_PROFIT_SCALE,
  BUSINESS_TYPES,
  CAREER_TRACKS,
  PROPERTIES,
  RENT_SCALE,
  SALARY_SCALE,
} from "./data";
import { freshCareer, normalizeCareer, perkBundle } from "./career";
import { initialEconomy, stepAsset, stepEconomy } from "./economy";
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

export const STATE_VERSION = 3;

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
function rebirth(prev: GameState): GameState {
  const netWorth = computeNetWorth(prev);
  const credits = lifeCredits(netWorth);
  const fresh = createInitialState(prev.playerId);
  fresh.progression.legacyPoints = prev.progression.legacyPoints + credits;
  fresh.progression.retirements = prev.progression.retirements + 1;
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

  // Career sub-state migration.
  if (!s.career) s.career = freshCareer();
  else normalizeCareer(s.career);

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

  // Reconcile the live asset list with any newly added instruments while
  // preserving simulated prices + chart history for assets the player had.
  const known = new Map((s.assets ?? []).map((a) => [a.id, a]));
  s.assets = BASE_ASSETS.map((a) => {
    const prev = known.get(a.id);
    return ensureHistory({ ...a, price: prev?.price ?? a.price, history: prev?.history, momentum: prev?.momentum });
  });

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

  // 1. Economy first — it prices everything downstream.
  s.economy = stepEconomy(s.economy);
  s.assets = s.assets.map((a) => stepAsset(a, s.economy));

  const mult = incomeMultiplier(s.progression);
  let income = 0;

  // 2. Salary (passive while employed). Raises, morale and perks all scale it.
  if (s.career.trackId) {
    const track = CAREER_TRACKS.find((t) => t.id === s.career.trackId);
    const level = track?.levels[s.career.levelIndex];
    if (level) {
      const perks = perkBundle(s);
      const macroMult = 1 + s.economy.gdpGrowth;
      const moraleFactor = 0.7 + (s.career.morale / 100) * 0.5;
      const salary =
        level.baseSalaryPerTick *
        macroMult *
        mult *
        s.career.salaryMultiplier *
        moraleFactor *
        perks.passiveSalaryMult *
        SALARY_SCALE;
      income += salary;
      s.career.totalEarned += salary;
      s.stats.reputation += 0.2;
    }
  }

  // Morale drifts toward a 60 baseline; cooldowns tick down.
  s.career.morale += (60 - s.career.morale) * 0.01;
  s.career.morale = Math.max(0, Math.min(100, s.career.morale));
  if (s.career.gigCooldownTicks > 0) s.career.gigCooldownTicks -= 1;
  if (s.career.reviewCooldownTicks > 0) s.career.reviewCooldownTicks -= 1;

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

  // 4. Business net profit (scales with level/employees/marketing).
  for (const biz of s.businesses) {
    const def = BUSINESS_TYPES.find((b) => b.id === biz.businessId);
    if (!def) continue;
    const revMult = biz.level * (1 + biz.marketingLevel * 0.15) * (1 + s.economy.gdpGrowth);
    const revenue = def.baseRevenuePerTick * revMult * mult;
    const cost = def.baseCostPerTick * biz.level + biz.employees * 5;
    income += (revenue - cost) * BIZ_PROFIT_SCALE;
  }

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
  s.life.ageTicks += 1;
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
