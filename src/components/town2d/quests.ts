import type { GameState } from "@/lib/game/types";

// A linear tutorial track. Each step is a pure check against game state — the
// player advances by playing the game (no separate quest-completion action
// needed). The HUD shows the FIRST step whose check returns false.

export interface QuestStep {
  id: string;
  hint: string;
  icon: string;
  check: (s: GameState) => boolean;
}

export const QUEST_STEPS: QuestStep[] = [
  { id: "play1", icon: "🕹️", hint: "Play 3 rounds at the Career Office", check: (s) => s.career.roundsPlayed >= 3 },
  { id: "earn1k", icon: "💵", hint: "Earn at least $1,000", check: (s) => s.stats.cash >= 1000 },
  { id: "clear1", icon: "🎉", hint: "Clear your first job goal", check: (s) => s.career.jobsCleared >= 1 },
  { id: "lvl3", icon: "⭐", hint: "Reach level 3", check: (s) => s.progression.level >= 3 },
  { id: "stock1", icon: "📈", hint: "Buy your first stock at the Stock Market", check: (s) => s.holdings.length >= 1 },
  { id: "biz1", icon: "🏢", hint: "Open your first business", check: (s) => s.businesses.length >= 1 },
  { id: "earn50k", icon: "💰", hint: "Earn $50,000 total cash", check: (s) => s.stats.cash >= 50_000 },
  { id: "prop1", icon: "🏠", hint: "Buy your first property", check: (s) => s.properties.length >= 1 },
  { id: "ach5", icon: "🏆", hint: "Unlock 5 achievements", check: (s) => s.progression.achievements.length >= 5 },
  { id: "retire1", icon: "✨", hint: "Retire once for Legacy Points", check: (s) => s.progression.retirements >= 1 },
];

export function currentQuest(s: GameState | null | undefined): { idx: number; step: QuestStep } | null {
  if (!s) return null;
  for (let i = 0; i < QUEST_STEPS.length; i++) {
    if (!QUEST_STEPS[i].check(s)) return { idx: i, step: QUEST_STEPS[i] };
  }
  return null;
}
