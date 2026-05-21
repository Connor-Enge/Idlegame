// Core domain types for Gambler's Paradise.
// Money is stored as a number of whole "dollars" for scaffold simplicity.
// (Swap to bigint / cents before doing anything money-critical.)

export type AssetId = string;

export interface PlayerStats {
  cash: number;
  netWorth: number;
  // Soft skills that gate jobs / unlock content.
  reputation: number;
  energy: number;
  maxEnergy: number;
  luck: number; // nudges gambling odds within a small band
  createdAt: number;
  lastTick: number;
}

// ---------------------------------------------------------------------------
// Jobs & Career (corporate ladder)
// ---------------------------------------------------------------------------

export interface JobLevel {
  id: string;
  title: string;
  tier: number; // position in the ladder, 0 = entry
  baseSalaryPerTick: number; // passive income while employed
  energyCostPerShift: number;
  reputationRequired: number;
  promoteAfterShifts: number; // shifts worked before promotion is offered
}

export interface TrackRequirement {
  credentials?: string[]; // education ids that must be owned
  level?: number; // minimum player level
  reputation?: number; // minimum reputation
}

export interface CareerTrack {
  id: string;
  name: string;
  description: string;
  prestigeRank: number; // ordering for display: higher = more prestigious
  requires?: TrackRequirement;
  levels: JobLevel[];
}

// ---------------------------------------------------------------------------
// Progression — player level, education and prestige
// ---------------------------------------------------------------------------

export interface EducationProgram {
  id: string;
  name: string;
  short: string;
  description: string;
  cost: number;
  levelRequired: number;
  studyTicks: number; // real ticks of study to complete
  requires: string[]; // prerequisite education ids
}

export type FeatureFlag = "invest" | "business" | "realestate";

export interface Progression {
  level: number;
  xp: number;
  credentials: string[]; // earned education ids
  studyingId: string | null;
  studyTicksRemaining: number;
  unlocks: FeatureFlag[]; // sticky feature unlocks
  legacyPoints: number; // permanent prestige currency
  retirements: number;
  achievements: string[]; // unlocked achievement ids
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: "bronze" | "silver" | "gold" | "legendary";
  check: (state: GameState) => boolean;
  reward?: { cash?: number; luck?: number; legacy?: number };
}

export interface OfflineReport {
  ticks: number;
  cash: number;
  netWorth: number;
  xp: number;
  levels: number;
}

export interface PlayerCareer {
  trackId: string | null;
  levelIndex: number;
  shiftsWorked: number;
  employedSince: number | null;
}

// ---------------------------------------------------------------------------
// Gambling
// ---------------------------------------------------------------------------

export type GambleGame = "coinflip" | "dice" | "slots" | "roulette" | "blackjack";

export interface GambleResult {
  game: GambleGame;
  wager: number;
  payout: number;
  net: number;
  won: boolean;
  detail: string;
}

// ---------------------------------------------------------------------------
// Investing — assets priced by the simulated economy
// ---------------------------------------------------------------------------

export type AssetClass = "stock" | "crypto" | "commodity" | "bond" | "index";

export interface MarketAsset {
  id: AssetId;
  symbol: string;
  name: string;
  class: AssetClass;
  price: number;
  // Simulation parameters.
  volatility: number; // 0..1 daily-ish stdev
  drift: number; // long-run trend per tick
  sector: string;
  unlockLevel?: number; // hidden until the player reaches this level
  requiresCredential?: string; // e.g. derivatives gated behind a license
}

export interface Holding {
  assetId: AssetId;
  quantity: number;
  avgCost: number;
}

// ---------------------------------------------------------------------------
// Real estate
// ---------------------------------------------------------------------------

export interface Property {
  id: string;
  name: string;
  type: "apartment" | "house" | "condo" | "commercial" | "land";
  region: string;
  baseValue: number;
  rentPerTick: number;
  upkeepPerTick: number;
  occupancyChance: number; // 0..1 chance tenant is paying each tick
  requiresCredential?: string; // e.g. commercial needs a real-estate license
}

export interface OwnedProperty {
  propertyId: string;
  purchasePrice: number;
  currentValue: number;
  rented: boolean;
  mortgageRemaining: number;
}

// ---------------------------------------------------------------------------
// Business ownership
// ---------------------------------------------------------------------------

export interface BusinessType {
  id: string;
  name: string;
  category: string;
  startupCost: number;
  baseRevenuePerTick: number;
  baseCostPerTick: number;
  description: string;
  unlockLevel?: number; // hidden until the player reaches this level
}

export interface OwnedBusiness {
  businessId: string;
  level: number; // upgrades scale revenue
  employees: number;
  marketingLevel: number;
  foundedAt: number;
}

// ---------------------------------------------------------------------------
// Global economy
// ---------------------------------------------------------------------------

export type EconomyPhase = "boom" | "expansion" | "peak" | "recession" | "depression" | "recovery";

export interface EconomyState {
  phase: EconomyPhase;
  // Macro indicators that feed asset pricing, rent and business margins.
  gdpGrowth: number;
  inflation: number;
  interestRate: number;
  unemployment: number;
  marketSentiment: number; // -1..1
  tick: number;
  activeEvents: EconomyEvent[];
}

export interface EconomyEvent {
  id: string;
  title: string;
  description: string;
  ticksRemaining: number;
  // Multiplicative / additive nudges applied while active.
  effects: {
    sentiment?: number;
    inflation?: number;
    interestRate?: number;
    sectorBoost?: { sector: string; multiplier: number };
  };
}

// ---------------------------------------------------------------------------
// Aggregate save state
// ---------------------------------------------------------------------------

export interface GameState {
  playerId: string;
  stats: PlayerStats;
  progression: Progression;
  career: PlayerCareer;
  holdings: Holding[];
  properties: OwnedProperty[];
  businesses: OwnedBusiness[];
  economy: EconomyState;
  assets: MarketAsset[];
  version: number;
}
