import type {
  BusinessType,
  CareerTrack,
  MarketAsset,
  Property,
} from "./types";

// ---------------------------------------------------------------------------
// Career tracks — the corporate ladder. Each track is a sequence of levels.
// ---------------------------------------------------------------------------

export const CAREER_TRACKS: CareerTrack[] = [
  {
    id: "service",
    name: "Service Industry",
    description: "Start at the bottom. Tips not included.",
    levels: [
      { id: "dishwasher", title: "Dishwasher", tier: 0, baseSalaryPerTick: 2, energyCostPerShift: 8, reputationRequired: 0, promoteAfterShifts: 10 },
      { id: "line-cook", title: "Line Cook", tier: 1, baseSalaryPerTick: 5, energyCostPerShift: 9, reputationRequired: 20, promoteAfterShifts: 15 },
      { id: "shift-lead", title: "Shift Lead", tier: 2, baseSalaryPerTick: 9, energyCostPerShift: 7, reputationRequired: 60, promoteAfterShifts: 20 },
      { id: "gm", title: "General Manager", tier: 3, baseSalaryPerTick: 18, energyCostPerShift: 6, reputationRequired: 150, promoteAfterShifts: 30 },
    ],
  },
  {
    id: "corporate",
    name: "Corporate",
    description: "The classic ladder. Climb or be climbed.",
    levels: [
      { id: "intern", title: "Intern", tier: 0, baseSalaryPerTick: 4, energyCostPerShift: 6, reputationRequired: 0, promoteAfterShifts: 12 },
      { id: "analyst", title: "Analyst", tier: 1, baseSalaryPerTick: 10, energyCostPerShift: 7, reputationRequired: 40, promoteAfterShifts: 18 },
      { id: "associate", title: "Associate", tier: 2, baseSalaryPerTick: 22, energyCostPerShift: 7, reputationRequired: 120, promoteAfterShifts: 25 },
      { id: "vp", title: "Vice President", tier: 3, baseSalaryPerTick: 50, energyCostPerShift: 6, reputationRequired: 300, promoteAfterShifts: 40 },
      { id: "cxo", title: "C-Suite Executive", tier: 4, baseSalaryPerTick: 120, energyCostPerShift: 5, reputationRequired: 800, promoteAfterShifts: 60 },
    ],
  },
  {
    id: "finance",
    name: "High Finance",
    description: "Risk tolerance required. Bonuses obscene.",
    levels: [
      { id: "teller", title: "Bank Teller", tier: 0, baseSalaryPerTick: 6, energyCostPerShift: 6, reputationRequired: 0, promoteAfterShifts: 12 },
      { id: "trader", title: "Junior Trader", tier: 1, baseSalaryPerTick: 16, energyCostPerShift: 8, reputationRequired: 80, promoteAfterShifts: 20 },
      { id: "pm", title: "Portfolio Manager", tier: 2, baseSalaryPerTick: 45, energyCostPerShift: 7, reputationRequired: 250, promoteAfterShifts: 35 },
      { id: "partner", title: "Managing Partner", tier: 3, baseSalaryPerTick: 140, energyCostPerShift: 5, reputationRequired: 900, promoteAfterShifts: 55 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Market assets — starting universe priced by the economy simulation.
// ---------------------------------------------------------------------------

export const BASE_ASSETS: MarketAsset[] = [
  { id: "spx", symbol: "SPX", name: "Broad Market Index", class: "index", price: 450, volatility: 0.012, drift: 0.0006, sector: "broad" },
  { id: "tech", symbol: "NXST", name: "Nexus Systems", class: "stock", price: 180, volatility: 0.03, drift: 0.001, sector: "tech" },
  { id: "auto", symbol: "VLT", name: "Volt Motors", class: "stock", price: 95, volatility: 0.04, drift: 0.0008, sector: "auto" },
  { id: "energy", symbol: "PETRO", name: "Petro Global", class: "stock", price: 60, volatility: 0.025, drift: 0.0003, sector: "energy" },
  { id: "bank", symbol: "FNB", name: "First National Bank", class: "stock", price: 48, volatility: 0.02, drift: 0.0004, sector: "finance" },
  { id: "btc", symbol: "BTC", name: "Bitcorn", class: "crypto", price: 38000, volatility: 0.07, drift: 0.0012, sector: "crypto" },
  { id: "eth", symbol: "ETH", name: "Etherium", class: "crypto", price: 2100, volatility: 0.08, drift: 0.0014, sector: "crypto" },
  { id: "gold", symbol: "XAU", name: "Gold", class: "commodity", price: 1950, volatility: 0.01, drift: 0.0002, sector: "metals" },
  { id: "oil", symbol: "WTI", name: "Crude Oil", class: "commodity", price: 78, volatility: 0.03, drift: 0.0001, sector: "energy" },
  { id: "tbond", symbol: "T10", name: "10Y Treasury", class: "bond", price: 100, volatility: 0.004, drift: 0.0001, sector: "bonds" },
];

// ---------------------------------------------------------------------------
// Real estate — purchasable properties across regions.
// ---------------------------------------------------------------------------

export const PROPERTIES: Property[] = [
  { id: "studio-dt", name: "Downtown Studio", type: "apartment", region: "Metro", baseValue: 120000, rentPerTick: 30, upkeepPerTick: 8, occupancyChance: 0.9 },
  { id: "suburb-house", name: "Suburban House", type: "house", region: "Suburbs", baseValue: 320000, rentPerTick: 70, upkeepPerTick: 18, occupancyChance: 0.85 },
  { id: "beach-condo", name: "Beachfront Condo", type: "condo", region: "Coast", baseValue: 540000, rentPerTick: 130, upkeepPerTick: 35, occupancyChance: 0.7 },
  { id: "strip-mall", name: "Strip Mall", type: "commercial", region: "Metro", baseValue: 1200000, rentPerTick: 320, upkeepPerTick: 90, occupancyChance: 0.8 },
  { id: "raw-land", name: "Raw Land Parcel", type: "land", region: "Rural", baseValue: 80000, rentPerTick: 0, upkeepPerTick: 2, occupancyChance: 0 },
  { id: "highrise", name: "High-Rise Tower", type: "commercial", region: "Metro", baseValue: 9500000, rentPerTick: 2600, upkeepPerTick: 700, occupancyChance: 0.82 },
];

// ---------------------------------------------------------------------------
// Businesses — ownable income engines that scale with upgrades.
// ---------------------------------------------------------------------------

export const BUSINESS_TYPES: BusinessType[] = [
  { id: "food-truck", name: "Food Truck", category: "Food", startupCost: 25000, baseRevenuePerTick: 60, baseCostPerTick: 35, description: "Low barrier, thin margins, long hours." },
  { id: "laundromat", name: "Laundromat", category: "Services", startupCost: 90000, baseRevenuePerTick: 110, baseCostPerTick: 45, description: "Quarters add up. Mostly passive." },
  { id: "cafe", name: "Coffee Shop", category: "Food", startupCost: 150000, baseRevenuePerTick: 180, baseCostPerTick: 90, description: "Caffeine is a reliable vice." },
  { id: "gym", name: "Fitness Gym", category: "Services", startupCost: 400000, baseRevenuePerTick: 420, baseCostPerTick: 210, description: "Sells memberships nobody uses." },
  { id: "saas", name: "SaaS Startup", category: "Tech", startupCost: 750000, baseRevenuePerTick: 900, baseCostPerTick: 500, description: "High burn, high ceiling." },
  { id: "casino", name: "Casino", category: "Gaming", startupCost: 5000000, baseRevenuePerTick: 6000, baseCostPerTick: 2800, description: "The house always wins. Now you're the house." },
];

export const TICK_MS = 1000; // one economic tick per second of active play
