import type { Achievement, GameState } from "./types";

// Goals span the whole arc, from first paycheck to multi-retirement tycoon.
// Rewards are deliberately small relative to the milestone — flavor, not a
// shortcut. Ordering here is the display order on the Goals screen.
export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-job", name: "On the Payroll", description: "Clear your first job's goal.", icon: "💼", tier: "bronze", check: (s) => (s.career.jobsCleared ?? 0) >= 1, reward: { cash: 200 } },
  { id: "first-bet", name: "Beginner's Luck", description: "Build any luck at the casino.", icon: "🍀", tier: "bronze", check: (s) => s.stats.luck > 0, reward: { luck: 2 } },
  { id: "hs-grad", name: "Graduate", description: "Earn a High School Diploma.", icon: "🎓", tier: "bronze", check: (s) => s.progression.credentials.includes("hs"), reward: { cash: 500 } },
  { id: "investor", name: "Investor", description: "Open your first market position.", icon: "📈", tier: "bronze", check: (s) => s.holdings.length > 0, reward: { cash: 500 } },
  { id: "ten-k", name: "Five Figures", description: "Reach $10,000 net worth.", icon: "💵", tier: "bronze", check: (s) => s.stats.netWorth >= 10_000 },

  { id: "first-gig", name: "Climbing", description: "Reach your 5th job.", icon: "🪜", tier: "bronze", check: (s) => (s.career.jobIndex ?? 0) >= 4, reward: { cash: 150 } },
  { id: "first-shift", name: "Clocked In", description: "Play 10 minigame rounds.", icon: "⏰", tier: "bronze", check: (s) => (s.career.roundsPlayed ?? 0) >= 10 },

  { id: "degree", name: "Higher Education", description: "Earn a College Degree.", icon: "🏛️", tier: "silver", check: (s) => s.progression.credentials.includes("degree"), reward: { cash: 5_000 } },
  { id: "skilled", name: "Career Track", description: "Reach job 10 on the ladder.", icon: "🎯", tier: "silver", check: (s) => (s.career.jobIndex ?? 0) >= 9, reward: { cash: 3_000 } },
  { id: "first-raise", name: "Worth More", description: "Clear 10 job goals.", icon: "🤝", tier: "silver", check: (s) => (s.career.jobsCleared ?? 0) >= 10, reward: { cash: 2_000 } },
  { id: "project-done", name: "Grinder", description: "Play 100 minigame rounds.", icon: "📦", tier: "silver", check: (s) => (s.career.roundsPlayed ?? 0) >= 100, reward: { cash: 4_000 } },
  { id: "entrepreneur", name: "Entrepreneur", description: "Found your first business.", icon: "🏢", tier: "silver", check: (s) => s.businesses.length > 0, reward: { cash: 2_000 } },
  { id: "landlord", name: "Landlord", description: "Buy your first property.", icon: "🏠", tier: "silver", check: (s) => s.properties.length > 0, reward: { cash: 2_000 } },
  { id: "level-10", name: "Seasoned", description: "Reach level 10.", icon: "⭐", tier: "silver", check: (s) => s.progression.level >= 10, reward: { luck: 5 } },
  { id: "hundred-k", name: "Six Figures", description: "Reach $100,000 net worth.", icon: "💰", tier: "silver", check: (s) => s.stats.netWorth >= 100_000 },
  { id: "diversified", name: "Diversified", description: "Hold 5 different assets.", icon: "🧺", tier: "silver", check: (s) => s.holdings.length >= 5 },
  { id: "day-trader", name: "Day Trader", description: "Make 25 trades.", icon: "📲", tier: "silver", check: (s) => (s.investing?.tradeCount ?? 0) >= 25, reward: { cash: 1_000 } },
  { id: "gold-member", name: "Gold Member", description: "Subscribe to Robinhood Gold.", icon: "✨", tier: "silver", check: (s) => Boolean(s.investing?.gold), reward: { luck: 3 } },
  { id: "dividend-investor", name: "Living Off Dividends", description: "Collect $5,000 in dividends.", icon: "💸", tier: "gold", check: (s) => (s.investing?.dividendsEarned ?? 0) >= 5_000, reward: { cash: 5_000 } },

  { id: "executive", name: "Corner Office", description: "Reach job 35 on the ladder.", icon: "🕴️", tier: "gold", check: (s) => (s.career.jobIndex ?? 0) >= 34, reward: { cash: 25_000 } },
  { id: "expert", name: "Top of the Ladder", description: "Reach job 70 on the ladder.", icon: "🏆", tier: "gold", check: (s) => (s.career.jobIndex ?? 0) >= 69, reward: { cash: 100_000 } },
  { id: "gig-grind", name: "Lifer", description: "Play 500 minigame rounds.", icon: "💪", tier: "gold", check: (s) => (s.career.roundsPlayed ?? 0) >= 500, reward: { luck: 5 } },
  { id: "mogul", name: "Property Mogul", description: "Own 5 properties.", icon: "🏘️", tier: "gold", check: (s) => s.properties.length >= 5, reward: { cash: 50_000 } },
  { id: "millionaire", name: "Millionaire", description: "Reach $1,000,000 net worth.", icon: "🤑", tier: "gold", check: (s) => s.stats.netWorth >= 1_000_000 },
  { id: "scholar", name: "Overqualified", description: "Earn 4 credentials.", icon: "📚", tier: "gold", check: (s) => s.progression.credentials.length >= 4, reward: { luck: 10 } },
  { id: "level-25", name: "Veteran", description: "Reach level 25.", icon: "🌟", tier: "gold", check: (s) => s.progression.level >= 25, reward: { luck: 10 } },

  { id: "casino-owner", name: "The House", description: "Own a Casino.", icon: "🎰", tier: "legendary", check: (s) => s.businesses.some((b) => b.businessId === "casino") },
  { id: "ten-mil", name: "Empire", description: "Reach $10,000,000 net worth.", icon: "🏝️", tier: "legendary", check: (s) => s.stats.netWorth >= 10_000_000 },
  { id: "retired", name: "Reinvented", description: "Retire and reinvest at least once.", icon: "✨", tier: "legendary", check: (s) => s.progression.retirements >= 1, reward: { legacy: 5 } },
  { id: "tycoon", name: "Tycoon", description: "Accumulate 50 Legacy Points.", icon: "👑", tier: "legendary", check: (s) => s.progression.legacyPoints >= 50 },
  { id: "universe-owner", name: "Universe Owner", description: "Reach the final job on the ladder.", icon: "🌌", tier: "legendary", check: (s) => (s.career.jobIndex ?? 0) >= 99, reward: { legacy: 10 } },
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
