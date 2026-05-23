import { BASE_ASSETS } from "./data";
import type {
  EconomyEvent,
  EconomyPhase,
  EconomyState,
  MarketAsset,
} from "./types";

// Reference (anchor) price per asset for mean reversion — keeps prices in a
// tradeable band instead of compounding to infinity over long sessions.
const REF_PRICE = new Map(BASE_ASSETS.map((a) => [a.id, a.price]));
const REVERSION = 0.08; // pull strength back toward the anchor (log space)
// Hard band caps how far a price can drift from its anchor before it's clamped.
// Crypto / leveraged products get a wider band; everything else stays tight so
// a buy-low / sell-high flip can't print a 100x return in a few hundred ticks.
const BAND_DEFAULT = 3;
const BAND_VOLATILE = 5; // crypto + leveraged
function bandFor(asset: MarketAsset): number {
  return asset.class === "crypto" || asset.id === "lev3x" ? BAND_VOLATILE : BAND_DEFAULT;
}

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
  const momentum = (asset.momentum ?? 0) * 0.96 + (rng() * 2 - 1) * asset.volatility * 0.35;

  const shock = (rng() * 2 - 1) * asset.volatility;
  // Mean reversion: the further price has drifted from its anchor, the harder
  // it's pulled back — so drift + sentiment cause a bounded premium, not a
  // runaway exponential. (Without this, long idle sessions print money.)
  const ref = REF_PRICE.get(asset.id) ?? asset.price;
  const reversion = -REVERSION * Math.log(asset.price / ref);
  const change = asset.drift + momentum + sentimentBias + shock + rateDrag + reversion;
  const raw = asset.price * (1 + change) * sectorMult;
  // Hard band: stocks/bonds/commodities ±3x, crypto/leveraged ±5x. Keeps the
  // peak buy-low / sell-high swing realistic so trading is a steady compounder,
  // not a one-flip jackpot.
  const b = bandFor(asset);
  const price = Math.max(ref / b, Math.min(ref * b, Math.max(0.01, round2(raw))));
  return { ...asset, price, momentum };
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
