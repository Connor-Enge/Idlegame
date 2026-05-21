import { BUSINESS_TYPES, CAREER_TRACKS, PROPERTIES } from "./data";
import { computeNetWorth } from "./engine";
import { playGamble } from "./gambling";
import type { GambleGame, GambleResult, GameState } from "./types";

export type ActionResult = {
  state: GameState;
  ok: boolean;
  message: string;
  gamble?: GambleResult;
};

function fail(state: GameState, message: string): ActionResult {
  return { state, ok: false, message };
}

// --------------------------- Investing ---------------------------

export function buyAsset(state: GameState, assetId: string, quantity: number): ActionResult {
  if (quantity <= 0) return fail(state, "Quantity must be positive");
  const asset = state.assets.find((a) => a.id === assetId);
  if (!asset) return fail(state, "Unknown asset");
  const cost = asset.price * quantity;
  if (cost > state.stats.cash) return fail(state, "Not enough cash");

  const s = clone(state);
  s.stats.cash -= cost;
  const existing = s.holdings.find((h) => h.assetId === assetId);
  if (existing) {
    const totalQty = existing.quantity + quantity;
    existing.avgCost = (existing.avgCost * existing.quantity + cost) / totalQty;
    existing.quantity = totalQty;
  } else {
    s.holdings.push({ assetId, quantity, avgCost: asset.price });
  }
  s.stats.netWorth = computeNetWorth(s);
  return { state: s, ok: true, message: `Bought ${quantity} ${asset.symbol}` };
}

export function sellAsset(state: GameState, assetId: string, quantity: number): ActionResult {
  const asset = state.assets.find((a) => a.id === assetId);
  if (!asset) return fail(state, "Unknown asset");
  const holding = state.holdings.find((h) => h.assetId === assetId);
  if (!holding || holding.quantity < quantity) return fail(state, "Not enough shares");

  const s = clone(state);
  const h = s.holdings.find((x) => x.assetId === assetId)!;
  h.quantity -= quantity;
  s.stats.cash += asset.price * quantity;
  if (h.quantity <= 0) s.holdings = s.holdings.filter((x) => x.assetId !== assetId);
  s.stats.netWorth = computeNetWorth(s);
  return { state: s, ok: true, message: `Sold ${quantity} ${asset.symbol}` };
}

// --------------------------- Gambling ---------------------------

export function gamble(
  state: GameState,
  game: GambleGame,
  wager: number,
  opts: Record<string, unknown> = {},
): ActionResult {
  if (wager <= 0) return fail(state, "Wager must be positive");
  if (wager > state.stats.cash) return fail(state, "Not enough cash");

  const result = playGamble(game, wager, state.stats.luck, opts);
  const s = clone(state);
  s.stats.cash = s.stats.cash - wager + result.payout;
  // Winning builds a little reputation/luck momentum; losing erodes luck.
  s.stats.luck = Math.max(0, s.stats.luck + (result.won ? 0.5 : -0.2));
  s.stats.netWorth = computeNetWorth(s);
  return {
    state: s,
    ok: true,
    message: result.won ? `Won $${result.payout}!` : `Lost $${wager}.`,
    gamble: result,
  };
}

// --------------------------- Jobs / Career ---------------------------

export function takeJob(state: GameState, trackId: string): ActionResult {
  const track = CAREER_TRACKS.find((t) => t.id === trackId);
  if (!track) return fail(state, "Unknown career track");
  const entry = track.levels[0];
  if (state.stats.reputation < entry.reputationRequired)
    return fail(state, "Not enough reputation");

  const s = clone(state);
  s.career = { trackId, levelIndex: 0, shiftsWorked: 0, employedSince: Date.now() };
  return { state: s, ok: true, message: `Hired as ${entry.title}` };
}

export function quitJob(state: GameState): ActionResult {
  const s = clone(state);
  s.career = { trackId: null, levelIndex: 0, shiftsWorked: 0, employedSince: null };
  return { state: s, ok: true, message: "You quit. Bold." };
}

// Working a shift is the active mini-game: spend energy for an immediate
// reputation + cash boost and progress toward promotion.
export function workShift(state: GameState): ActionResult {
  if (!state.career.trackId) return fail(state, "You don't have a job");
  const track = CAREER_TRACKS.find((t) => t.id === state.career.trackId)!;
  const level = track.levels[state.career.levelIndex];
  if (state.stats.energy < level.energyCostPerShift)
    return fail(state, "Too tired — rest or wait for energy");

  const s = clone(state);
  s.stats.energy -= level.energyCostPerShift;
  s.stats.cash += level.baseSalaryPerTick * 8; // a shift pays a burst
  s.stats.reputation += 5;
  s.career.shiftsWorked += 1;
  s.stats.netWorth = computeNetWorth(s);

  let message = `Worked a shift as ${level.title}. +$${level.baseSalaryPerTick * 8}`;

  // Offer promotion automatically when eligible.
  const next = track.levels[s.career.levelIndex + 1];
  if (
    next &&
    s.career.shiftsWorked >= level.promoteAfterShifts &&
    s.stats.reputation >= next.reputationRequired
  ) {
    s.career.levelIndex += 1;
    s.career.shiftsWorked = 0;
    message = `Promoted to ${next.title}! 🎉`;
  }
  return { state: s, ok: true, message };
}

export function rest(state: GameState): ActionResult {
  const s = clone(state);
  s.stats.energy = s.stats.maxEnergy;
  return { state: s, ok: true, message: "Rested. Energy full." };
}

// --------------------------- Real estate ---------------------------

export function buyProperty(state: GameState, propertyId: string, withMortgage: boolean): ActionResult {
  const def = PROPERTIES.find((p) => p.id === propertyId);
  if (!def) return fail(state, "Unknown property");
  const downPayment = withMortgage ? def.baseValue * 0.2 : def.baseValue;
  if (downPayment > state.stats.cash) return fail(state, "Can't afford the down payment");

  const s = clone(state);
  s.stats.cash -= downPayment;
  s.properties.push({
    propertyId,
    purchasePrice: def.baseValue,
    currentValue: def.baseValue,
    rented: def.rentPerTick > 0,
    mortgageRemaining: withMortgage ? def.baseValue * 0.8 : 0,
  });
  s.stats.netWorth = computeNetWorth(s);
  return { state: s, ok: true, message: `Bought ${def.name}` };
}

export function sellProperty(state: GameState, index: number): ActionResult {
  const owned = state.properties[index];
  if (!owned) return fail(state, "You don't own that");
  const s = clone(state);
  s.stats.cash += Math.max(0, owned.currentValue - owned.mortgageRemaining);
  s.properties.splice(index, 1);
  s.stats.netWorth = computeNetWorth(s);
  return { state: s, ok: true, message: "Property sold" };
}

export function toggleRent(state: GameState, index: number): ActionResult {
  const owned = state.properties[index];
  if (!owned) return fail(state, "You don't own that");
  const s = clone(state);
  s.properties[index].rented = !owned.rented;
  return { state: s, ok: true, message: s.properties[index].rented ? "Listed for rent" : "Tenant cleared" };
}

// --------------------------- Business ---------------------------

export function startBusiness(state: GameState, businessId: string): ActionResult {
  const def = BUSINESS_TYPES.find((b) => b.id === businessId);
  if (!def) return fail(state, "Unknown business");
  if (def.startupCost > state.stats.cash) return fail(state, "Not enough capital");

  const s = clone(state);
  s.stats.cash -= def.startupCost;
  s.businesses.push({
    businessId,
    level: 1,
    employees: 0,
    marketingLevel: 0,
    foundedAt: Date.now(),
  });
  s.stats.netWorth = computeNetWorth(s);
  return { state: s, ok: true, message: `Founded ${def.name}` };
}

export function upgradeBusiness(state: GameState, index: number): ActionResult {
  const biz = state.businesses[index];
  if (!biz) return fail(state, "You don't own that");
  const def = BUSINESS_TYPES.find((b) => b.id === biz.businessId)!;
  const cost = def.startupCost * 0.5 * biz.level;
  if (cost > state.stats.cash) return fail(state, "Not enough cash to upgrade");

  const s = clone(state);
  s.stats.cash -= cost;
  s.businesses[index].level += 1;
  s.stats.netWorth = computeNetWorth(s);
  return { state: s, ok: true, message: `Upgraded to level ${s.businesses[index].level}` };
}

export function hireEmployee(state: GameState, index: number): ActionResult {
  const biz = state.businesses[index];
  if (!biz) return fail(state, "You don't own that");
  const cost = 2000 * (biz.employees + 1);
  if (cost > state.stats.cash) return fail(state, "Can't afford to hire");
  const s = clone(state);
  s.stats.cash -= cost;
  s.businesses[index].employees += 1;
  return { state: s, ok: true, message: "Hired an employee" };
}

export function investMarketing(state: GameState, index: number): ActionResult {
  const biz = state.businesses[index];
  if (!biz) return fail(state, "You don't own that");
  const cost = 5000 * (biz.marketingLevel + 1);
  if (cost > state.stats.cash) return fail(state, "Can't afford marketing");
  const s = clone(state);
  s.stats.cash -= cost;
  s.businesses[index].marketingLevel += 1;
  return { state: s, ok: true, message: "Marketing boosted" };
}

function clone<T>(v: T): T {
  return typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v));
}
