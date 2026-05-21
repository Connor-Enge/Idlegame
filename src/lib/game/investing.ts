import {
  ASSET_HISTORY_MAX,
  DIVIDEND_PER_TICK_FACTOR,
  GOLD_CASH_APY_PER_TICK,
  GOLD_FEE_PER_TICK,
  MARGIN_MULTIPLIER,
  MARGIN_RATE_PER_TICK,
  PORTFOLIO_HISTORY_MAX,
} from "./data";
import { grantXp } from "./progression";
import type { GameState, InvestingState, MarketAsset } from "./types";

export function defaultInvesting(): InvestingState {
  return {
    portfolioHistory: [],
    watchlists: [{ id: "default", name: "My First List", assetIds: [] }],
    orders: [],
    recurring: [],
    gold: false,
    goldSince: null,
    marginUsed: 0,
    realizedPL: 0,
    dividendsEarned: 0,
    tradeCount: 0,
  };
}

// Generate a believable price walk that ends exactly at the current price, so
// charts and sparklines have something to draw on a fresh save / new asset.
export function backfillHistory(asset: MarketAsset, points = ASSET_HISTORY_MAX): number[] {
  const out: number[] = new Array(points);
  let p = asset.price;
  out[points - 1] = round2(p);
  // Walk backwards from the present using the asset's own volatility/drift.
  for (let i = points - 2; i >= 0; i--) {
    const shock = (Math.random() * 2 - 1) * asset.volatility;
    p = p / (1 + asset.drift + shock);
    out[i] = round2(Math.max(0.01, p));
  }
  return out;
}

export function ensureHistory(asset: MarketAsset): MarketAsset {
  if (!asset.history || asset.history.length === 0) {
    asset.history = backfillHistory(asset);
  }
  return asset;
}

// Total market value of the player's holdings at current prices.
export function holdingsValue(s: GameState): number {
  let v = 0;
  for (const h of s.holdings) {
    const a = s.assets.find((x) => x.id === h.assetId);
    if (a) v += a.price * h.quantity;
  }
  return v;
}

// Cash available to deploy: real cash plus any Gold margin headroom.
export function buyingPower(s: GameState): number {
  const inv = s.investing;
  const margin = inv?.gold ? Math.max(0, holdingsValue(s) * MARGIN_MULTIPLIER - inv.marginUsed) : 0;
  return s.stats.cash + margin;
}

// Execute a share purchase, drawing from cash first and borrowing on margin
// for any shortfall (Gold only). Mutates s. Returns false if unaffordable.
export function settleBuy(s: GameState, assetId: string, shares: number): boolean {
  const asset = s.assets.find((a) => a.id === assetId);
  if (!asset || shares <= 0) return false;
  const cost = asset.price * shares;
  if (cost > buyingPower(s) + 1e-6) return false;

  const fromCash = Math.min(s.stats.cash, cost);
  const borrowed = cost - fromCash;
  s.stats.cash -= fromCash;
  if (borrowed > 0) s.investing.marginUsed += borrowed;

  const existing = s.holdings.find((h) => h.assetId === assetId);
  if (existing) {
    const totalQty = existing.quantity + shares;
    existing.avgCost = (existing.avgCost * existing.quantity + cost) / totalQty;
    existing.quantity = totalQty;
  } else {
    s.holdings.push({ assetId, quantity: shares, avgCost: asset.price });
  }
  s.investing.tradeCount += 1;
  return true;
}

// Sell shares; proceeds first pay down any margin debt, remainder to cash.
// Mutates s. Returns realized profit, or null if the player lacks the shares.
export function settleSell(s: GameState, assetId: string, shares: number): number | null {
  const asset = s.assets.find((a) => a.id === assetId);
  const holding = s.holdings.find((h) => h.assetId === assetId);
  if (!asset || !holding || holding.quantity < shares - 1e-9 || shares <= 0) return null;

  const proceeds = asset.price * shares;
  const profit = (asset.price - holding.avgCost) * shares;

  const payDebt = Math.min(s.investing.marginUsed, proceeds);
  s.investing.marginUsed -= payDebt;
  s.stats.cash += proceeds - payDebt;

  holding.quantity -= shares;
  if (holding.quantity <= 1e-9) {
    s.holdings = s.holdings.filter((h) => h.assetId !== assetId);
  }
  s.investing.realizedPL += profit;
  s.investing.tradeCount += 1;
  return profit;
}

// Per-tick brokerage processing: price history, dividends, Gold economics,
// margin interest, recurring buys, resting-order fills, portfolio snapshot.
// Runs inside the engine's stepOnce on already-cloned, repriced state.
export function processInvestingTick(s: GameState): void {
  const inv = s.investing;

  // 1. Append the new price to each asset's rolling history.
  for (const a of s.assets) {
    if (!a.history) a.history = [];
    a.history.push(a.price);
    if (a.history.length > ASSET_HISTORY_MAX) {
      a.history = a.history.slice(a.history.length - ASSET_HISTORY_MAX);
    }
  }

  // 2. Dividends — a small trickle into cash for yield-paying holdings.
  for (const h of s.holdings) {
    const a = s.assets.find((x) => x.id === h.assetId);
    if (!a?.dividendYield) continue;
    const div = a.price * h.quantity * (a.dividendYield / 100) * DIVIDEND_PER_TICK_FACTOR;
    s.stats.cash += div;
    inv.dividendsEarned += div;
  }

  // 3. Margin interest accrues whenever there's an outstanding balance.
  if (inv.marginUsed > 0) {
    inv.marginUsed *= 1 + MARGIN_RATE_PER_TICK;
  }

  // 4. Robinhood Gold: pay interest on idle cash, collect the subscription fee.
  if (inv.gold) {
    s.stats.cash += s.stats.cash * GOLD_CASH_APY_PER_TICK;
    s.stats.cash -= GOLD_FEE_PER_TICK;
    if (s.stats.cash < 0) {
      // Can't cover the fee — auto-cancel the subscription.
      s.stats.cash = 0;
      inv.gold = false;
      inv.goldSince = null;
    }
  }

  // 5. Recurring (DCA) buys fire on their cadence.
  for (const plan of inv.recurring) {
    if (s.economy.tick < plan.nextTick) continue;
    const a = s.assets.find((x) => x.id === plan.assetId);
    plan.nextTick = s.economy.tick + plan.everyTicks;
    if (!a) continue;
    const shares = plan.amount / a.price;
    if (settleBuy(s, plan.assetId, shares)) {
      grantXp(s.progression, 2);
    }
  }

  // 6. Resting limit / stop orders fill when price crosses the trigger.
  if (inv.orders.length) {
    const remaining = [];
    for (const o of inv.orders) {
      const a = s.assets.find((x) => x.id === o.assetId);
      if (!a) continue;
      const p = a.price;
      // Buy limit fills at/below trigger; sell limit at/above. Stops mirror.
      const fills =
        o.side === "buy"
          ? o.trigger === "limit"
            ? p <= o.price
            : p >= o.price
          : o.trigger === "limit"
            ? p >= o.price
            : p <= o.price;
      if (!fills) {
        remaining.push(o);
        continue;
      }
      if (o.side === "buy") {
        if (!settleBuy(s, o.assetId, o.shares)) {
          remaining.push(o); // couldn't afford — leave it resting
          continue;
        }
      } else {
        if (settleSell(s, o.assetId, o.shares) == null) continue; // shares gone
      }
      grantXp(s.progression, 4);
    }
    inv.orders = remaining;
  }

  // 7. Snapshot total investments value for the portfolio chart.
  inv.portfolioHistory.push(round2(holdingsValue(s)));
  if (inv.portfolioHistory.length > PORTFOLIO_HISTORY_MAX) {
    inv.portfolioHistory = inv.portfolioHistory.slice(
      inv.portfolioHistory.length - PORTFOLIO_HISTORY_MAX,
    );
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
