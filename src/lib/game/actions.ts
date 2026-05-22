import { BUSINESS_TYPES, PROPERTIES } from "./data";
import { JOB_COUNT, careerRoundXp, jobByIndex, minigameById } from "./careerJobs";
import { computeNetWorth, createInitialState } from "./engine";
import { playGamble } from "./gambling";
import { buyingPower, settleBuy, settleSell } from "./investing";
import {
  canRetire,
  canStartStudy,
  educationById,
  grantXp,
  hasFeature,
  legacyGain,
} from "./progression";
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

// Shared gating: brokerage unlocked, asset exists/visible, credential held.
type Gate =
  | { ok: false; error: string }
  | { ok: true; asset: import("./types").MarketAsset };

function tradableAsset(state: GameState, assetId: string): Gate {
  if (!hasFeature(state, "invest")) return { ok: false, error: "Brokerage access locked" };
  const asset = state.assets.find((a) => a.id === assetId);
  if (!asset) return { ok: false, error: "Unknown asset" };
  if (asset.unlockLevel && state.progression.level < asset.unlockLevel)
    return { ok: false, error: `Unlocks at level ${asset.unlockLevel}` };
  if (asset.requiresCredential && !state.progression.credentials.includes(asset.requiresCredential))
    return { ok: false, error: `Requires ${educationById(asset.requiresCredential)?.short ?? "a license"}` };
  return { ok: true, asset };
}

export function buyAsset(state: GameState, assetId: string, quantity: number): ActionResult {
  if (quantity <= 0) return fail(state, "Quantity must be positive");
  const gate = tradableAsset(state, assetId);
  if (!gate.ok) return fail(state, gate.error);
  if (gate.asset.price * quantity > buyingPower(state)) return fail(state, "Not enough buying power");

  const s = clone(state);
  if (!settleBuy(s, assetId, quantity)) return fail(state, "Not enough buying power");
  s.stats.netWorth = computeNetWorth(s);
  return { state: s, ok: true, message: `Bought ${trim(quantity)} ${gate.asset.symbol}` };
}

// Robinhood's default: buy a dollar amount, get fractional shares.
export function buyAssetDollars(state: GameState, assetId: string, dollars: number): ActionResult {
  if (dollars <= 0) return fail(state, "Amount must be positive");
  const gate = tradableAsset(state, assetId);
  if (!gate.ok) return fail(state, gate.error);
  if (dollars > buyingPower(state)) return fail(state, "Not enough buying power");
  const shares = dollars / gate.asset.price;

  const s = clone(state);
  if (!settleBuy(s, assetId, shares)) return fail(state, "Not enough buying power");
  s.stats.netWorth = computeNetWorth(s);
  return { state: s, ok: true, message: `Bought ${money(dollars)} of ${gate.asset.symbol}` };
}

export function sellAsset(state: GameState, assetId: string, quantity: number): ActionResult {
  const asset = state.assets.find((a) => a.id === assetId);
  if (!asset) return fail(state, "Unknown asset");

  const s = clone(state);
  const profit = settleSell(s, assetId, quantity);
  if (profit == null) return fail(state, "Not enough shares");
  // Realized gains grant XP; selling at a loss teaches nothing.
  if (profit > 0) grantXp(s.progression, Math.min(30, Math.log10(profit + 1) * 6));
  s.stats.netWorth = computeNetWorth(s);
  return { state: s, ok: true, message: `Sold ${trim(quantity)} ${asset.symbol}` };
}

// Sell a dollar amount of a position (converted to fractional shares).
export function sellAssetDollars(state: GameState, assetId: string, dollars: number): ActionResult {
  const asset = state.assets.find((a) => a.id === assetId);
  if (!asset) return fail(state, "Unknown asset");
  if (dollars <= 0) return fail(state, "Amount must be positive");
  const holding = state.holdings.find((h) => h.assetId === assetId);
  if (!holding) return fail(state, "No position to sell");
  const shares = Math.min(holding.quantity, dollars / asset.price);
  return sellAsset(state, assetId, shares);
}

// --------------------------- Resting orders ---------------------------

export function placeOrder(
  state: GameState,
  assetId: string,
  side: "buy" | "sell",
  trigger: "limit" | "stop",
  price: number,
  shares: number,
): ActionResult {
  if (price <= 0 || shares <= 0) return fail(state, "Enter a valid price and quantity");
  const gate = tradableAsset(state, assetId);
  if (!gate.ok) return fail(state, gate.error);
  if (side === "sell") {
    const holding = state.holdings.find((h) => h.assetId === assetId);
    if (!holding || holding.quantity < shares) return fail(state, "Not enough shares to sell");
  }
  const s = clone(state);
  s.investing.orders.push({
    id: rid(),
    assetId,
    side,
    trigger,
    price,
    shares,
    createdAt: Date.now(),
  });
  return { state: s, ok: true, message: `${cap(trigger)} ${side} order placed` };
}

export function cancelOrder(state: GameState, orderId: string): ActionResult {
  const s = clone(state);
  s.investing.orders = s.investing.orders.filter((o) => o.id !== orderId);
  return { state: s, ok: true, message: "Order canceled" };
}

// --------------------------- Recurring (DCA) ---------------------------

export function addRecurring(
  state: GameState,
  assetId: string,
  amount: number,
  everyTicks: number,
): ActionResult {
  if (amount <= 0) return fail(state, "Amount must be positive");
  const gate = tradableAsset(state, assetId);
  if (!gate.ok) return fail(state, gate.error);
  const s = clone(state);
  s.investing.recurring.push({
    id: rid(),
    assetId,
    amount,
    everyTicks: Math.max(5, Math.floor(everyTicks)),
    nextTick: s.economy.tick + Math.max(5, Math.floor(everyTicks)),
  });
  return { state: s, ok: true, message: `Recurring buy set up for ${gate.asset.symbol}` };
}

export function cancelRecurring(state: GameState, planId: string): ActionResult {
  const s = clone(state);
  s.investing.recurring = s.investing.recurring.filter((p) => p.id !== planId);
  return { state: s, ok: true, message: "Recurring buy canceled" };
}

// --------------------------- Watchlist ---------------------------

export function toggleWatch(state: GameState, assetId: string, listId = "default"): ActionResult {
  const s = clone(state);
  let list = s.investing.watchlists.find((w) => w.id === listId);
  if (!list) {
    list = { id: listId, name: "My First List", assetIds: [] };
    s.investing.watchlists.push(list);
  }
  const had = list.assetIds.includes(assetId);
  list.assetIds = had ? list.assetIds.filter((id) => id !== assetId) : [...list.assetIds, assetId];
  return { state: s, ok: true, message: had ? "Removed from list" : "Added to list" };
}

// --------------------------- Robinhood Gold ---------------------------

export function subscribeGold(state: GameState): ActionResult {
  if (!hasFeature(state, "invest")) return fail(state, "Brokerage access locked");
  if (state.investing.gold) return fail(state, "Gold already active");
  const s = clone(state);
  s.investing.gold = true;
  s.investing.goldSince = Date.now();
  grantXp(s.progression, 25);
  return { state: s, ok: true, message: "Robinhood Gold activated ✨" };
}

export function cancelGold(state: GameState): ActionResult {
  if (state.investing.marginUsed > 0)
    return fail(state, "Repay your margin balance before canceling Gold");
  const s = clone(state);
  s.investing.gold = false;
  s.investing.goldSince = null;
  s.stats.netWorth = computeNetWorth(s);
  return { state: s, ok: true, message: "Gold canceled" };
}

// Pay down margin debt from cash.
export function repayMargin(state: GameState, amount: number): ActionResult {
  if (amount <= 0) return fail(state, "Amount must be positive");
  const pay = Math.min(amount, state.stats.cash, state.investing.marginUsed);
  if (pay <= 0) return fail(state, "Nothing to repay");
  const s = clone(state);
  s.stats.cash -= pay;
  s.investing.marginUsed -= pay;
  s.stats.netWorth = computeNetWorth(s);
  return { state: s, ok: true, message: `Repaid ${money(pay)} of margin` };
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
  return commitGamble(state, result);
}

// Apply a precomputed gamble result (used by the animated casino games, which
// determine the outcome up front and animate toward it before settling).
export function commitGamble(state: GameState, result: GambleResult): ActionResult {
  if (result.wager > state.stats.cash) return fail(state, "Not enough cash");
  const s = clone(state);
  s.stats.cash = s.stats.cash - result.wager + result.payout;
  s.stats.luck = Math.max(0, s.stats.luck + (result.won ? 0.5 : -0.2));
  grantXp(s.progression, Math.min(15, Math.log10(result.wager + 1) * 3));
  s.stats.netWorth = computeNetWorth(s);
  return {
    state: s,
    ok: true,
    message: result.won ? `Won $${result.payout.toLocaleString()}!` : `Lost $${result.wager.toLocaleString()}.`,
    gamble: result,
  };
}

// --------------------------- Jobs / Career ---------------------------

// Play one round of the current job's minigame. `points` is the metric the
// minigame produced (clicks, hits, combos…). Earns cash, grants progression
// XP, and advances to the next job when the goal is met. Active-only income.
export function workJob(state: GameState, points: number): ActionResult {
  if (!Number.isFinite(points) || points <= 0) return fail(state, "No progress made");
  const job = jobByIndex(state.career.jobIndex);
  const mg = minigameById(job.minigameId);

  const s = clone(state);
  const c = s.career;
  const cash = Math.round(points * job.cashPerPoint);
  s.stats.cash += cash;
  c.totalEarned += cash;
  c.progress += points;
  c.roundsPlayed += 1;
  grantXp(s.progression, careerRoundXp(job));

  let message = `+${money(cash)} · ${Math.round(points)} ${mg.unit}`;
  if (c.progress >= job.goal) {
    if (c.jobIndex < JOB_COUNT - 1) {
      c.jobIndex += 1;
      c.progress = 0;
      c.jobsCleared += 1;
      const next = jobByIndex(c.jobIndex);
      message = `Goal hit! Promoted to ${next.icon} ${next.title} 🎉`;
    } else {
      // Already at the top of the ladder — clamp progress, keep earning.
      c.progress = job.goal;
      if (c.jobsCleared < JOB_COUNT) c.jobsCleared = JOB_COUNT;
      message = `+${money(cash)} · top of the ladder 👑`;
    }
  }

  s.stats.netWorth = computeNetWorth(s);
  return { state: s, ok: true, message };
}

// --------------------------- Real estate ---------------------------

export function buyProperty(state: GameState, propertyId: string, withMortgage: boolean): ActionResult {
  if (!hasFeature(state, "realestate")) return fail(state, "Property market locked");
  const def = PROPERTIES.find((p) => p.id === propertyId);
  if (!def) return fail(state, "Unknown property");
  if (def.requiresCredential && !state.progression.credentials.includes(def.requiresCredential))
    return fail(state, `Requires ${educationById(def.requiresCredential)?.short ?? "a license"}`);
  const downPayment = withMortgage ? def.baseValue * 0.2 : def.baseValue;
  if (downPayment > state.stats.cash) return fail(state, "Can't afford the down payment");

  const s = clone(state);
  s.stats.cash -= downPayment;
  grantXp(s.progression, 15);
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
  if (!hasFeature(state, "business")) return fail(state, "Business registration locked");
  const def = BUSINESS_TYPES.find((b) => b.id === businessId);
  if (!def) return fail(state, "Unknown business");
  if (def.unlockLevel && state.progression.level < def.unlockLevel)
    return fail(state, `Unlocks at level ${def.unlockLevel}`);
  if (def.startupCost > state.stats.cash) return fail(state, "Not enough capital");

  const s = clone(state);
  s.stats.cash -= def.startupCost;
  grantXp(s.progression, 20);
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

// --------------------------- Education ---------------------------

export function studyEducation(state: GameState, educationId: string): ActionResult {
  const edu = educationById(educationId);
  if (!edu) return fail(state, "Unknown program");
  const gate = canStartStudy(state, edu);
  if (!gate.ok) return fail(state, gate.reason ?? "Can't enroll");

  const s = clone(state);
  s.stats.cash -= edu.cost;
  if (edu.studyTicks <= 0) {
    s.progression.credentials.push(edu.id);
    grantXp(s.progression, 40);
    return { state: s, ok: true, message: `Earned ${edu.name}` };
  }
  s.progression.studyingId = edu.id;
  s.progression.studyTicksRemaining = edu.studyTicks;
  return { state: s, ok: true, message: `Enrolled: ${edu.name}` };
}

// --------------------------- Prestige ---------------------------

// Retire: convert net worth into permanent Legacy Points, then reset the run.
export function retire(state: GameState): ActionResult {
  if (!canRetire(state)) return fail(state, "Net worth too low to retire");
  const gain = legacyGain(state.stats.netWorth);

  const fresh = createInitialState(state.playerId);
  fresh.progression.legacyPoints = state.progression.legacyPoints + gain;
  fresh.progression.retirements = state.progression.retirements + 1;
  return {
    state: fresh,
    ok: true,
    message: `Retired! +${gain} Legacy Points (permanent income boost).`,
  };
}

function clone<T>(v: T): T {
  return typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v));
}

function rid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Trim share counts for messages: whole numbers stay whole, fractions show 4dp.
function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/0+$/, "");
}

function money(n: number): string {
  return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
