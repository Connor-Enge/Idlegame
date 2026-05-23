import {
  EDUCATION,
  FEATURE_UNLOCKS,
  LEGACY_INCOME_BONUS,
  RETIRE_THRESHOLD,
  XP_BASE,
  XP_GROWTH,
} from "./data";
import type {
  EducationProgram,
  FeatureFlag,
  GameState,
  LifeState,
  Progression,
} from "./types";

export function defaultProgression(): Progression {
  return {
    level: 1,
    xp: 0,
    credentials: [],
    studyingId: null,
    studyTicksRemaining: 0,
    unlocks: [],
    legacyPoints: 0,
    retirements: 0,
    achievements: [],
  };
}

// XP required to advance FROM the given level to the next.
export function xpToNext(level: number): number {
  return Math.floor(XP_BASE * Math.pow(XP_GROWTH, level - 1));
}

// Grant XP and resolve any level-ups. Mutates and returns levels gained.
export function grantXp(p: Progression, amount: number): number {
  if (amount <= 0) return 0;
  p.xp += amount;
  let gained = 0;
  while (p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level += 1;
    gained += 1;
  }
  return gained;
}

// Permanent income multiplier from prestige + level.
export function incomeMultiplier(p: Progression): number {
  return (1 + p.legacyPoints * LEGACY_INCOME_BONUS) * (1 + p.level * 0.005);
}

// ---- Education ----

export function educationById(id: string): EducationProgram | undefined {
  return EDUCATION.find((e) => e.id === id);
}

export function canStartStudy(
  state: GameState,
  edu: EducationProgram,
): { ok: boolean; reason?: string } {
  const p = state.progression;
  if (p.credentials.includes(edu.id)) return { ok: false, reason: "Already earned" };
  if (p.studyingId) return { ok: false, reason: "Already studying something" };
  if (p.level < edu.levelRequired) return { ok: false, reason: `Requires level ${edu.levelRequired}` };
  for (const req of edu.requires) {
    if (!p.credentials.includes(req)) {
      const name = educationById(req)?.short ?? req;
      return { ok: false, reason: `Requires ${name} first` };
    }
  }
  if (state.stats.cash < edu.cost) return { ok: false, reason: "Not enough cash" };
  return { ok: true };
}

// ---- Feature unlocks (sticky once reached) ----

export function refreshUnlocks(state: GameState): FeatureFlag[] {
  const newly: FeatureFlag[] = [];
  for (const rule of FEATURE_UNLOCKS) {
    if (!state.progression.unlocks.includes(rule.flag) && state.stats.netWorth >= rule.netWorth) {
      state.progression.unlocks.push(rule.flag);
      newly.push(rule.flag);
    }
  }
  return newly;
}

export function hasFeature(state: GameState, flag: FeatureFlag): boolean {
  return state.progression.unlocks.includes(flag);
}

export function nextUnlock(state: GameState): { flag: FeatureFlag; netWorth: number; label: string } | null {
  return FEATURE_UNLOCKS.find((r) => !state.progression.unlocks.includes(r.flag)) ?? null;
}

// ---- Prestige ----

export function canRetire(state: GameState): boolean {
  return state.stats.netWorth >= RETIRE_THRESHOLD;
}

// Credit yield from prestige. Tuned so an early-life $30k death yields ~7
// credits (+~18% income boost), and a $1M voluntary retire yields ~38
// (+~95%), so the loop actually snowballs life-over-life.
export function legacyGain(netWorth: number): number {
  if (netWorth < RETIRE_THRESHOLD) return 0;
  return Math.floor(12 * Math.sqrt(netWorth / 100_000));
}

// ---------------------------------------------------------------------------
// Life & mortality
// ---------------------------------------------------------------------------

export const TICKS_PER_DAY = 1; // each tick advances the player one day
export const DAYS_PER_YEAR = 365;
export const TICKS_PER_YEAR = TICKS_PER_DAY * DAYS_PER_YEAR;
export const LIFE_START_AGE = 18;

export function rollDeathAge(): number {
  return 65 + Math.floor(Math.random() * 36); // 65..100 inclusive
}

export function defaultLife(): LifeState {
  return {
    ageTicks: 0,
    startAge: LIFE_START_AGE,
    deathAge: rollDeathAge(),
    generation: 1,
    deathReport: null,
  };
}

export function currentAge(life: LifeState): number {
  return life.startAge + life.ageTicks / TICKS_PER_YEAR;
}

// Whole years lived + the day within the current year (1..365), for display.
export function ageParts(life: LifeState): { years: number; day: number } {
  return {
    years: life.startAge + Math.floor(life.ageTicks / TICKS_PER_YEAR),
    day: (life.ageTicks % TICKS_PER_YEAR) + 1,
  };
}

// Fraction of the whole life elapsed (0..1), for the mortality meter.
export function lifeProgress(life: LifeState): number {
  const span = (life.deathAge - life.startAge) * TICKS_PER_YEAR;
  return span > 0 ? Math.min(1, life.ageTicks / span) : 0;
}

// Legacy credits awarded when a life ends — same curve as voluntary retire,
// but no threshold and a floor of 1 so every death rewards something.
export function lifeCredits(netWorth: number): number {
  return Math.max(1, Math.floor(12 * Math.sqrt(Math.max(0, netWorth) / 100_000)));
}
