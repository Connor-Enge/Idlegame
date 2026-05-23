import type {
  EconomyEvent,
  EconomyPhase,
  EconomyState,
  MarketAsset,
} from "./types";

// Mean reversion (log space) pulls the live price back toward the asset's
// anchor — a fixed reference (its IPO / listing price). There's no hard
// upper or lower band, so a stock that's hammered by sentiment events can
// crash all the way to bankruptcy; a stock that's pumping can keep climbing
// for as long as the wind blows. Bankruptcy triggers below BANKRUPT_RATIO of
// anchor; the market layer replaces dead listings with fresh procedural IPOs.
//
// Tuning intent:
//   - per-tick shocks dominate the action (1-5% wobble),
//   - reversion firmly snaps quick spikes back so quick-flip exploits cap out,
//   - sustained sector / sentiment crashes can still take a name to zero.
const REVERSION = 0.12;
const DRIFT_SCALE = 0.25; // damp per-asset constant drift — it compounds hard
const MOMENTUM_NOISE = 0.2; // per-tick random kick fed into asset's own trend
export const BANKRUPT_RATIO = 0.08; // price ≤ 8% of anchor → bankrupt
export const BANKRUPT_FLOOR = 0.01; // absolute price floor before delist

// A lightweight simulated macro economy. Each tick the economy can transition
// between business-cycle phases, drift its macro indicators, spawn/expire
// events, and those indicators feed into asset pricing, rent and margins.

const PHASE_ORDER: EconomyPhase[] = [
  "recovery",
  "expansion",
  "boom",
  "peak",
  "recession",
  "depression",
];

// Tunables per phase: how indicators bias each tick.
const PHASE_PROFILE: Record<
  EconomyPhase,
  { growth: number; sentiment: number; transitionChance: number }
> = {
  recovery: { growth: 0.015, sentiment: 0.2, transitionChance: 0.02 },
  expansion: { growth: 0.03, sentiment: 0.4, transitionChance: 0.015 },
  boom: { growth: 0.05, sentiment: 0.7, transitionChance: 0.025 },
  peak: { growth: 0.01, sentiment: 0.3, transitionChance: 0.06 },
  recession: { growth: -0.03, sentiment: -0.5, transitionChance: 0.04 },
  depression: { growth: -0.05, sentiment: -0.8, transitionChance: 0.05 },
};

const EVENT_POOL: Omit<EconomyEvent, "ticksRemaining">[] = [
  {
    id: "rate-hike",
    title: "Central Bank Rate Hike",
    description: "Borrowing costs jump. Growth stocks wobble.",
    effects: { interestRate: 0.5, sentiment: -0.2 },
  },
  {
    id: "tech-mania",
    title: "Tech Mania",
    description: "Investors pile into anything with an API.",
    effects: { sentiment: 0.3, sectorBoost: { sector: "tech", multiplier: 1.04 } },
  },
  {
    id: "oil-shock",
    title: "Oil Supply Shock",
    description: "Energy prices spike worldwide.",
    effects: { inflation: 1.5, sectorBoost: { sector: "energy", multiplier: 1.06 } },
  },
  {
    id: "crypto-crash",
    title: "Crypto Flash Crash",
    description: "A major exchange halts withdrawals.",
    effects: { sentiment: -0.4, sectorBoost: { sector: "crypto", multiplier: 0.9 } },
  },
  {
    id: "stimulus",
    title: "Government Stimulus",
    description: "Checks in the mail. Risk assets rip.",
    effects: { sentiment: 0.5, inflation: 0.8 },
  },
  {
    id: "housing-boom",
    title: "Housing Boom",
    description: "Everyone wants a yard. Rents climb.",
    effects: { sentiment: 0.2 },
  },
];

export function initialEconomy(): EconomyState {
  return {
    phase: "expansion",
    gdpGrowth: 0.03,
    inflation: 2.0,
    interestRate: 3.0,
    unemployment: 5.0,
    marketSentiment: 0.3,
    tick: 0,
    activeEvents: [],
  };
}

function rng() {
  return Math.random();
}

export function stepEconomy(state: EconomyState): EconomyState {
  const profile = PHASE_PROFILE[state.phase];
  let phase = state.phase;

  // Possibly advance the business cycle.
  if (rng() < profile.transitionChance) {
    const idx = PHASE_ORDER.indexOf(state.phase);
    phase = PHASE_ORDER[(idx + 1) % PHASE_ORDER.length];
  }

  // Drift macro indicators toward the phase profile with noise.
  const gdpGrowth = lerp(state.gdpGrowth, profile.growth, 0.1) + noise(0.004);
  const baseSentiment = lerp(state.marketSentiment, profile.sentiment, 0.1) + noise(0.05);

  // Apply active events to sentiment / inflation / rates.
  let inflation = clamp(state.inflation + noise(0.05), 0, 25);
  let interestRate = clamp(state.interestRate + noise(0.03), 0, 20);
  let sentiment = baseSentiment;
  for (const ev of state.activeEvents) {
    if (ev.effects.sentiment) sentiment += ev.effects.sentiment * 0.2;
    if (ev.effects.inflation) inflation += ev.effects.inflation * 0.1;
    if (ev.effects.interestRate) interestRate += ev.effects.interestRate * 0.1;
  }
  sentiment = clamp(sentiment, -1, 1);

  // Unemployment loosely inversely tracks growth.
  const unemployment = clamp(state.unemployment - gdpGrowth * 10 + noise(0.1), 2, 25);

  // Tick down events, drop expired ones.
  const activeEvents = state.activeEvents
    .map((e) => ({ ...e, ticksRemaining: e.ticksRemaining - 1 }))
    .filter((e) => e.ticksRemaining > 0);

  // Occasionally spawn a new event (cap at 3 concurrent).
  if (activeEvents.length < 3 && rng() < 0.03) {
    const template = EVENT_POOL[Math.floor(rng() * EVENT_POOL.length)];
    if (!activeEvents.some((e) => e.id === template.id)) {
      activeEvents.push({ ...template, ticksRemaining: 30 + Math.floor(rng() * 60) });
    }
  }

  return {
    phase,
    gdpGrowth,
    inflation,
    interestRate,
    unemployment,
    marketSentiment: sentiment,
    tick: state.tick + 1,
    activeEvents,
  };
}

// Each asset's sensitivity to the shared market sentiment. Stocks/crypto move
// WITH the market; bonds and gold are safe havens that move AGAINST it.
function sentimentBeta(asset: MarketAsset): number {
  if (asset.class === "bond") return -0.5;
  if (asset.sector === "metals") return -0.3;
  if (asset.class === "crypto") return 1.4;
  if (asset.class === "commodity") return 0.35;
  return 1; // stocks, indices
}

// Re-price a single asset for the current economy tick. The move combines a
// SHARED market factor (sentiment × the asset's beta) with the asset's OWN
// idiosyncratic momentum + random shock, so names don't all move in lockstep.
// The anchor drifts toward the live price slowly, so trends compound; mean
// reversion still pulls hard on short-term shocks. No hard band — a stock can
// triple, or grind to zero. Bankruptcy is flagged here for the market layer.
export function stepAsset(asset: MarketAsset, economy: EconomyState): MarketAsset {
  const sentimentBias = economy.marketSentiment * asset.volatility * 0.5 * sentimentBeta(asset);
  let sectorMult = 1;
  for (const ev of economy.activeEvents) {
    if (ev.effects.sectorBoost && ev.effects.sectorBoost.sector === asset.sector) {
      sectorMult *= ev.effects.sectorBoost.multiplier;
    }
  }
  // Bonds get cheaper as rates rise.
  const rateDrag = asset.class === "bond" ? -(economy.interestRate - 3) * 0.001 : 0;

  // Idiosyncratic momentum: a per-asset trend that random-walks and decays,
  // giving each name its own multi-tick direction (the main de-correlator).
  const momentum = (asset.momentum ?? 0) * 0.96 + (rng() * 2 - 1) * asset.volatility * MOMENTUM_NOISE;

  let shock = (rng() * 2 - 1) * asset.volatility;
  // Rare tail risk: every now and then a stock takes a catastrophic one-tick
  // hit. Most names absorb it and recover; an unlucky few crater straight to
  // bankruptcy and get replaced by a fresh IPO. Bonds + gold are safe-haven
  // and skip this (real-world equivalent: rates can spike, but treasuries
  // don't fail-to-zero overnight in the same way).
  const exposedToTail = asset.class !== "bond" && asset.sector !== "metals";
  // ~1 catastrophic event per 8000 ticks per exposed asset (every couple of
  // hours of continuous play across the whole market) — rare enough that any
  // given stock can run for a long time, frequent enough that the chain of
  // bankruptcy → IPO actually matters.
  if (exposedToTail && rng() < 0.00012) shock -= 0.75 + rng() * 0.2; // −75% to −95%
  // Mean reversion toward the *moving* anchor — stronger the further off it
  // is, but the anchor itself drifts toward the live price each tick (below)
  // so genuine trends are allowed to compound.
  const anchor = asset.anchor ?? asset.price;
  const reversion = -REVERSION * Math.log(asset.price / Math.max(0.01, anchor));
  // Damp constant drift — a tiny per-tick drift compounds wildly (e.g. 0.0005
  // becomes 5x over 3000 ticks); DRIFT_SCALE pulls that back into a sane band.
  const change = asset.drift * DRIFT_SCALE + momentum + sentimentBias + shock + rateDrag + reversion;
  const rawPrice = Math.max(0, asset.price * (1 + change) * sectorMult);
  const price = Math.max(BANKRUPT_FLOOR / 2, round2(rawPrice));

  // Anchor is fixed at the listing / IPO price — it does NOT track the live
  // price. That keeps the random walk bounded around a stable reference.
  // Bankruptcy: price collapses far below anchor or hits the absolute floor.
  const bankrupt = price < Math.max(BANKRUPT_FLOOR, anchor * BANKRUPT_RATIO);

  return { ...asset, price, momentum, anchor, bankrupt };
}

export function macroSummary(e: EconomyState): string {
  return `${e.phase.toUpperCase()} · GDP ${(e.gdpGrowth * 100).toFixed(1)}% · CPI ${e.inflation.toFixed(1)}% · Rate ${e.interestRate.toFixed(1)}%`;
}

// ---- small math helpers ----
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function noise(scale: number) {
  return (rng() * 2 - 1) * scale;
}
function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
function round2(v: number) {
  return Math.round(v * 100) / 100;
}
