"use client";

import type { Job } from "@/lib/game/careerJobs";

export interface MinigameProps {
  job: Job;
  onFinish: (points: number) => void;
  onCancel: () => void;
}

// Pre-game screen: instructions + a big Start button. Every minigame opens here
// so a round only begins on a deliberate tap (no accidental starts).
export function StartScreen({
  icon,
  name,
  blurb,
  onStart,
}: {
  icon: string;
  name: string;
  blurb: string;
  onStart: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/5 bg-bg-card p-6 text-center">
      <div className="text-5xl">{icon}</div>
      <div className="text-lg font-bold">{name}</div>
      <p className="text-sm text-muted">{blurb}</p>
      <button
        onClick={onStart}
        className="mt-2 w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-black active:brightness-90"
      >
        ▶️ Start
      </button>
    </div>
  );
}

// Shared live scoreboard strip shown above the play field.
export function ScoreStrip({ label, value, right }: { label: string; value: string | number; right?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between rounded-xl bg-white/5 px-4 py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-bold text-accent-2">{value}</span>
      {right && <span className="text-muted">{right}</span>}
    </div>
  );
}
