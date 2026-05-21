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

// A workplace project the player has accepted: completes over several shifts
// for a lump-sum reward. Optional layer on top of regular shift work.
export interface ActiveProject {
  projectId: string;
  shiftsRemaining: number;
  totalShifts: number;
}

export interface PlayerCareer {
  trackId: string | null;
  levelIndex: number;
  shiftsWorked: number;
  employedSince: number | null;
  // ----- Career system v2 -----
  skills: Record<string, number>; // skillId -> accumulated skill XP
  performance: number; // 0..100 review score at current job
  morale: number; // 0..100, scales pay and gates raises
  salaryMultiplier: number; // raises stack here (starts at 1)
  shiftStreak: number; // consecutive non-failed shifts
  bestShiftStreak: number;
  totalEarned: number; // lifetime gross career income (shifts + gigs)
  shiftsTotal: number; // lifetime shifts across all jobs
  gigsCompleted: number;
  projectsCompleted: number;
  raisesNegotiated: number;
  perks: string[]; // purchased workplace perk ids
  activeProject: ActiveProject | null;
  gigCooldownTicks: number; // ticks until next gig is available
  reviewCooldownTicks: number; // ticks until next raise/review attempt
}

export type ShiftQuality = "perfect" | "good" | "ok" | "miss";

export interface ShiftMoment {
  taskId: string;
  skillId: string;
  quality: ShiftQuality;
}

export interface ShiftResult {
  trackId: string;
  title: string;
  moments: ShiftMoment[];
  score: number; // 0..1 aggregate performance this shift
  cash: number;
  reputation: number;
  performanceGain: number;
  skillXp: Record<string, number>;
  energyCost: number;
  moraleChange: number;
  promoted: boolean;
  newTitle?: string;
  projectCompleted?: { name: string; bonus: number };
}

export interface GigResult {
  gigId: string;
  name: string;
  skillId: string;
  quality: ShiftQuality;
  cash: number;
  skillXp: number;
  reputation: number;
  energyCost: number;
}

// ---------------------------------------------------------------------------
// Gambling
// ---------------------------------------------------------------------------

export type GambleGame = "coinflip" | "dice" | "slots" | "roulette" | "blackjack";

export type RouletteBet =
  | { type: "number"; number: number }
  | { type: "red" | "black" | "even" | "odd" | "low" | "high" }
  | { type: "dozen"; which: 1 | 2 | 3 }
  | { type: "column"; which: 1 | 2 | 3 };

export interface GambleOutcome {
  coin?: "heads" | "tails";
  diceRoll?: number; // 0..100
  target?: number;
  reels?: string[];
  pocket?: number; // roulette 0..36
  multiplier?: number;
}

export interface GambleResult {
  game: GambleGame;
  wager: number;
  payout: number;
  net: number;
  won: boolean;
  detail: string;
  outcome?: GambleOutcome;
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
  // Presentation / flavor (Robinhood-style detail screens).
  logo?: string; // emoji used as a stand-in for a company logo
  blurb?: string; // "About" copy on the detail screen
  dividendYield?: number; // annual % yield; pays a small trickle each tick
  popular?: boolean; // surfaces in the "Popular" list
  // Rolling price history for charts/sparklines (most-recent last).
  history?: number[];
  // Idiosyncratic trend that random-walks per asset, so names don't all move
  // together — market sentiment is shared, this is each stock's own story.
  momentum?: number;
}

export interface Holding {
  assetId: AssetId;
  quantity: number;
  avgCost: number;
}

// ---------------------------------------------------------------------------
// Brokerage layer — the Robinhood-style investing experience
// ---------------------------------------------------------------------------

export interface WatchList {
  id: string;
  name: string;
  assetIds: AssetId[];
}

// A resting buy/sell order that fills automatically when price crosses the
// trigger. "limit" buys below / sells above; "stop" is the mirror image.
export interface LimitOrder {
  id: string;
  assetId: AssetId;
  side: "buy" | "sell";
  trigger: "limit" | "stop";
  price: number; // trigger price
  shares: number;
  createdAt: number;
}

// Recurring (dollar-cost-averaging) buy, executed on a tick cadence.
export interface RecurringPlan {
  id: string;
  assetId: AssetId;
  amount: number; // dollars per cycle
  everyTicks: number;
  nextTick: number; // economy.tick at which the next buy fires
}

export interface InvestingState {
  portfolioHistory: number[]; // total investments value over time
  watchlists: WatchList[];
  orders: LimitOrder[];
  recurring: RecurringPlan[];
  gold: boolean; // Robinhood Gold subscription active
  goldSince: number | null;
  marginUsed: number; // borrowed dollars outstanding (Gold margin)
  realizedPL: number; // lifetime realized profit/loss
  dividendsEarned: number; // lifetime dividends collected
  tradeCount: number; // lifetime filled buys + sells
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
  investing: InvestingState;
  version: number;
}
