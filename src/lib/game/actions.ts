import { BUSINESS_TYPES, CAREER_TRACKS, PROPERTIES } from "./data";
import { PERKS, PROJECTS } from "./careerData";
import {
  REVIEW_COOLDOWN_TICKS,
  TRAIN_ENERGY,
  canNegotiate,
  canTrain,
  currentLevel,
  gigById,
  getSkillLevel,
  perkBundle,
  qualityFromPosition,
  raiseChance,
  resolveGig,
  resolveShift,
  rollShiftTasks,
  trackById,
  trainCost,
  trainXpGain,
  zonesForSkill,
} from "./career";
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
  trackUnlocked,
} from "./progression";
import type {
  GambleGame,
  GambleResult,
  GameState,
  GigResult,
  ShiftMoment,
  ShiftResult,
} from "./types";

export type ActionResult = {
  state: GameState;
  ok: boolean;
  message: string;
  gamble?: GambleResult;
  shift?: ShiftResult;
  gig?: GigResult;
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

export function takeJob(state: GameState, trackId: string): ActionResult {
  const track = CAREER_TRACKS.find((t) => t.id === trackId);
  if (!track) return fail(state, "Unknown career track");
  const gate = trackUnlocked(state, track);
  if (!gate.ok) return fail(state, `Locked: ${gate.reason}`);
  const entry = track.levels[0];

  const s = clone(state);
  // Always start at the bottom of a track. Job-specific progress (level, shifts,
  // performance, raises, project) resets; skills, perks and morale carry over.
  s.career.trackId = trackId;
  s.career.levelIndex = 0;
  s.career.shiftsWorked = 0;
  s.career.employedSince = Date.now();
  s.career.performance = 0;
  s.career.salaryMultiplier = 1;
  s.career.activeProject = null;
  s.career.reviewCooldownTicks = 0;
  return { state: s, ok: true, message: `Hired as ${entry.title}` };
}

export function quitJob(state: GameState): ActionResult {
  const s = clone(state);
  s.career.trackId = null;
  s.career.levelIndex = 0;
  s.career.shiftsWorked = 0;
  s.career.employedSince = null;
  s.career.performance = 0;
  s.career.salaryMultiplier = 1;
  s.career.activeProject = null;
  return { state: s, ok: true, message: "You quit. Bold." };
}

// Apply a fully-resolved shift to the state. Shared by the timed mini-game
// (commitShift) and the auto-resolved Quick Shift (workShift).
function applyShift(state: GameState, result: ShiftResult): ActionResult {
  const s = clone(state);
  const c = s.career;
  const track = trackById(c.trackId)!;
  const level = track.levels[c.levelIndex];

  s.stats.energy = Math.max(0, s.stats.energy - result.energyCost);
  s.stats.cash += result.cash;
  s.stats.reputation += result.reputation;
  c.totalEarned += result.cash;
  c.shiftsWorked += 1;
  c.shiftsTotal += 1;
  c.performance = Math.min(100, c.performance + result.performanceGain);
  c.morale = Math.max(0, Math.min(100, c.morale + result.moraleChange));
  c.shiftStreak = result.score >= 0.45 ? c.shiftStreak + 1 : 0;
  c.bestShiftStreak = Math.max(c.bestShiftStreak, c.shiftStreak);

  for (const [skillId, xp] of Object.entries(result.skillXp)) {
    c.skills[skillId] = (c.skills[skillId] ?? 0) + xp;
  }
  grantXp(s.progression, 8 + level.tier * 3 + result.score * 6);

  // Project progress / completion.
  if (c.activeProject) {
    c.activeProject.shiftsRemaining -= 1;
    if (result.projectCompleted) {
      s.stats.cash += result.projectCompleted.bonus;
      c.totalEarned += result.projectCompleted.bonus;
      const def = PROJECTS.find((p) => p.id === c.activeProject!.projectId);
      if (def) {
        s.stats.reputation += def.reputation;
        c.skills[def.skillId] = (c.skills[def.skillId] ?? 0) + def.skillXp;
      }
      c.projectsCompleted += 1;
      c.activeProject = null;
    }
  }

  // Promotion.
  let message = `Shift done — +$${result.cash.toLocaleString()}`;
  if (result.promoted) {
    c.levelIndex += 1;
    c.shiftsWorked = 0;
    c.performance = 40;
    c.morale = Math.min(100, c.morale + 10);
    message = `Promoted to ${result.newTitle}! 🎉`;
  } else if (result.projectCompleted) {
    message = `Project complete: ${result.projectCompleted.name} (+$${result.projectCompleted.bonus.toLocaleString()})`;
  }

  s.stats.netWorth = computeNetWorth(s);
  return { state: s, ok: true, message, shift: result };
}

// The interactive shift: the UI resolves each timed moment and commits the set.
export function commitShift(state: GameState, moments: ShiftMoment[]): ActionResult {
  if (!state.career.trackId) return fail(state, "You don't have a job");
  const level = currentLevel(state);
  if (!level) return fail(state, "You don't have a job");
  const perks = perkBundle(state);
  const energyCost = Math.max(1, level.energyCostPerShift + perks.shiftEnergy);
  if (state.stats.energy < energyCost) return fail(state, "Too tired — rest or wait for energy");
  const result = resolveShift(state, moments);
  if (!result) return fail(state, "Can't work right now");
  return applyShift(state, result);
}

// Quick Shift: auto-resolve a shift without the mini-game. Each moment's
// quality is rolled from the relevant skill level — trained skills do better.
export function workShift(state: GameState): ActionResult {
  if (!state.career.trackId) return fail(state, "You don't have a job");
  const level = currentLevel(state);
  if (!level) return fail(state, "You don't have a job");
  const perks = perkBundle(state);
  const energyCost = Math.max(1, level.energyCostPerShift + perks.shiftEnergy);
  if (state.stats.energy < energyCost) return fail(state, "Too tired — rest or wait for energy");

  const tasks = rollShiftTasks(state.career.trackId);
  const moments: ShiftMoment[] = tasks.map((task) => {
    const lvl = getSkillLevel(state, task.skillId);
    const zones = zonesForSkill(lvl);
    // Simulate a stop near center, jittered. Better skill → tighter aim.
    const spread = 26 - lvl * 0.7;
    const pos = 50 + (Math.random() - 0.5) * 2 * spread;
    return { taskId: task.id, skillId: task.skillId, quality: qualityFromPosition(pos, zones) };
  });
  const result = resolveShift(state, moments);
  if (!result) return fail(state, "Can't work right now");
  return applyShift(state, result);
}

export function rest(state: GameState): ActionResult {
  const s = clone(state);
  s.stats.energy = s.stats.maxEnergy;
  s.career.morale = Math.min(100, s.career.morale + 6);
  return { state: s, ok: true, message: "Rested. Energy full." };
}

// --------------------------- Side gigs ---------------------------

export function commitGig(state: GameState, gigId: string, position: number): ActionResult {
  const gig = gigById(gigId);
  if (!gig) return fail(state, "Unknown gig");
  if (state.progression.level < gig.levelRequired)
    return fail(state, `Unlocks at level ${gig.levelRequired}`);
  if (state.career.gigCooldownTicks > 0) return fail(state, "Gig on cooldown");
  if (state.stats.energy < gig.energyCost) return fail(state, "Too tired for a gig");

  const lvl = getSkillLevel(state, gig.skillId);
  const zones = zonesForSkill(lvl);
  const quality = qualityFromPosition(position, zones);
  const result = resolveGig(state, gigId, quality);
  if (!result) return fail(state, "Gig failed");

  const s = clone(state);
  const perks = perkBundle(s);
  s.stats.energy = Math.max(0, s.stats.energy - result.energyCost);
  s.stats.cash += result.cash;
  s.stats.reputation += result.reputation;
  s.career.skills[result.skillId] = (s.career.skills[result.skillId] ?? 0) + result.skillXp;
  s.career.totalEarned += result.cash;
  s.career.gigsCompleted += 1;
  s.career.gigCooldownTicks = Math.round(gig.cooldownTicks * perks.gigCooldownMult);
  grantXp(s.progression, 5 + Math.min(12, Math.log10(result.cash + 1) * 3));
  s.stats.netWorth = computeNetWorth(s);
  return { state: s, ok: true, message: `${gig.name}: +$${result.cash.toLocaleString()}`, gig: result };
}

// --------------------------- Skill training ---------------------------

export function trainSkill(state: GameState, skillId: string): ActionResult {
  const gate = canTrain(state, skillId);
  if (!gate.ok) return fail(state, gate.reason ?? "Can't train");
  const lvl = getSkillLevel(state, skillId);
  const cost = trainCost(lvl);
  const perks = perkBundle(state);

  const s = clone(state);
  s.stats.cash -= cost;
  s.stats.energy = Math.max(0, s.stats.energy - TRAIN_ENERGY);
  s.career.skills[skillId] = (s.career.skills[skillId] ?? 0) + trainXpGain(lvl) * perks.skillXpMult;
  grantXp(s.progression, 6);
  s.stats.netWorth = computeNetWorth(s);
  return { state: s, ok: true, message: "Skill trained" };
}

// --------------------------- Raises / reviews ---------------------------

export function negotiateRaise(state: GameState): ActionResult {
  const gate = canNegotiate(state);
  if (!gate.ok) return fail(state, gate.reason ?? "Can't negotiate");

  const s = clone(state);
  const chance = raiseChance(s);
  s.career.reviewCooldownTicks = REVIEW_COOLDOWN_TICKS;
  if (Math.random() < chance) {
    s.career.salaryMultiplier += 0.15;
    s.career.raisesNegotiated += 1;
    s.career.morale = Math.min(100, s.career.morale + 8);
    s.career.performance = Math.max(0, s.career.performance - 20);
    grantXp(s.progression, 25);
    return {
      state: s,
      ok: true,
      message: `Raise approved! Salary ×${s.career.salaryMultiplier.toFixed(2)} 🎉`,
    };
  }
  s.career.morale = Math.max(0, s.career.morale - 10);
  s.stats.reputation = Math.max(0, s.stats.reputation - 3);
  return { state: s, ok: true, message: "Raise denied. Build more performance." };
}

// --------------------------- Perks ---------------------------

export function buyPerk(state: GameState, perkId: string): ActionResult {
  const perk = PERKS.find((p) => p.id === perkId);
  if (!perk) return fail(state, "Unknown perk");
  if (state.career.perks.includes(perkId)) return fail(state, "Already owned");
  if (state.progression.level < perk.levelRequired)
    return fail(state, `Unlocks at level ${perk.levelRequired}`);
  if (state.stats.cash < perk.cost) return fail(state, "Not enough cash");

  const s = clone(state);
  s.stats.cash -= perk.cost;
  s.career.perks.push(perkId);
  s.stats.netWorth = computeNetWorth(s);
  return { state: s, ok: true, message: `Unlocked: ${perk.name}` };
}

// --------------------------- Projects ---------------------------

export function acceptProject(state: GameState, projectId: string): ActionResult {
  if (!state.career.trackId) return fail(state, "Get a job first");
  if (state.career.activeProject) return fail(state, "Finish your current project first");
  const def = PROJECTS.find((p) => p.id === projectId);
  if (!def) return fail(state, "Unknown project");
  if (state.progression.level < def.levelRequired)
    return fail(state, `Unlocks at level ${def.levelRequired}`);

  const s = clone(state);
  s.career.activeProject = {
    projectId,
    shiftsRemaining: def.shifts,
    totalShifts: def.shifts,
  };
  return { state: s, ok: true, message: `Accepted: ${def.name}` };
}

export function abandonProject(state: GameState): ActionResult {
  if (!state.career.activeProject) return fail(state, "No active project");
  const s = clone(state);
  s.career.activeProject = null;
  s.career.morale = Math.max(0, s.career.morale - 8);
  return { state: s, ok: true, message: "Project abandoned" };
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
