// Shared market — the single source of truth for prices, economy phase, and
// price history that every player polls (see /api/market). State is persisted
// in the `market` table (one row, id = "global") so multi-instance / multi-
// region deployments all read & write the same snapshot. Without that, each
// serverless instance has its own in-memory copy and players hitting
// different instances see different prices.
//
// The market is fully procedural and unbounded: prices have no min/max cap.
// A stock can run for a long time, or grind down. When a stock's price
// collapses far enough it's declared bankrupt, delisted, and replaced in the
// same slot by a freshly-generated IPO with a new id/symbol/sector/etc.

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/ensure";
import { market as marketTable } from "@/lib/db/schema";
import { ASSET_HISTORY_MAX, BASE_ASSETS } from "@/lib/game/data";
import { initialEconomy, stepAsset, stepEconomy } from "@/lib/game/economy";
import { ensureHistory } from "@/lib/game/investing";
import type { EconomyState, MarketAsset } from "@/lib/game/types";

const TICK_MS = 1000;
// Cap how many ticks we'll catch up in a single request — if the process has
// been idle for hours we don't want one call to chew CPU replaying every tick.
const MAX_CATCHUP_TICKS = 600;

interface Market {
  assets: MarketAsset[];
  economy: EconomyState;
  lastTickAt: number;
  nextIpoSeq: number;
}

const MARKET_KEY = "global";

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
  const n = (seq * 1373 + 11) % (26 * 26 * 26);
  return L[Math.floor(n / 676)] + L[Math.floor((n % 676) / 26)] + L[n % 26];
}

function generateIPO(seq: number, listedAt: number): MarketAsset {
  const prefix = pick(IPO_PREFIX);
  const suffix = pick(IPO_SUFFIX);
  const sector = pick(IPO_SECTORS);
  // Volatility tuned per sector flavor; tech / auto picks land higher.
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
  return ensureHistory({
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
  });
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

// ---------------------------------------------------------------------------
// Persistence: the live state lives in the `market` table, one row keyed
// "global". The Neon HTTP driver doesn't support multi-statement transactions
// or row locks (it issues each query as a single HTTP call), so we just do
// read → advance → upsert. Two concurrent requests can race, but they'll both
// compute roughly the same advancement and last-writer-wins keeps the row
// converging on the correct state.
// ---------------------------------------------------------------------------

export async function getMarket(): Promise<{ assets: MarketAsset[]; economy: EconomyState }> {
  await ensureSchema();
  const rows = await db
    .select()
    .from(marketTable)
    .where(eq(marketTable.id, MARKET_KEY))
    .limit(1);
  let m: Market;
  if (rows.length === 0) {
    m = init();
    // ON CONFLICT DO NOTHING so a parallel initializer doesn't race-fail us.
    await db
      .insert(marketTable)
      .values({ id: MARKET_KEY, data: m as unknown as object })
      .onConflictDoNothing();
  } else {
    m = rows[0].data as unknown as Market;
  }
  const now = Date.now();
  const elapsed = now - m.lastTickAt;
  const ticks = Math.min(MAX_CATCHUP_TICKS, Math.max(0, Math.floor(elapsed / TICK_MS)));
  for (let i = 0; i < ticks; i++) tickOnce(m);
  if (ticks > 0) {
    m.lastTickAt += ticks * TICK_MS;
    await db
      .update(marketTable)
      .set({ data: m as unknown as object, updatedAt: sql`now()` })
      .where(eq(marketTable.id, MARKET_KEY));
  }
  return { assets: m.assets, economy: m.economy };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}
