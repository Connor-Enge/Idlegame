import { CAREER_TRACKS, SALARY_SCALE, SHIFT_GIG_SCALE, SKILL_XP_SCALE } from "./data";
import {
  GIGS,
  MAX_SKILL_LEVEL,
  PERK_EFFECTS,
  PROJECTS,
  SKILL_IDS,
  TRACK_TASKS,
  type Gig,
  type PerkEffect,
  type ProjectDef,
  type ShiftTask,
} from "./careerData";
import { incomeMultiplier } from "./progression";
import type {
  CareerTrack,
  GameState,
  GigResult,
  JobLevel,
  PlayerCareer,
  ShiftMoment,
  ShiftQuality,
  ShiftResult,
} from "./types";

// ---------------------------------------------------------------------------
// Initialization / save migration for the career sub-state.
// ---------------------------------------------------------------------------

export function freshCareer(): PlayerCareer {
  return {
    trackId: null,
    levelIndex: 0,
    shiftsWorked: 0,
    employedSince: null,
    skills: { focus: 0, technical: 0, teamwork: 0, communication: 0, leadership: 0, networking: 0 },
    performance: 0,
    morale: 70,
    salaryMultiplier: 1,
    shiftStreak: 0,
    bestShiftStreak: 0,
    totalEarned: 0,
    shiftsTotal: 0,
    gigsCompleted: 0,
    projectsCompleted: 0,
    raisesNegotiated: 0,
    perks: [],
    activeProject: null,
    gigCooldownTicks: 0,
    reviewCooldownTicks: 0,
    restCooldownTicks: 0,
  };
}

// Backfill any fields missing from an older save. Mutates and returns.
export function normalizeCareer(c: PlayerCareer): PlayerCareer {
  const d = freshCareer();
  if (c.skills == null) c.skills = d.skills;
  else for (const id of Object.keys(d.skills)) if (c.skills[id] == null) c.skills[id] = 0;
  if (c.performance == null) c.performance = d.performance;
  if (c.morale == null) c.morale = d.morale;
  if (c.salaryMultiplier == null || c.salaryMultiplier <= 0) c.salaryMultiplier = 1;
  if (c.shiftStreak == null) c.shiftStreak = 0;
  if (c.bestShiftStreak == null) c.bestShiftStreak = 0;
  if (c.totalEarned == null) c.totalEarned = 0;
  if (c.shiftsTotal == null) c.shiftsTotal = c.shiftsWorked ?? 0;
  if (c.gigsCompleted == null) c.gigsCompleted = 0;
  if (c.projectsCompleted == null) c.projectsCompleted = 0;
  if (c.raisesNegotiated == null) c.raisesNegotiated = 0;
  if (c.perks == null) c.perks = [];
  if (c.activeProject === undefined) c.activeProject = null;
  if (c.gigCooldownTicks == null) c.gigCooldownTicks = 0;
  if (c.reviewCooldownTicks == null) c.reviewCooldownTicks = 0;
  if (c.restCooldownTicks == null) c.restCooldownTicks = 0;
  return c;
}

// ---------------------------------------------------------------------------
// Skill leveling — XP curve shared by all six skills.
// ---------------------------------------------------------------------------

export function skillXpToNext(level: number): number {
  return Math.floor(50 * Math.pow(1.22, level));
}

export function skillLevel(xp: number): number {
  let level = 0;
  let remaining = xp;
  while (level < MAX_SKILL_LEVEL && remaining >= skillXpToNext(level)) {
    remaining -= skillXpToNext(level);
    level += 1;
  }
  return level;
}

// Progress 0..1 toward the next skill level (1 when maxed).
export function skillProgress(xp: number): number {
  const level = skillLevel(xp);
  if (level >= MAX_SKILL_LEVEL) return 1;
  let consumed = 0;
  for (let i = 0; i < level; i++) consumed += skillXpToNext(i);
  const into = xp - consumed;
  return Math.min(1, into / skillXpToNext(level));
}

export function getSkillXp(state: GameState, skillId: string): number {
  return state.career.skills?.[skillId] ?? 0;
}

export function getSkillLevel(state: GameState, skillId: string): number {
  return skillLevel(getSkillXp(state, skillId));
}

// ---------------------------------------------------------------------------
// Perks — fold all owned perk effects into one resolved bundle.
// ---------------------------------------------------------------------------

export function perkBundle(state: GameState): Required<PerkEffect> {
  const acc: Required<PerkEffect> = {
    shiftEnergy: 0,
    moraleDrainMult: 1,
    skillXpMult: 1,
    reputationMult: 1,
    passiveSalaryMult: 1,
    performanceMult: 1,
    shiftPayMult: 1,
    gigCooldownMult: 1,
  };
  for (const id of state.career.perks ?? []) {
    const e = PERK_EFFECTS[id];
    if (!e) continue;
    if (e.shiftEnergy) acc.shiftEnergy += e.shiftEnergy;
    if (e.moraleDrainMult != null) acc.moraleDrainMult *= e.moraleDrainMult;
    if (e.skillXpMult != null) acc.skillXpMult *= e.skillXpMult;
    if (e.reputationMult != null) acc.reputationMult *= e.reputationMult;
    if (e.passiveSalaryMult != null) acc.passiveSalaryMult *= e.passiveSalaryMult;
    if (e.performanceMult != null) acc.performanceMult *= e.performanceMult;
    if (e.shiftPayMult != null) acc.shiftPayMult *= e.shiftPayMult;
    if (e.gigCooldownMult != null) acc.gigCooldownMult *= e.gigCooldownMult;
  }
  return acc;
}

// ---------------------------------------------------------------------------
// Track / level helpers.
// ---------------------------------------------------------------------------

export function trackById(id: string | null): CareerTrack | undefined {
  return id ? CAREER_TRACKS.find((t) => t.id === id) : undefined;
}

export function currentLevel(state: GameState): JobLevel | undefined {
  const track = trackById(state.career.trackId);
  return track?.levels[state.career.levelIndex];
}

// Passive salary credited per tick while employed. Mirrors the engine exactly
// (macro, income mult, raises, morale, perks, global SALARY_SCALE) so the UI
// shows what's actually earned rather than the raw base rate.
export function passiveSalaryPerTick(state: GameState): number {
  const level = currentLevel(state);
  if (!level || !state.career.trackId) return 0;
  const perks = perkBundle(state);
  const macroMult = 1 + state.economy.gdpGrowth;
  const moraleFactor = 0.7 + (state.career.morale / 100) * 0.5;
  return (
    level.baseSalaryPerTick *
    macroMult *
    incomeMultiplier(state.progression) *
    state.career.salaryMultiplier *
    moraleFactor *
    perks.passiveSalaryMult *
    SALARY_SCALE
  );
}

export function tasksForTrack(trackId: string): ShiftTask[] {
  return TRACK_TASKS[trackId] ?? TRACK_TASKS.service;
}

// Pick three distinct tasks for a shift (deterministic-ish via Math.random).
export function rollShiftTasks(trackId: string): ShiftTask[] {
  const pool = [...tasksForTrack(trackId)];
  const picks: ShiftTask[] = [];
  const n = Math.min(3, pool.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picks.push(pool.splice(idx, 1)[0]);
  }
  return picks;
}

// ---------------------------------------------------------------------------
// Timing mini-game — the marker sweeps 0..100; these zones (half-widths about
// the center, 50) widen with the relevant skill level so training pays off.
// ---------------------------------------------------------------------------

export interface ShiftZones {
  perfect: number;
  good: number;
  ok: number;
}

export function zonesForSkill(level: number): ShiftZones {
  const good = 13 + level * 0.85; // lvl0 ~13, lvl20 ~30
  return {
    perfect: 4 + level * 0.45, // lvl0 ~4, lvl20 ~13
    good,
    ok: good + 9,
  };
}

export function qualityFromPosition(pos: number, zones: ShiftZones): ShiftQuality {
  const d = Math.abs(pos - 50);
  if (d <= zones.perfect) return "perfect";
  if (d <= zones.good) return "good";
  if (d <= zones.ok) return "ok";
  return "miss";
}

const QUALITY_WEIGHT: Record<ShiftQuality, number> = {
  perfect: 1,
  good: 0.75,
  ok: 0.45,
  miss: 0.1,
};

export function qualityWeight(q: ShiftQuality): number {
  return QUALITY_WEIGHT[q];
}

// ---------------------------------------------------------------------------
// Shift resolution — compute the full reward bundle for a set of resolved
// moments. Pure: callers apply it to a cloned state.
// ---------------------------------------------------------------------------

export function resolveShift(state: GameState, moments: ShiftMoment[]): ShiftResult | null {
  const track = trackById(state.career.trackId);
  const level = currentLevel(state);
  if (!track || !level) return null;

  const perks = perkBundle(state);
  const score =
    moments.reduce((sum, m) => sum + qualityWeight(m.quality), 0) / Math.max(1, moments.length);

  const morale = state.career.morale ?? 70;
  const moraleFactor = 0.7 + (morale / 100) * 0.5; // 0.7 .. 1.2
  const payMult = 0.4 + score * 1.1; // 0.51 (bad) .. 1.5 (perfect)
  const incomeMult = incomeMultiplier(state.progression);
  const macro = 1 + state.economy.gdpGrowth;

  const base = level.baseSalaryPerTick * 8;
  const cash = Math.round(
    base *
      payMult *
      moraleFactor *
      (state.career.salaryMultiplier ?? 1) *
      perks.shiftPayMult *
      incomeMult *
      macro *
      SHIFT_GIG_SCALE,
  );

  const reputation = Math.round((2 + score * 6 + level.tier) * perks.reputationMult);
  const performanceGain = score * 12 * perks.performanceMult;

  // Skill XP accrues to whichever skills the shift exercised. Kept modest (and
  // quality-weighted) versus the paid Train action so working a job nudges
  // skills up without trivializing deliberate training. Tune via SKILL_XP_SCALE.
  const skillXp: Record<string, number> = {};
  for (const m of moments) {
    const gain = (2 + qualityWeight(m.quality) * 8) * perks.skillXpMult * SKILL_XP_SCALE;
    skillXp[m.skillId] = (skillXp[m.skillId] ?? 0) + gain;
  }

  const energyCost = Math.max(1, level.energyCostPerShift + perks.shiftEnergy);
  let moraleChange = (score - 0.55) * 16;
  if (moraleChange < 0) moraleChange *= perks.moraleDrainMult;

  // Promotion check (after this shift's contributions).
  const next = track.levels[state.career.levelIndex + 1];
  const newPerformance = Math.min(100, (state.career.performance ?? 0) + performanceGain);
  const newShiftsWorked = state.career.shiftsWorked + 1;
  const promoted = Boolean(
    next &&
      newShiftsWorked >= level.promoteAfterShifts &&
      state.stats.reputation + reputation >= next.reputationRequired &&
      newPerformance >= 55,
  );

  // Project progress.
  let projectCompleted: ShiftResult["projectCompleted"];
  const proj = state.career.activeProject;
  if (proj && proj.shiftsRemaining <= 1) {
    const def = PROJECTS.find((p) => p.id === proj.projectId);
    if (def) {
      const bonus = Math.round(
        level.baseSalaryPerTick * def.rewardPerShiftSalary * incomeMult * SHIFT_GIG_SCALE,
      );
      projectCompleted = { name: def.name, bonus };
    }
  }

  return {
    trackId: track.id,
    title: level.title,
    moments,
    score,
    cash,
    reputation,
    performanceGain,
    skillXp,
    energyCost,
    moraleChange,
    promoted,
    newTitle: promoted ? next?.title : undefined,
    projectCompleted,
  };
}

// ---------------------------------------------------------------------------
// Gigs.
// ---------------------------------------------------------------------------

export function gigById(id: string): Gig | undefined {
  return GIGS.find((g) => g.id === id);
}

export function gigAvailable(state: GameState, gig: Gig): { ok: boolean; reason?: string } {
  if (state.progression.level < gig.levelRequired)
    return { ok: false, reason: `Lv ${gig.levelRequired}` };
  if (gig.skillRequired > 0 && getSkillLevel(state, gig.skillId) < gig.skillRequired)
    return { ok: false, reason: `${gig.skillId} ${gig.skillRequired}` };
  if ((state.career.gigCooldownTicks ?? 0) > 0)
    return { ok: false, reason: `${state.career.gigCooldownTicks}s` };
  if (state.stats.energy < gig.energyCost) return { ok: false, reason: "Low energy" };
  return { ok: true };
}

export function resolveGig(state: GameState, gigId: string, quality: ShiftQuality): GigResult | null {
  const gig = gigById(gigId);
  if (!gig) return null;
  const perks = perkBundle(state);
  const w = qualityWeight(quality);
  const sLvl = getSkillLevel(state, gig.skillId);
  const incomeMult = incomeMultiplier(state.progression);
  const cash = Math.round(
    gig.basePay * (0.4 + w * 1.1) * (1 + sLvl * 0.05) * incomeMult * perks.shiftPayMult * SHIFT_GIG_SCALE,
  );
  const skillXp = (6 + w * 9) * perks.skillXpMult;
  const reputation = Math.round((1 + w * 2) * perks.reputationMult);
  return {
    gigId,
    name: gig.name,
    skillId: gig.skillId,
    quality,
    cash,
    skillXp,
    reputation,
    energyCost: gig.energyCost,
  };
}

// ---------------------------------------------------------------------------
// Training — buy skill XP directly with cash + energy. Cost scales with the
// skill's current level so every skill has a long, deliberate climb.
// ---------------------------------------------------------------------------

export const TRAIN_ENERGY = 9;

export function trainCost(level: number): number {
  return Math.round(180 * Math.pow(1.33, level));
}

export function trainXpGain(level: number): number {
  // Roughly a third of a level per session; the cost curve does the gating.
  return Math.round(skillXpToNext(level) * 0.34);
}

export function canTrain(state: GameState, skillId: string): { ok: boolean; reason?: string } {
  if (!SKILL_IDS.includes(skillId)) return { ok: false, reason: "Unknown skill" };
  const lvl = getSkillLevel(state, skillId);
  if (lvl >= MAX_SKILL_LEVEL) return { ok: false, reason: "Maxed" };
  if (state.stats.energy < TRAIN_ENERGY) return { ok: false, reason: "Low energy" };
  if (state.stats.cash < trainCost(lvl)) return { ok: false, reason: "Need cash" };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Raises / performance reviews.
// ---------------------------------------------------------------------------

export function raiseChance(state: GameState): number {
  const perf = state.career.performance ?? 0;
  const comm = getSkillLevel(state, "communication");
  const net = getSkillLevel(state, "networking");
  const lead = getSkillLevel(state, "leadership");
  const chance = perf / 220 + (comm + net + lead) * 0.018;
  return Math.max(0.05, Math.min(0.92, chance));
}

export function canNegotiate(state: GameState): { ok: boolean; reason?: string } {
  if (!state.career.trackId) return { ok: false, reason: "No job" };
  if ((state.career.reviewCooldownTicks ?? 0) > 0)
    return { ok: false, reason: `Cooldown ${state.career.reviewCooldownTicks}s` };
  if ((state.career.performance ?? 0) < 35)
    return { ok: false, reason: "Build performance first" };
  return { ok: true };
}

export const REVIEW_COOLDOWN_TICKS = 90;

// Resting fully restores energy but is gated behind a cooldown, so most energy
// comes from slow passive regen — this caps how fast you can grind shifts/gigs
// in a single life (otherwise free instant refills make active income endless).
export const REST_COOLDOWN_TICKS = 150;

// ---------------------------------------------------------------------------
// Projects.
// ---------------------------------------------------------------------------

export function projectById(id: string): ProjectDef | undefined {
  return PROJECTS.find((p) => p.id === id);
}

export function availableProjects(state: GameState): ProjectDef[] {
  return PROJECTS.filter((p) => state.progression.level >= p.levelRequired);
}
