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

// Career v3: a linear chain of 100 jobs, each its own minigame. You play the
// current job's minigame to accumulate `progress`; hitting the job's goal
// unlocks the next. Income is active-only. Everything resets each life.
export interface PlayerCareer {
  jobIndex: number; // current job in the chain (0..JOB_COUNT-1)
  progress: number; // metric points accumulated toward the current job's goal
  jobsCleared: number; // goals beaten this life
  roundsPlayed: number; // total minigame rounds played this life
  totalEarned: number; // lifetime cash earned from jobs this life
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
  // Moving "anchor" price that mean reversion pulls toward. It drifts slowly
  // toward the live price each tick, so a stock that genuinely trends keeps
  // running while a brief shock still gets pulled back. No hard band.
  anchor?: number;
  // Server-set when the price collapses far enough — UI shows "Bankrupt" and
  // the asset is delisted next market tick, replaced by a fresh procedural IPO.
  bankrupt?: boolean;
  // Day the asset listed (server tick), shown as the IPO date on the detail.
  listedAt?: number;
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

// ---------------------------------------------------------------------------
// Life & mortality — time passes, the player ages, and eventually dies, which
// force-retires them (net worth → legacy credits) and begins a new life.
// ---------------------------------------------------------------------------

export interface LifeState {
  ageTicks: number; // ticks lived this life
  startAge: number; // age at the start of this life
  deathAge: number; // age this life ends at (rolled 65–100 at birth)
  generation: number; // 1-based life number
  // Set the moment the player dies so the UI can show a recap; cleared on ack.
  deathReport: { age: number; netWorth: number; credits: number } | null;
}

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
  life: LifeState;
  version: number;
}
