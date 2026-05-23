// Shared market singleton. All players see the SAME prices, economy phase
// and history — the market is owned by the server, not simulated per-player.
//
// The market is fully procedural and unbounded: prices have no min/max cap.
// A stock can trend up indefinitely (the anchor drifts to follow), or grind
// down. When a stock's price collapses far enough it's declared bankrupt,
// delisted, and replaced in the same slot by a freshly-generated IPO.
//
// State lives in this module's memory; the singleton is advanced lazily when
// any request reads it (so we don't need a cron / background worker).

import { ASSET_HISTORY_MAX, BASE_ASSETS } from "@/lib/game/data";
import { initialEconomy, stepAsset, stepEconomy } from "@/lib/game/economy";
import { ensureHistory } from "@/lib/game/investing";
import type { EconomyState, MarketAsset } from "@/lib/game/types";

const TICK_MS = 1000;
// Cap how many ticks we'll catch up in a single request — if the process has
// been idle for hours we don't want one call to chew CPU replaying every tick.
const MAX_CATCHUP_TICKS = 120;

interface Market {
  assets: MarketAsset[];
  economy: EconomyState;
  lastTickAt: number;
  nextIpoSeq: number;
}

// Stash on globalThis so Next.js dev HMR doesn't reset the market every save.
const g = globalThis as unknown as { __sharedMarket?: Market };

function init(): Market {
  return {
    assets: BASE_ASSETS.map((a) => ({
      ...ensureHistory({ ...a }),
      anchor: a.price,
      listedAt: 0,
    })),
    economy: initialEconomy(),
    lastTickAt: Date.now(),
    nextIpoSeq: 1,
  };
}

// ---------------------------------------------------------------------------
// Procedural IPO generation — when a stock bankrupts, a new one with a fresh
// id, symbol, name, sector, and personality replaces it in the same slot.
// ---------------------------------------------------------------------------

const IPO_SECTORS = ["tech", "finance", "consumer", "energy", "health", "auto", "broad", "metals"];

const IPO_PREFIX = [
  "Nova", "Apex", "Quantum", "Stellar", "Helix", "Vortex", "Pulse", "Cipher",
  "Orion", "Lumen", "Halcyon", "Vertex", "Zenith", "Halo", "Atlas", "Echo",
  "Forge", "Glacier", "Iron", "Maple", "Phoenix", "Rune", "Saber", "Tempest",
  "Mercury", "Cobalt", "Onyx", "Ember", "Cascade", "Polaris",
];
const IPO_SUFFIX = [
  "Labs", "Dynamics", "Holdings", "Industries", "Systems", "Capital", "Group",
  "Networks", "Robotics", "Bio", "Energy", "Foods", "Motors", "Studios",
  "Pharma", "Logistics", "Materials", "Brands", "Partners", "Media",
];
const IPO_LOGOS = [
  "🚀", "⚛️", "🛰️", "🧪", "🧬", "⚙️", "🔋", "🏭", "🛞", "🛩️", "🌐", "🪙",
  "🧠", "🧊", "💊", "📡", "🪐", "🛒", "🎮", "🎬",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fmtSym(seq: number): string {
  // Squash to base-26 letters so the ticker stays a real-looking 3-letter symbol.
  const L = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let n = (seq * 1373 + 11) % (26 * 26 * 26);
  return L[Math.floor(n / 676)] + L[Math.floor((n % 676) / 26)] + L[n % 26];
}

function generateIPO(seq: number, listedAt: number): MarketAsset {
  const prefix = pick(IPO_PREFIX);
  const suffix = pick(IPO_SUFFIX);
  const sector = pick(IPO_SECTORS);
  // Volatility tuned per sector flavor; tech/crypto-ish picks land higher.
  const baseVol = sector === "tech" ? 0.025 + Math.random() * 0.025
    : sector === "energy" ? 0.020 + Math.random() * 0.020
    : sector === "auto" ? 0.020 + Math.random() * 0.025
    : sector === "metals" ? 0.012 + Math.random() * 0.012
    : 0.012 + Math.random() * 0.020;
  // Slight bias toward positive drift — most listings hope to grow.
  const drift = (Math.random() - 0.35) * 0.0014;
  // IPO prices vary; small cap to mid cap.
  const price = round2(8 + Math.random() * 240);
  const id = `ipo_${seq}`;
  const asset: MarketAsset = {
    id,
    symbol: fmtSym(seq),
    name: `${prefix} ${suffix}`,
    class: "stock",
    sector,
    price,
    volatility: round4(baseVol),
    drift: round4(drift),
    logo: pick(IPO_LOGOS),
    blurb: `Freshly listed: ${prefix} ${suffix}. ${sector.charAt(0).toUpperCase() + sector.slice(1)} sector debut at $${price}.`,
    anchor: price,
    listedAt,
  };
  return ensureHistory(asset);
}

// ---------------------------------------------------------------------------
// Tick loop
// ---------------------------------------------------------------------------

function tickOnce(m: Market): void {
  m.economy = stepEconomy(m.economy);
  m.assets = m.assets.map((a) => {
    const next = stepAsset(a, m.economy);
    const history = (a.history ?? []).slice();
    history.push(next.price);
    if (history.length > ASSET_HISTORY_MAX) {
      history.splice(0, history.length - ASSET_HISTORY_MAX);
    }
    return { ...next, history };
  });
  // Sweep bankrupt assets and replace each with a fresh IPO in the same slot.
  // The id changes — players holding the dead stock lose those shares (the
  // client sync prunes holdings whose assetId no longer exists in the market).
  for (let i = 0; i < m.assets.length; i++) {
    if (m.assets[i].bankrupt) {
      m.assets[i] = generateIPO(m.nextIpoSeq++, m.economy.tick);
    }
  }
}

export function getMarket(): { assets: MarketAsset[]; economy: EconomyState } {
  if (!g.__sharedMarket) g.__sharedMarket = init();
  const m = g.__sharedMarket;
  const now = Date.now();
  const elapsed = now - m.lastTickAt;
  const ticks = Math.min(MAX_CATCHUP_TICKS, Math.max(0, Math.floor(elapsed / TICK_MS)));
  for (let i = 0; i < ticks; i++) tickOnce(m);
  if (ticks > 0) m.lastTickAt += ticks * TICK_MS;
  return { assets: m.assets, economy: m.economy };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}
