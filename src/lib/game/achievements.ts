import { CAREER_TRACKS } from "./data";
import type { Achievement, GameState } from "./types";

function topTier(state: GameState): number {
  const track = CAREER_TRACKS.find((t) => t.id === state.career.trackId);
  return track ? track.levels[state.career.levelIndex].tier : -1;
}

// Goals span the whole arc, from first paycheck to multi-retirement tycoon.
// Rewards are deliberately small relative to the milestone — flavor, not a
// shortcut. Ordering here is the display order on the Goals screen.
export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-job", name: "On the Payroll", description: "Get your first job.", icon: "💼", tier: "bronze", check: (s) => s.career.trackId != null, reward: { cash: 200 } },
  { id: "first-bet", name: "Beginner's Luck", description: "Build any luck at the casino.", icon: "🍀", tier: "bronze", check: (s) => s.stats.luck > 0, reward: { luck: 2 } },
  { id: "hs-grad", name: "Graduate", description: "Earn a High School Diploma.", icon: "🎓", tier: "bronze", check: (s) => s.progression.credentials.includes("hs"), reward: { cash: 500 } },
  { id: "investor", name: "Investor", description: "Open your first market position.", icon: "📈", tier: "bronze", check: (s) => s.holdings.length > 0, reward: { cash: 500 } },
  { id: "ten-k", name: "Five Figures", description: "Reach $10,000 net worth.", icon: "💵", tier: "bronze", check: (s) => s.stats.netWorth >= 10_000 },

  { id: "degree", name: "Higher Education", description: "Earn a College Degree.", icon: "🏛️", tier: "silver", check: (s) => s.progression.credentials.includes("degree"), reward: { cash: 5_000 } },
  { id: "entrepreneur", name: "Entrepreneur", description: "Found your first business.", icon: "🏢", tier: "silver", check: (s) => s.businesses.length > 0, reward: { cash: 2_000 } },
  { id: "landlord", name: "Landlord", description: "Buy your first property.", icon: "🏠", tier: "silver", check: (s) => s.properties.length > 0, reward: { cash: 2_000 } },
  { id: "level-10", name: "Seasoned", description: "Reach level 10.", icon: "⭐", tier: "silver", check: (s) => s.progression.level >= 10, reward: { luck: 5 } },
  { id: "hundred-k", name: "Six Figures", description: "Reach $100,000 net worth.", icon: "💰", tier: "silver", check: (s) => s.stats.netWorth >= 100_000 },
  { id: "diversified", name: "Diversified", description: "Hold 5 different assets.", icon: "🧺", tier: "silver", check: (s) => s.holdings.length >= 5 },

  { id: "executive", name: "Corner Office", description: "Reach a tier-4 career role.", icon: "🕴️", tier: "gold", check: (s) => topTier(s) >= 4, reward: { cash: 25_000 } },
  { id: "mogul", name: "Property Mogul", description: "Own 5 properties.", icon: "🏘️", tier: "gold", check: (s) => s.properties.length >= 5, reward: { cash: 50_000 } },
  { id: "millionaire", name: "Millionaire", description: "Reach $1,000,000 net worth.", icon: "🤑", tier: "gold", check: (s) => s.stats.netWorth >= 1_000_000 },
  { id: "scholar", name: "Overqualified", description: "Earn 4 credentials.", icon: "📚", tier: "gold", check: (s) => s.progression.credentials.length >= 4, reward: { luck: 10 } },
  { id: "level-25", name: "Veteran", description: "Reach level 25.", icon: "🌟", tier: "gold", check: (s) => s.progression.level >= 25, reward: { luck: 10 } },

  { id: "casino-owner", name: "The House", description: "Own a Casino.", icon: "🎰", tier: "legendary", check: (s) => s.businesses.some((b) => b.businessId === "casino") },
  { id: "ten-mil", name: "Empire", description: "Reach $10,000,000 net worth.", icon: "🏝️", tier: "legendary", check: (s) => s.stats.netWorth >= 10_000_000 },
  { id: "retired", name: "Reinvented", description: "Retire and reinvest at least once.", icon: "✨", tier: "legendary", check: (s) => s.progression.retirements >= 1, reward: { legacy: 5 } },
  { id: "tycoon", name: "Tycoon", description: "Accumulate 50 Legacy Points.", icon: "👑", tier: "legendary", check: (s) => s.progression.legacyPoints >= 50 },
];

export const TIER_COLOR: Record<Achievement["tier"], string> = {
  bronze: "text-amber-600",
  silver: "text-slate-300",
  gold: "text-yellow-400",
  legendary: "text-fuchsia-400",
};

// Evaluate all achievements against state, unlock newly-met ones, apply their
// rewards, and return the freshly unlocked definitions (for toasts). Mutates.
export function evaluateAchievements(state: GameState): Achievement[] {
  const unlocked = state.progression.achievements;
  const newly: Achievement[] = [];
  for (const ach of ACHIEVEMENTS) {
    if (unlocked.includes(ach.id)) continue;
    if (!ach.check(state)) continue;
    unlocked.push(ach.id);
    if (ach.reward) {
      if (ach.reward.cash) state.stats.cash += ach.reward.cash;
      if (ach.reward.luck) state.stats.luck += ach.reward.luck;
      if (ach.reward.legacy) state.progression.legacyPoints += ach.reward.legacy;
    }
    newly.push(ach);
  }
  return newly;
}
