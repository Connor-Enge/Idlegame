import { BUSINESS_TYPES, PROPERTIES } from "./data";
import {
  MAX_LOCATIONS,
  expansionCost,
  freshBusiness,
  ipoEligible,
  ipoValuation,
  makeManager,
  managerSalary,
  mechanicFor,
  salePrice,
} from "./business";
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
import type {
  GambleGame,
  GambleResult,
  GameState,
  ManagerSpecialty,
} from "./types";

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

// Play one round of a job's minigame. `points` is the metric the minigame
// produced (clicks, hits, combos…). Earns cash + progression XP. If `jobIdx`
// matches the current job, also advances the chain; if `jobIdx` is a cleared
// (lower) job, it's a replay — cash and XP only, no chain progress. Active-
// only income.
export function workJob(state: GameState, points: number, jobIdx?: number): ActionResult {
  if (!Number.isFinite(points) || points <= 0) return fail(state, "No progress made");
  const target = typeof jobIdx === "number" ? jobIdx : state.career.jobIndex;
  if (target < 0 || target > state.career.jobIndex) return fail(state, "Job locked");
  const job = jobByIndex(target);
  const mg = minigameById(job.minigameId);

  const s = clone(state);
  const c = s.career;
  const cash = Math.round(points * job.cashPerPoint);
  s.stats.cash += cash;
  c.totalEarned += cash;
  c.roundsPlayed += 1;
  grantXp(s.progression, careerRoundXp(job));

  let message = `+${money(cash)} · ${Math.round(points)} ${mg.unit}`;
  const isCurrent = target === c.jobIndex;

  if (isCurrent) {
    c.progress += points;
    if (c.progress >= job.goal) {
      if (c.jobIndex < JOB_COUNT - 1) {
        const next = jobByIndex(c.jobIndex + 1);
        const cred = next.requiresCredential;
        if (cred && !s.progression.credentials.includes(cred)) {
          // Goal met but the next job needs a credential the player hasn't
          // earned yet. Clamp progress at the goal and wait — the UI shows a
          // "claim promotion" CTA once they study the credential.
          c.progress = job.goal;
          message = `Goal hit — earn ${cred.toUpperCase()} to unlock ${next.title}`;
        } else {
          c.jobIndex += 1;
          c.progress = 0;
          c.jobsCleared += 1;
          message = `Goal hit! Promoted to ${next.icon} ${next.title} 🎉`;
        }
      } else {
        // Already at the top of the ladder — clamp progress, keep earning.
        c.progress = job.goal;
        if (c.jobsCleared < JOB_COUNT) c.jobsCleared = JOB_COUNT;
        message = `+${money(cash)} · top of the ladder 👑`;
      }
    }
  } else {
    message += " (replay)";
  }

  s.stats.netWorth = computeNetWorth(s);
  return { state: s, ok: true, message };
}

// Advance from a credential-gated job once both conditions are met: the
// player has cleared the goal AND earned the required credential. This is
// the explicit "claim promotion" button workJob defers to when blocked.
export function promote(state: GameState): ActionResult {
  const c = state.career;
  if (c.jobIndex >= JOB_COUNT - 1) return fail(state, "Already at the top");
  const job = jobByIndex(c.jobIndex);
  if (c.progress < job.goal) return fail(state, "Hit the goal first");
  const next = jobByIndex(c.jobIndex + 1);
  if (next.requiresCredential && !state.progression.credentials.includes(next.requiresCredential)) {
    return fail(state, `Need ${next.requiresCredential.toUpperCase()} to advance`);
  }
  const s = clone(state);
  s.career.jobIndex += 1;
  s.career.progress = 0;
  s.career.jobsCleared += 1;
  s.stats.netWorth = computeNetWorth(s);
  return { state: s, ok: true, message: `Promoted to ${next.icon} ${next.title} 🎉` };
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
  s.businesses.push(freshBusiness(businessId));
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

export function investMarketing(state: GameState, index: number): ActionResult {
  const biz = state.businesses[index];
  if (!biz) return fail(state, "You don't own that");
  const cost = 5000 * (biz.marketingLevel + 1);
  if (cost > state.stats.cash) return fail(state, "Can't afford marketing");
  const s = clone(state);
  s.stats.cash -= cost;
  s.businesses[index].marketingLevel += 1;
  // Marketing also gives the mechanic-state a small boost (puts the
  // business on the front foot — extra members, occupancy, hype, etc.).
  const mech = mechanicFor(biz);
  const delta = (mech.max - mech.min) * 0.18;
  s.businesses[index].mState = Math.min(mech.max, biz.mState + delta);
  return { state: s, ok: true, message: "Marketing boosted" };
}

// Adjust the mechanic state directly (menu markup slider, hype campaign etc.)
export function setBusinessMState(state: GameState, index: number, mState: number): ActionResult {
  const biz = state.businesses[index];
  if (!biz) return fail(state, "You don't own that");
  const mech = mechanicFor(biz);
  const clamped = Math.max(mech.min, Math.min(mech.max, mState));
  const s = clone(state);
  s.businesses[index] = { ...biz, mState: clamped };
  return { state: s, ok: true, message: `${mech.label} → ${clamped.toFixed(1)}${mech.unit}` };
}

// Targeted cash investment to boost mechanic state — e.g. retraining staff
// (quality), member drive (churn), ad campaign (hype), grand opening (capacity).
export function investBusinessOps(state: GameState, index: number): ActionResult {
  const biz = state.businesses[index];
  if (!biz) return fail(state, "You don't own that");
  const def = BUSINESS_TYPES.find((b) => b.id === biz.businessId)!;
  const cost = Math.round(def.startupCost * 0.06 * biz.level);
  if (cost > state.stats.cash) return fail(state, `Need ${money(cost)}`);
  const mech = mechanicFor(biz);
  const s = clone(state);
  s.stats.cash -= cost;
  const delta = (mech.max - mech.min) * 0.25;
  s.businesses[index] = { ...biz, mState: Math.min(mech.max, biz.mState + delta) };
  return { state: s, ok: true, message: `Invested in ${mech.label.toLowerCase()}` };
}

// Hire a manager into one of three specialty roles. Replaces the previous
// "hireEmployee" (employees added cost with no benefit). Fires the current
// manager if one is already in place (single slot per business for now).
export function hireManager(state: GameState, index: number, specialty: ManagerSpecialty, level = 1): ActionResult {
  const biz = state.businesses[index];
  if (!biz) return fail(state, "You don't own that");
  const def = BUSINESS_TYPES.find((b) => b.id === biz.businessId)!;
  const cost = Math.round(def.startupCost * (0.04 + 0.03 * level));
  if (cost > state.stats.cash) return fail(state, `Need ${money(cost)} signing bonus`);
  const s = clone(state);
  s.stats.cash -= cost;
  s.businesses[index] = { ...biz, manager: makeManager(specialty, level, biz) };
  return { state: s, ok: true, message: `Hired ${s.businesses[index].manager!.name}` };
}

export function fireManager(state: GameState, index: number): ActionResult {
  const biz = state.businesses[index];
  if (!biz || !biz.manager) return fail(state, "No manager to fire");
  const s = clone(state);
  // Severance — one month's salary.
  s.stats.cash = Math.max(0, s.stats.cash - biz.manager.salaryPerTick * 30);
  s.businesses[index] = { ...biz, manager: null };
  return { state: s, ok: true, message: `Let go of ${biz.manager.name}` };
}

// Promote the current manager up a tier (cap at 5).
export function promoteManager(state: GameState, index: number): ActionResult {
  const biz = state.businesses[index];
  if (!biz?.manager) return fail(state, "No manager");
  if (biz.manager.level >= 5) return fail(state, "Already top-level");
  const cost = managerSalary(biz.manager.level + 1, biz) * 60; // 60 ticks of new salary up front
  if (cost > state.stats.cash) return fail(state, `Need ${money(cost)} to promote`);
  const s = clone(state);
  s.stats.cash -= cost;
  s.businesses[index] = {
    ...biz,
    manager: {
      ...biz.manager,
      level: biz.manager.level + 1,
      salaryPerTick: managerSalary(biz.manager.level + 1, biz),
    },
  };
  return { state: s, ok: true, message: `Promoted ${biz.manager.name}` };
}

// Pick an option on the business's pending event.
export function resolveEvent(state: GameState, index: number, optionIdx: number): ActionResult {
  const biz = state.businesses[index];
  if (!biz?.event) return fail(state, "No active event");
  const opt = biz.event.options[optionIdx];
  if (!opt) return fail(state, "Unknown option");
  if (opt.cost && opt.cost > state.stats.cash) return fail(state, `Need ${money(opt.cost)}`);
  const s = clone(state);
  if (opt.cost) s.stats.cash -= opt.cost;
  const mech = mechanicFor(biz);
  const next = { ...biz };
  if (opt.effect.reserveDelta) next.reserve += opt.effect.reserveDelta;
  if (opt.effect.cashDelta) s.stats.cash += opt.effect.cashDelta;
  if (opt.effect.mStateDelta) {
    next.mState = Math.max(mech.min, Math.min(mech.max, next.mState + opt.effect.mStateDelta));
  }
  next.event = null;
  s.businesses[index] = next;
  return { state: s, ok: true, message: `${biz.event.title}: ${opt.label}` };
}

// Open another outlet of an owned business — chain expansion.
export function expandBusiness(state: GameState, index: number): ActionResult {
  const biz = state.businesses[index];
  if (!biz) return fail(state, "You don't own that");
  if (biz.isPublic) return fail(state, "Public companies can't add outlets");
  if (biz.locations >= MAX_LOCATIONS) return fail(state, "Chain at maximum size");
  const cost = expansionCost(biz);
  if (cost > state.stats.cash) return fail(state, `Need ${money(cost)} to open another location`);
  const s = clone(state);
  s.stats.cash -= cost;
  s.businesses[index] = { ...biz, locations: biz.locations + 1 };
  return { state: s, ok: true, message: `Opened location #${biz.locations + 1}` };
}

// IPO the business: one-time cash payout in exchange for a passive
// dividend stream and giving up active management.
export function ipoBusiness(state: GameState, index: number): ActionResult {
  const biz = state.businesses[index];
  if (!biz) return fail(state, "You don't own that");
  const gate = ipoEligible(biz);
  if (!gate.ok) return fail(state, gate.reason ?? "Not eligible for IPO");
  const proceeds = ipoValuation(biz);
  const s = clone(state);
  s.stats.cash += proceeds;
  s.businesses[index] = { ...biz, isPublic: true, manager: null, event: null };
  s.stats.netWorth = computeNetWorth(s);
  return { state: s, ok: true, message: `IPO'd for ${money(proceeds)} — now a passive dividend.` };
}

export function sellBusiness(state: GameState, index: number): ActionResult {
  const biz = state.businesses[index];
  if (!biz) return fail(state, "You don't own that");
  const def = BUSINESS_TYPES.find((b) => b.id === biz.businessId)!;
  const proceeds = salePrice(biz);
  const s = clone(state);
  s.stats.cash += proceeds;
  s.businesses.splice(index, 1);
  s.stats.netWorth = computeNetWorth(s);
  return { state: s, ok: true, message: `Sold ${def.name} for ${money(proceeds)}` };
}

// (legacy hireEmployee kept as a no-op alias for any stale UI; new code uses
// hireManager. Marked deprecated; safe to delete once no UI calls it.)
export function hireEmployee(state: GameState): ActionResult {
  return fail(state, "Employees were replaced by managers — hire one instead");
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
  // Earned achievements persist across prestige — they're permanent milestones.
  fresh.progression.achievements = [...state.progression.achievements];
  fresh.life.generation = state.life.generation + 1;
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
