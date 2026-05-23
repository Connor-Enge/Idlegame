import type {
  BusinessType,
  EducationProgram,
  FeatureFlag,
  MarketAsset,
  Property,
} from "./types";

export const TICK_MS = 1000; // one economic tick per second of active play

// ---------------------------------------------------------------------------
// Progression tuning. These constants are the main knobs for pacing the
// ~100h curve: raise growth bases to lengthen it, lower them to shorten it.
// ---------------------------------------------------------------------------

export const XP_BASE = 80;
export const XP_GROWTH = 1.16; // xp to reach next level multiplies by this

// ---------------------------------------------------------------------------
// Global economy pacing — income-rate scalars. These damp how fast each
// income channel pays out (1 = original, lower = slower) WITHOUT removing any
// income stream: every job, gig, business, rental and dividend still works,
// just at a calmer rate so wealth compounds over ~30-50h and across lives
// (via Legacy Points) instead of within a single ~5-8h life. Tune here first.
// ---------------------------------------------------------------------------
export const RENT_SCALE = 0.25; // net rent from property
export const BIZ_PROFIT_SCALE = 0.12; // net business profit per tick

// Net-worth thresholds that permanently unlock each system, in order. These
// gates pace access: the wealth engines (business, real estate) sit high
// enough that a first life lives mostly off jobs + a small brokerage, and you
// grow into the engines across lives via Legacy Points.
export const FEATURE_UNLOCKS: { flag: FeatureFlag; netWorth: number; label: string }[] = [
  { flag: "invest", netWorth: 5_000, label: "Brokerage access" },
  { flag: "business", netWorth: 250_000, label: "Business registration" },
  { flag: "realestate", netWorth: 1_000_000, label: "Property market access" },
];

// Prestige: retire to convert net worth into permanent Legacy Points.
export const RETIRE_THRESHOLD = 5_000_000;
export const LEGACY_INCOME_BONUS = 0.02; // +2% global income per legacy point

// ---------------------------------------------------------------------------
// Brokerage tuning (the Robinhood layer)
// ---------------------------------------------------------------------------

export const ASSET_HISTORY_MAX = 160; // chart points kept per asset
export const PORTFOLIO_HISTORY_MAX = 240; // portfolio-value chart points

// Robinhood Gold — a subscription that pays interest on idle cash, unlocks
// margin (borrowing), and charges a small per-tick fee.
export const GOLD_FEE_PER_TICK = 1.5; // subscription cost per tick
// Ticks run ~1/second, so these are intentionally tiny — at the old daily-rate
// values, idle cash on Gold tripled in 8h (a money printer). Now ~+9%/8h.
export const GOLD_CASH_APY_PER_TICK = 0.000003; // interest paid on idle cash
export const MARGIN_RATE_PER_TICK = 0.000006; // interest charged on borrowed $
export const MARGIN_MULTIPLIER = 1; // borrow up to 1x your holdings value

// Dividends: yield is an annual %, paid as a small trickle every tick.
export const DIVIDEND_PER_TICK_FACTOR = 0.0005;

// ---------------------------------------------------------------------------
// Education — the keys that gate prestigious careers and advanced systems.
// Studying costs money up front and a real-time study timer (studyTicks).
// ---------------------------------------------------------------------------

export const EDUCATION: EducationProgram[] = [
  {
    id: "hs",
    name: "High School Diploma",
    short: "HS",
    description: "The bare minimum. Opens retail and office work.",
    cost: 0,
    levelRequired: 1,
    studyTicks: 25,
    requires: [],
  },
  {
    id: "trade",
    name: "Trade Certification",
    short: "Trade",
    description: "Hands-on credential for skilled, well-paid trades.",
    cost: 3_000,
    levelRequired: 3,
    studyTicks: 60,
    requires: [],
  },
  {
    id: "degree",
    name: "College Degree",
    short: "BA/BS",
    description: "Unlocks the corporate and tech ladders.",
    cost: 30_000,
    levelRequired: 6,
    studyTicks: 150,
    requires: ["hs"],
  },
  {
    id: "re-license",
    name: "Real Estate License",
    short: "RE Lic.",
    description: "Required to buy commercial property; cuts closing costs.",
    cost: 50_000,
    levelRequired: 8,
    studyTicks: 110,
    requires: ["hs"],
  },
  {
    id: "series7",
    name: "Finance License",
    short: "Series 7",
    description: "Unlocks high finance careers and derivatives trading.",
    cost: 120_000,
    levelRequired: 10,
    studyTicks: 200,
    requires: ["degree"],
  },
  {
    id: "mba",
    name: "MBA",
    short: "MBA",
    description: "Fast-tracks executive tiers and boosts business margins.",
    cost: 250_000,
    levelRequired: 12,
    studyTicks: 260,
    requires: ["degree"],
  },
  {
    id: "phd",
    name: "PhD",
    short: "PhD",
    description: "Elite research credential. Opens the highest tech roles.",
    cost: 1_000_000,
    levelRequired: 18,
    studyTicks: 420,
    requires: ["mba"],
  },
];

// ---------------------------------------------------------------------------
// Market assets — advanced instruments revealed by level / credential.
// ---------------------------------------------------------------------------

export const BASE_ASSETS: MarketAsset[] = [
  // --- Available from the start (no unlock level) ---
  { id: "spx", symbol: "SPY", name: "Broad Market Index", class: "index", price: 450, volatility: 0.012, drift: 0.0006, sector: "broad", logo: "🧺", dividendYield: 1.4, popular: true, blurb: "A basket tracking the 500 largest public companies. The market's heartbeat — boring, diversified, and the bedrock of most portfolios." },
  { id: "tbond", symbol: "T10", name: "10-Year Treasury", class: "bond", price: 100, volatility: 0.004, drift: 0.0001, sector: "bonds", logo: "🏛️", dividendYield: 4.2, blurb: "Government debt. Low drama, steady coupon. Gets cheaper when interest rates climb." },
  { id: "bank", symbol: "FNB", name: "First National Bank", class: "stock", price: 48, volatility: 0.02, drift: 0.0004, sector: "finance", logo: "🏦", dividendYield: 3.1, popular: true, blurb: "A big retail bank. Profits swing with interest rates and the credit cycle." },
  { id: "energy", symbol: "PETRO", name: "Petro Global", class: "stock", price: 60, volatility: 0.025, drift: 0.0003, sector: "energy", logo: "🛢️", dividendYield: 4.8, blurb: "Integrated oil & gas major. Cash gusher when crude is high; pays a fat dividend." },
  { id: "snack", symbol: "MUNCH", name: "Munchies Co.", class: "stock", price: 72, volatility: 0.014, drift: 0.0004, sector: "consumer", logo: "🍿", dividendYield: 2.6, popular: true, blurb: "Packaged snacks and sodas. Recession-resistant — people eat in good times and bad." },
  // --- Revealed as the player levels up ---
  { id: "auto", symbol: "VLT", name: "Volt Motors", class: "stock", price: 95, volatility: 0.04, drift: 0.0008, sector: "auto", logo: "🚗", popular: true, unlockLevel: 3, blurb: "The electric-vehicle darling. Cult following, wild swings, and a CEO who tweets too much." },
  { id: "tech", symbol: "NXST", name: "Nexus Systems", class: "stock", price: 180, volatility: 0.03, drift: 0.001, sector: "tech", logo: "💻", popular: true, unlockLevel: 4, blurb: "Cloud and AI infrastructure giant. The market's favorite growth engine." },
  { id: "social", symbol: "BUZZ", name: "Buzzfeed Social", class: "stock", price: 34, volatility: 0.05, drift: 0.0009, sector: "tech", logo: "📱", unlockLevel: 5, blurb: "Ad-funded social network. Lives and dies by daily active users and the outrage cycle." },
  { id: "pharma", symbol: "RXLF", name: "Relief Pharma", class: "stock", price: 130, volatility: 0.028, drift: 0.0005, sector: "health", logo: "💊", dividendYield: 2.2, unlockLevel: 5, blurb: "Drug maker with a pipeline of blockbusters. Headlines move on trial results." },
  { id: "gold", symbol: "XAU", name: "Gold", class: "commodity", price: 1950, volatility: 0.01, drift: 0.0002, sector: "metals", logo: "🥇", unlockLevel: 6, blurb: "The classic safe haven. Shines when everyone else is panicking." },
  { id: "oil", symbol: "WTI", name: "Crude Oil", class: "commodity", price: 78, volatility: 0.03, drift: 0.0001, sector: "energy", logo: "🛢️", unlockLevel: 7, blurb: "A barrel of light sweet crude. Geopolitics in a price chart." },
  { id: "meme", symbol: "GME", name: "GameStonk", class: "stock", price: 22, volatility: 0.035, drift: 0.0006, sector: "consumer", logo: "🚀", popular: true, unlockLevel: 8, blurb: "The original meme stock. Fundamentals optional; vibes mandatory. 🦍💎🙌" },
  { id: "btc", symbol: "BTC", name: "Bitcorn", class: "crypto", price: 38000, volatility: 0.028, drift: 0.0012, sector: "crypto", logo: "₿", popular: true, unlockLevel: 9, blurb: "Digital gold. Trades 24/7 and doesn't care about your bedtime." },
  { id: "etf-tech", symbol: "QQQ", name: "Tech 100 Fund", class: "index", price: 380, volatility: 0.02, drift: 0.0009, sector: "tech", logo: "📊", dividendYield: 0.6, unlockLevel: 10, blurb: "An index of the 100 biggest non-financial names. Tech-heavy growth in one ticker." },
  { id: "eth", symbol: "ETH", name: "Etherium", class: "crypto", price: 2100, volatility: 0.032, drift: 0.0014, sector: "crypto", logo: "Ξ", unlockLevel: 11, blurb: "The smart-contract platform. Powers most of the on-chain casino." },
  { id: "doge", symbol: "DOGE", name: "Dogecorn", class: "crypto", price: 0.12, volatility: 0.042, drift: 0.0008, sector: "crypto", logo: "🐕", unlockLevel: 12, blurb: "A joke that refused to die. Pure sentiment, much volatility, very risk." },
  { id: "lev3x", symbol: "BULL3X", name: "3x Leveraged Fund", class: "index", price: 240, volatility: 0.04, drift: 0.0009, sector: "broad", logo: "⚡", unlockLevel: 14, requiresCredential: "series7", blurb: "Triple-leveraged daily returns. Amplifies the upside — and decays brutally in chop. Not a buy-and-hold." },
];

// ---------------------------------------------------------------------------
// Real estate — commercial requires a real-estate license.
// ---------------------------------------------------------------------------

export const PROPERTIES: Property[] = [
  { id: "studio-dt", name: "Downtown Studio", type: "apartment", region: "Metro", baseValue: 120_000, rentPerTick: 30, upkeepPerTick: 8, occupancyChance: 0.9 },
  { id: "suburb-house", name: "Suburban House", type: "house", region: "Suburbs", baseValue: 320_000, rentPerTick: 70, upkeepPerTick: 18, occupancyChance: 0.85 },
  { id: "raw-land", name: "Raw Land Parcel", type: "land", region: "Rural", baseValue: 80_000, rentPerTick: 0, upkeepPerTick: 2, occupancyChance: 0 },
  { id: "beach-condo", name: "Beachfront Condo", type: "condo", region: "Coast", baseValue: 540_000, rentPerTick: 130, upkeepPerTick: 35, occupancyChance: 0.7 },
  { id: "strip-mall", name: "Strip Mall", type: "commercial", region: "Metro", baseValue: 1_200_000, rentPerTick: 320, upkeepPerTick: 90, occupancyChance: 0.8, requiresCredential: "re-license" },
  { id: "apt-block", name: "Apartment Block", type: "commercial", region: "Metro", baseValue: 4_200_000, rentPerTick: 1_150, upkeepPerTick: 320, occupancyChance: 0.85, requiresCredential: "re-license" },
  { id: "highrise", name: "High-Rise Tower", type: "commercial", region: "Metro", baseValue: 9_500_000, rentPerTick: 2_600, upkeepPerTick: 700, occupancyChance: 0.82, requiresCredential: "re-license" },
  { id: "resort", name: "Island Resort", type: "commercial", region: "Coast", baseValue: 28_000_000, rentPerTick: 8_200, upkeepPerTick: 2_400, occupancyChance: 0.78, requiresCredential: "re-license" },
];

// ---------------------------------------------------------------------------
// Businesses — ownable income engines, revealed by level.
// ---------------------------------------------------------------------------

export const BUSINESS_TYPES: BusinessType[] = [
  { id: "food-truck", name: "Food Truck", category: "Food", startupCost: 25_000, baseRevenuePerTick: 60, baseCostPerTick: 35, description: "Low barrier, thin margins, long hours.", unlockLevel: 1 },
  { id: "laundromat", name: "Laundromat", category: "Services", startupCost: 90_000, baseRevenuePerTick: 110, baseCostPerTick: 45, description: "Quarters add up. Mostly passive.", unlockLevel: 4 },
  { id: "cafe", name: "Coffee Shop", category: "Food", startupCost: 150_000, baseRevenuePerTick: 180, baseCostPerTick: 90, description: "Caffeine is a reliable vice.", unlockLevel: 6 },
  { id: "gym", name: "Fitness Gym", category: "Services", startupCost: 400_000, baseRevenuePerTick: 420, baseCostPerTick: 210, description: "Sells memberships nobody uses.", unlockLevel: 9 },
  { id: "saas", name: "SaaS Startup", category: "Tech", startupCost: 750_000, baseRevenuePerTick: 900, baseCostPerTick: 500, description: "High burn, high ceiling.", unlockLevel: 12 },
  { id: "casino", name: "Casino", category: "Gaming", startupCost: 5_000_000, baseRevenuePerTick: 6_000, baseCostPerTick: 2_800, description: "The house always wins. Now you're the house.", unlockLevel: 16 },
  { id: "conglomerate", name: "Conglomerate", category: "Holding", startupCost: 50_000_000, baseRevenuePerTick: 55_000, baseCostPerTick: 24_000, description: "Own a little of everything.", unlockLevel: 22 },
];
