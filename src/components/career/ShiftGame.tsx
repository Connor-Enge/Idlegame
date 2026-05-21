"use client";

import { useState } from "react";
import { useGame, gameActions } from "@/lib/store";
import { money } from "@/lib/format";
import { Button } from "@/components/ui";
import TimingBar from "./TimingBar";
import { getSkillLevel, qualityFromPosition, rollShiftTasks, zonesForSkill } from "@/lib/game/career";
import { SKILLS } from "@/lib/game/careerData";
import type { ShiftMoment, ShiftQuality, ShiftResult } from "@/lib/game/types";

function skillMeta(id: string) {
  return SKILLS.find((s) => s.id === id);
}

export default function ShiftGame({ onExit }: { onExit: () => void }) {
  const run = useGame((s) => s.run);
  const startState = useGame.getState().state!;
  const trackId = startState.career.trackId!;

  const [tasks] = useState(() => rollShiftTasks(trackId));
  const [idx, setIdx] = useState(0);
  const [moments, setMoments] = useState<ShiftMoment[]>([]);
  const [frozen, setFrozen] = useState<number | null>(null);
  const [quality, setQuality] = useState<ShiftQuality | null>(null);
  const [result, setResult] = useState<ShiftResult | null>(null);

  const task = tasks[idx];
  const skillLvl = task ? getSkillLevel(startState, task.skillId) : 0;
  const zones = zonesForSkill(skillLvl);
  // Higher tiers move the marker faster — more pressure as you climb.
  const speed = 118 + idx * 10;

  function handleStop(pos: number) {
    if (!task) return;
    const q = qualityFromPosition(pos, zones);
    const moment: ShiftMoment = { taskId: task.id, skillId: task.skillId, quality: q };
    const next = [...moments, moment];
    setMoments(next);
    setFrozen(pos);
    setQuality(q);
    setTimeout(() => {
      if (idx + 1 < tasks.length) {
        setIdx(idx + 1);
        setFrozen(null);
        setQuality(null);
      } else {
        finish(next);
      }
    }, 850);
  }

  function finish(allMoments: ShiftMoment[]) {
    const fresh = useGame.getState().state!;
    const res = gameActions.commitShift(fresh, allMoments);
    run(res, { silent: true });
    setResult(res.shift ?? null);
  }

  if (result) {
    return <ShiftResultPanel result={result} onExit={onExit} />;
  }

  const meta = task ? skillMeta(task.skillId) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          Task {idx + 1} of {tasks.length}
        </span>
        <div className="flex gap-1">
          {tasks.map((t, i) => (
            <span
              key={t.id}
              className={`h-1.5 w-6 rounded-full ${
                i < moments.length ? "bg-accent-2" : i === idx ? "bg-accent" : "bg-white/15"
              }`}
            />
          ))}
        </div>
      </div>

      {task && (
        <div className="rounded-2xl border border-white/5 bg-bg-card p-4 text-center">
          <div className="text-3xl">{meta?.icon}</div>
          <div className="mt-1 text-lg font-bold">{task.label}</div>
          <div className="text-xs text-muted">{task.flavor}</div>
          <div className="mt-1 text-[11px] text-accent">
            {meta?.name} · Lv {skillLvl}
          </div>
        </div>
      )}

      <TimingBar
        zones={zones}
        frozen={frozen}
        quality={quality}
        speed={speed}
        buttonLabel="STOP"
        onStop={handleStop}
      />

      <p className="text-center text-[11px] text-muted">
        Stop the marker in the center. A higher {meta?.name ?? "skill"} level widens the target.
      </p>

      <button onClick={onExit} className="w-full text-center text-xs text-muted active:text-white">
        Cancel shift
      </button>
    </div>
  );
}

function ShiftResultPanel({ result, onExit }: { result: ShiftResult; onExit: () => void }) {
  const grade =
    result.score >= 0.9
      ? { label: "Flawless", tone: "text-accent-2" }
      : result.score >= 0.65
        ? { label: "Strong shift", tone: "text-accent" }
        : result.score >= 0.4
          ? { label: "Got it done", tone: "text-white" }
          : { label: "Rough shift", tone: "text-danger" };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/5 bg-bg-card p-5 text-center">
        <div className={`text-xl font-black ${grade.tone}`}>{grade.label}</div>
        <div className="mt-1 text-3xl font-extrabold text-accent-2">+{money(result.cash)}</div>
        {result.promoted && (
          <div className="mt-2 rounded-lg bg-accent-2/15 py-1.5 text-sm font-bold text-accent-2">
            🎉 Promoted to {result.newTitle}!
          </div>
        )}
        {result.projectCompleted && (
          <div className="mt-2 rounded-lg bg-accent/15 py-1.5 text-sm font-bold text-accent">
            📦 {result.projectCompleted.name} done — +{money(result.projectCompleted.bonus)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <Mini label="Reputation" value={`+${result.reputation}`} />
        <Mini label="Performance" value={`+${result.performanceGain.toFixed(0)}`} />
        <Mini label="Morale" value={`${result.moraleChange >= 0 ? "+" : ""}${result.moraleChange.toFixed(0)}`} />
      </div>

      <div className="rounded-xl bg-white/5 p-3">
        <div className="mb-1 text-[10px] uppercase tracking-wider text-muted">Skill XP</div>
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(result.skillXp).map(([id, xp]) => (
            <span key={id} className="rounded-full bg-white/10 px-2 py-0.5">
              {skillMeta(id)?.icon} {skillMeta(id)?.name} +{xp.toFixed(0)}
            </span>
          ))}
        </div>
      </div>

      <Button className="w-full" onClick={onExit}>
        Done
      </Button>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/5 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="font-bold">{value}</div>
    </div>
  );
}
