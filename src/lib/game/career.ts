// Career v3 state helpers. The heavy content (jobs + minigames) lives in
// careerJobs.ts; this file just initializes/normalizes the per-player career
// sub-state and exposes a couple of derived helpers for the UI.

import { JOB_COUNT, jobByIndex, minigameById } from "./careerJobs";
import type { GameState, PlayerCareer } from "./types";

export function freshCareer(): PlayerCareer {
  return {
    jobIndex: 0,
    progress: 0,
    jobsCleared: 0,
    roundsPlayed: 0,
    totalEarned: 0,
  };
}

// Backfill / repair the career sub-state. Older saves used a completely
// different shape (tracks, skills, shifts…); anything unrecognized is reset.
export function normalizeCareer(c: Partial<PlayerCareer> | null | undefined): PlayerCareer {
  const fresh = freshCareer();
  if (!c || typeof c !== "object") return fresh;
  return {
    jobIndex:
      typeof c.jobIndex === "number" ? Math.max(0, Math.min(JOB_COUNT - 1, Math.floor(c.jobIndex))) : 0,
    progress: typeof c.progress === "number" && c.progress >= 0 ? c.progress : 0,
    jobsCleared: typeof c.jobsCleared === "number" && c.jobsCleared >= 0 ? c.jobsCleared : 0,
    roundsPlayed: typeof c.roundsPlayed === "number" && c.roundsPlayed >= 0 ? c.roundsPlayed : 0,
    totalEarned: typeof c.totalEarned === "number" && c.totalEarned >= 0 ? c.totalEarned : 0,
  };
}

export function currentJob(state: GameState) {
  return jobByIndex(state.career.jobIndex);
}

export function currentMinigame(state: GameState) {
  return minigameById(currentJob(state).minigameId);
}

// 0..1 progress toward the current job's goal.
export function jobProgressPct(state: GameState): number {
  const goal = currentJob(state).goal;
  return goal > 0 ? Math.min(1, state.career.progress / goal) : 1;
}

export function isFinalJob(state: GameState): boolean {
  return state.career.jobIndex >= JOB_COUNT - 1;
}
