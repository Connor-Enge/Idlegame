import {
  CAREER_TRACKS,
  EDUCATION,
  FEATURE_UNLOCKS,
  LEGACY_INCOME_BONUS,
  RETIRE_THRESHOLD,
  XP_BASE,
  XP_GROWTH,
} from "./data";
import type {
  CareerTrack,
  EducationProgram,
  FeatureFlag,
  GameState,
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

// ---- Career gating ----

export function trackUnlocked(
  state: GameState,
  track: CareerTrack,
): { ok: boolean; reason?: string } {
  const r = track.requires;
  if (!r) return { ok: true };
  const p = state.progression;
  if (r.level && p.level < r.level) return { ok: false, reason: `Level ${r.level}` };
  if (r.reputation && state.stats.reputation < r.reputation)
    return { ok: false, reason: `${r.reputation} reputation` };
  for (const c of r.credentials ?? []) {
    if (!p.credentials.includes(c)) {
      return { ok: false, reason: educationById(c)?.name ?? c };
    }
  }
  return { ok: true };
}

export function trackById(id: string | null): CareerTrack | undefined {
  return id ? CAREER_TRACKS.find((t) => t.id === id) : undefined;
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

export function legacyGain(netWorth: number): number {
  if (netWorth < RETIRE_THRESHOLD) return 0;
  return Math.floor(10 * Math.sqrt(netWorth / 1_000_000));
}
