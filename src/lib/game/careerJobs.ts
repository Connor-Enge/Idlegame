// Career system v3: a single linear chain of 100 jobs. Each job *is* a
// minigame; you accumulate that minigame's metric (clicks, combos, hits…) and
// when you hit the job's goal the next job unlocks. Income is active-only —
// you earn cash only by playing. Progress resets fully each life.
//
// Balance lives in the constants below — tune here first.

// Cash a competent session earns at the very first job, and how fast that
// grows per job up the ladder. Active income is the bootstrap for the rest of
// the economy (businesses, investing), so this curve sets early-game pace.
export const CAREER_CASH_BASE = 50;
export const CAREER_CASH_GROWTH = 1.085;

// ---------------------------------------------------------------------------
// Minigames — the distinct mechanics. `basePoints` is the metric a decent
// session yields; goals and cash-per-point are derived from it so every
// mechanic pays out comparably regardless of its natural scoring scale.
// ---------------------------------------------------------------------------

export interface MinigameDef {
  id: string;
  name: string;
  unit: string; // label for the metric, e.g. "clicks"
  blurb: string; // one-line how-to-play
  basePoints: number; // typical points from a competent session
}

export const MINIGAMES: MinigameDef[] = [
  // Generic archetypes — used as fallbacks for jobs without a bespoke game yet.
  { id: "clicker", name: "Rapid Tap", unit: "taps", blurb: "Tap as fast as you can before the timer runs out.", basePoints: 40 },
  { id: "timing", name: "Perfect Timing", unit: "points", blurb: "Stop the sweeping marker in the green zone, five rounds.", basePoints: 18 },
  { id: "reaction", name: "Quick Reflex", unit: "points", blurb: "Wait for green, then tap the instant it appears.", basePoints: 16 },
  { id: "memory", name: "Memory Match", unit: "points", blurb: "Repeat the growing sequence of glowing tiles.", basePoints: 14 },
  { id: "whack", name: "Target Rush", unit: "hits", blurb: "Tap the targets that pop up before they vanish.", basePoints: 22 },
  { id: "math", name: "Quick Maths", unit: "solved", blurb: "Solve as many quick sums as you can against the clock.", basePoints: 12 },

  // Bespoke, job-specific games (built one at a time, themed to the role).
  { id: "lemonade", name: "Lemonade Stand", unit: "cups", blurb: "Pour each cup to the line — hold to pour, release to serve. Overfill and it spills.", basePoints: 14 },
];

// Generic mechanics rotated through any job that doesn't have a bespoke game.
const FALLBACK_POOL = ["clicker", "timing", "reaction", "memory", "whack", "math"];

// Per-job bespoke minigame assignments (job index -> minigame id). Jobs not
// listed here fall back to the generic pool, so the chain is always playable.
const JOB_MINIGAME: Record<number, string> = {
  0: "lemonade",
};

export function minigameById(id: string): MinigameDef {
  return MINIGAMES.find((m) => m.id === id) ?? MINIGAMES[0];
}

// ---------------------------------------------------------------------------
// The 100-job ladder. Titles are a rags-to-riches arc; each is assigned a
// minigame (cycled across the implemented set) plus a derived goal and pay.
// ---------------------------------------------------------------------------

export interface Job {
  index: number;
  title: string;
  icon: string;
  minigameId: string;
  goal: number; // total metric points to clear this job & unlock the next
  cashPerPoint: number; // cash earned per metric point
}

const JOB_TITLES: Array<[string, string]> = [
  ["Lemonade Stand Kid", "🍋"], ["Paper Route", "📰"], ["Dog Walker", "🐕"], ["Lawn Mower", "🌱"],
  ["Babysitter", "🍼"], ["Car Washer", "🧽"], ["Dishwasher", "🍽️"], ["Busser", "🧹"],
  ["Fast Food Cook", "🍔"], ["Barista", "☕"], ["Cashier", "💵"], ["Stock Clerk", "📦"],
  ["Bagger", "🛍️"], ["Mall Kiosk Seller", "🛒"], ["Movie Usher", "🎬"], ["Pizza Delivery", "🍕"],
  ["Rideshare Driver", "🚗"], ["Mover", "💪"], ["Warehouse Picker", "🏭"], ["Forklift Operator", "🚜"],
  ["Line Cook", "🍳"], ["Waiter", "🍷"], ["Bartender", "🍸"], ["Barback", "🧊"],
  ["Shift Lead", "📋"], ["Assistant Manager", "🗂️"], ["Store Manager", "🏪"], ["Sales Associate", "🤝"],
  ["Telemarketer", "☎️"], ["Call Center Rep", "🎧"], ["Receptionist", "🛎️"], ["Data Entry Clerk", "⌨️"],
  ["Bank Teller", "🏦"], ["Loan Officer", "💳"], ["Insurance Agent", "📑"], ["Real Estate Agent", "🏡"],
  ["Paralegal", "⚖️"], ["Junior Accountant", "🧮"], ["Bookkeeper", "📒"], ["Office Manager", "🗃️"],
  ["HR Coordinator", "👥"], ["Recruiter", "🎯"], ["Marketing Assistant", "📣"], ["Copywriter", "✍️"],
  ["Graphic Designer", "🎨"], ["UX Designer", "🖌️"], ["QA Tester", "🐞"], ["Junior Developer", "💻"],
  ["Software Engineer", "🖥️"], ["Senior Engineer", "🧑‍💻"], ["Staff Engineer", "🛠️"], ["Engineering Lead", "👷"],
  ["Product Manager", "📱"], ["Project Manager", "📊"], ["Data Analyst", "📈"], ["Data Scientist", "🔬"],
  ["ML Engineer", "🤖"], ["DevOps Engineer", "⚙️"], ["Security Analyst", "🛡️"], ["Solutions Architect", "🏗️"],
  ["Consultant", "💼"], ["Strategy Lead", "🧭"], ["Operations Director", "🚦"], ["Regional Director", "🗺️"],
  ["VP of Sales", "📞"], ["VP of Engineering", "🔧"], ["Chief of Staff", "📎"], ["CMO", "📺"],
  ["CFO", "💰"], ["CTO", "🧠"], ["COO", "🏢"], ["CEO", "👔"],
  ["Startup Founder", "🚀"], ["Angel Investor", "😇"], ["Venture Capitalist", "💸"], ["Hedge Fund Analyst", "📉"],
  ["Portfolio Manager", "📂"], ["Investment Banker", "🏛️"], ["Managing Director", "🎩"], ["Private Equity Partner", "🤵"],
  ["Fund Founder", "🏦"], ["Real Estate Mogul", "🏙️"], ["Media Mogul", "🎙️"], ["Tech Mogul", "📡"],
  ["Industrialist", "🏭"], ["Oil Baron", "🛢️"], ["Shipping Magnate", "🚢"], ["Airline Owner", "✈️"],
  ["Sports Team Owner", "🏟️"], ["Billionaire", "💎"], ["Philanthropist", "🕊️"], ["Space Tourist", "🛰️"],
  ["Rocket Company CEO", "🛸"], ["Mars Colonist", "🪐"], ["Asteroid Miner", "☄️"], ["Megacorp Chairman", "🏯"],
  ["World Bank Governor", "🌍"], ["Trillionaire", "🤯"], ["Galactic Trade Lord", "🌌"], ["Universe Owner", "👑"],
];

function buildJobs(): Job[] {
  return JOB_TITLES.map(([title, icon], index) => {
    const mgId = JOB_MINIGAME[index] ?? FALLBACK_POOL[index % FALLBACK_POOL.length];
    const mg = minigameById(mgId);
    // Sessions-to-clear grows gently from 3 (early) to ~12 (late game).
    const sessions = 3 + Math.floor(index / 10);
    const goal = Math.round(mg.basePoints * sessions);
    // A good session pays roughly this much, regardless of the mechanic's scale.
    const sessionCash = CAREER_CASH_BASE * Math.pow(CAREER_CASH_GROWTH, index);
    const cashPerPoint = sessionCash / mg.basePoints;
    return { index, title, icon, minigameId: mg.id, goal, cashPerPoint };
  });
}

export const JOBS: Job[] = buildJobs();
export const JOB_COUNT = JOBS.length;

export function jobByIndex(i: number): Job {
  return JOBS[Math.max(0, Math.min(JOB_COUNT - 1, i))];
}

// Progression XP granted for a single round, scaling with how far up you are.
export function careerRoundXp(job: Job): number {
  return Math.min(45, 4 + job.index * 0.42);
}
