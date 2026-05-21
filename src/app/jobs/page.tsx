"use client";

import { useState } from "react";
import { useGame, gameActions } from "@/lib/store";
import { money } from "@/lib/format";
import { Button, Card, Pill, ProgressBar } from "@/components/ui";
import { CAREER_TRACKS, EDUCATION } from "@/lib/game/data";
import { GIGS, PERKS, PROJECTS, SKILLS, MAX_SKILL_LEVEL } from "@/lib/game/careerData";
import { canStartStudy, educationById, trackUnlocked, xpToNext } from "@/lib/game/progression";
import {
  canNegotiate,
  canTrain,
  getSkillLevel,
  getSkillXp,
  gigAvailable,
  perkBundle,
  projectById,
  raiseChance,
  skillProgress,
  trackById,
  trainCost,
  trainXpGain,
} from "@/lib/game/career";
import ShiftGame from "@/components/career/ShiftGame";
import GigGame from "@/components/career/GigGame";
import type { GameState } from "@/lib/game/types";

type Mode = { kind: "hub" } | { kind: "shift" } | { kind: "gig"; gigId: string };

const TABS = [
  { id: "job", label: "Job" },
  { id: "gigs", label: "Gigs" },
  { id: "skills", label: "Learn" },
  { id: "tracks", label: "Tracks" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function JobsPage() {
  const state = useGame((s) => s.state);
  const run = useGame((s) => s.run);
  const [mode, setMode] = useState<Mode>({ kind: "hub" });
  const [tab, setTab] = useState<Tab>("job");

  if (!state) return null;

  if (mode.kind === "shift") {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-bold">💼 Working a Shift</h1>
        <ShiftGame onExit={() => setMode({ kind: "hub" })} />
      </div>
    );
  }
  if (mode.kind === "gig") {
    return (
      <div className="space-y-3">
        <button
          onClick={() => setMode({ kind: "hub" })}
          className="text-sm text-muted active:text-white"
        >
          ← Career
        </button>
        <GigGame gigId={mode.gigId} onExit={() => setMode({ kind: "hub" })} />
      </div>
    );
  }

  const { career, progression } = state;
  const track = trackById(career.trackId);
  const xpPct = (progression.xp / xpToNext(progression.level)) * 100;

  return (
    <div className="pb-4">
      {/* Compact header: title, level + xp progress, current role at a glance */}
      <div className="mb-3 mt-1 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight">Career</h1>
          <p className="truncate text-xs text-muted">
            {track ? track.levels[career.levelIndex].title : "Unemployed"} · Lv {progression.level}
          </p>
        </div>
        <div className="w-24 shrink-0">
          <div className="mb-1 text-right text-[10px] text-muted">
            {progression.xp}/{xpToNext(progression.level)} XP
          </div>
          <ProgressBar value={xpPct} />
        </div>
      </div>

      {/* Sticky sub-nav so switching never requires scrolling back up */}
      <div className="sticky top-0 z-10 -mx-4 mb-3 bg-bg/95 px-4 py-2 backdrop-blur">
        <div className="flex gap-1 rounded-xl bg-bg-card p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
                tab === t.id ? "bg-accent text-black" : "text-muted active:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {tab === "job" && (
          <>
            {track ? (
              <JobCard state={state} run={run} onWork={() => setMode({ kind: "shift" })} />
            ) : (
              <Card>
                <p className="text-sm text-muted">
                  You&apos;re unemployed. Pick up <span className="text-accent">side gigs</span> for
                  fast cash, train your <span className="text-accent">skills</span>, and study to
                  unlock real careers.
                </p>
              </Card>
            )}
            {track && <ProjectsSection state={state} run={run} />}
            <PerksSection state={state} run={run} />
          </>
        )}

        {tab === "gigs" && <GigsSection state={state} onPlay={(gigId) => setMode({ kind: "gig", gigId })} />}

        {tab === "skills" && (
          <>
            <SkillsSection state={state} run={run} />
            <EducationSection state={state} run={run} />
          </>
        )}

        {tab === "tracks" && <TracksSection state={state} run={run} />}
      </div>
    </div>
  );
}

type RunFn = ReturnType<typeof useGame.getState>["run"];

// ---------------------------------------------------------------------------
// Current job
// ---------------------------------------------------------------------------

function JobCard({
  state,
  run,
  onWork,
}: {
  state: GameState;
  run: RunFn;
  onWork: () => void;
}) {
  const { career, stats } = state;
  const track = trackById(career.trackId)!;
  const level = track.levels[career.levelIndex];
  const next = track.levels[career.levelIndex + 1];
  const perks = perkBundle(state);
  const energyCost = Math.max(1, level.energyCostPerShift + perks.shiftEnergy);
  const canWork = stats.energy >= energyCost;
  const promoteProgress = Math.min(100, (career.shiftsWorked / level.promoteAfterShifts) * 100);
  const neg = canNegotiate(state);

  return (
    <Card className="border-accent/30">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted">{track.name}</div>
          <div className="text-lg font-bold">{level.title}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Pill tone="up">Tier {level.tier}</Pill>
          {career.salaryMultiplier > 1 && (
            <span className="text-[11px] font-semibold text-accent-2">
              salary ×{career.salaryMultiplier.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {/* Morale + performance */}
      <div className="mt-3 space-y-2">
        <Meter label="Performance" value={career.performance} tone="bg-accent" suffix="/100" />
        <Meter label="Morale" value={career.morale} tone="bg-accent-2" suffix="/100" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <Info label="Salary / tick" value={money(level.baseSalaryPerTick * career.salaryMultiplier)} />
        <Info label="Energy / shift" value={`${energyCost}⚡`} />
        <Info label="Shifts here" value={`${career.shiftsWorked}`} />
        <Info label="Streak" value={`🔥 ${career.shiftStreak}`} />
      </div>

      {next ? (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[11px] text-muted">
            <span>Promotion to {next.title}</span>
            <span>
              {career.shiftsWorked}/{level.promoteAfterShifts} shifts
            </span>
          </div>
          <ProgressBar value={promoteProgress} />
          <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted">
            <span className={stats.reputation >= next.reputationRequired ? "text-accent-2" : "text-danger"}>
              🏅 {Math.floor(stats.reputation)}/{next.reputationRequired}
            </span>
            <span className={career.performance >= 55 ? "text-accent-2" : "text-danger"}>
              📊 {career.performance.toFixed(0)}/55 perf
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-3 text-[11px] text-accent-2">Top of the ladder. Time to retire?</div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button onClick={onWork} disabled={!canWork} className="col-span-2">
          ▶️ Work a Shift{!canWork && " (low energy)"}
        </Button>
        <Button variant="secondary" onClick={() => run(gameActions.workShift(state))} disabled={!canWork}>
          ⚡ Quick Shift
        </Button>
        <Button variant="secondary" onClick={() => run(gameActions.rest(state))}>
          😴 Rest
        </Button>
      </div>

      <Button
        variant="secondary"
        className="mt-2 w-full"
        disabled={!neg.ok}
        onClick={() => run(gameActions.negotiateRaise(state))}
      >
        {neg.ok
          ? `🤝 Negotiate Raise (${(raiseChance(state) * 100).toFixed(0)}% odds)`
          : `🤝 Raise — ${neg.reason}`}
      </Button>

      <button
        onClick={() => run(gameActions.quitJob(state))}
        className="mt-2 w-full text-center text-xs text-muted active:text-white"
      >
        Quit job
      </button>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

function SkillsSection({ state, run }: { state: GameState; run: RunFn }) {
  return (
    <section className="space-y-2">
      <SubHeading>Skills</SubHeading>
      <div className="grid grid-cols-2 gap-2">
        {SKILLS.map((skill) => {
          const lvl = getSkillLevel(state, skill.id);
          const xp = getSkillXp(state, skill.id);
          const prog = skillProgress(xp);
          const maxed = lvl >= MAX_SKILL_LEVEL;
          const gate = canTrain(state, skill.id);
          const cost = trainCost(lvl);
          return (
            <div key={skill.id} className="rounded-2xl border border-white/5 bg-bg-card p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">
                  {skill.icon} {skill.name}
                </span>
                <span className="text-xs font-bold text-accent">Lv {lvl}</span>
              </div>
              <ProgressBar className="mt-2" value={prog * 100} />
              {maxed ? (
                <div className="mt-2 text-center text-[11px] font-semibold text-accent-2">MAXED</div>
              ) : (
                <button
                  disabled={!gate.ok}
                  onClick={() => run(gameActions.trainSkill(state, skill.id))}
                  className="mt-2 w-full rounded-lg bg-white/10 py-1.5 text-[11px] font-semibold active:bg-white/20 disabled:opacity-40"
                >
                  {gate.ok ? `Train · ${money(cost)} · +${trainXpGain(lvl)}xp` : gate.reason}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Side gigs
// ---------------------------------------------------------------------------

function GigsSection({ state, onPlay }: { state: GameState; onPlay: (gigId: string) => void }) {
  const visible = GIGS.filter((g) => state.progression.level >= g.levelRequired - 2);
  return (
    <section className="space-y-2">
      <SubHeading sub="Quick freelance work — available anytime, on a cooldown.">Side Gigs</SubHeading>
      {visible.map((gig) => {
        const gate = gigAvailable(state, gig);
        const skill = SKILLS.find((s) => s.id === gig.skillId);
        const skillLocked = gig.skillRequired > 0 && getSkillLevel(state, gig.skillId) < gig.skillRequired;
        const levelLocked = state.progression.level < gig.levelRequired;
        const locked = levelLocked || skillLocked;
        return (
          <Card key={gig.id} className={locked ? "opacity-60" : ""}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">
                  {gig.icon} {gig.name}
                </div>
                <div className="text-[11px] text-muted">{gig.description}</div>
                <div className="mt-1 text-[11px] text-muted">
                  {skill?.icon} {skill?.name} · {gig.energyCost}⚡ · up to {money(gig.basePay)}
                </div>
                {locked && (
                  <div className="mt-1 text-[11px] text-danger">
                    Requires{levelLocked ? ` level ${gig.levelRequired}` : ""}
                    {levelLocked && skillLocked ? " ·" : ""}
                    {skillLocked ? ` ${skill?.name} Lv ${gig.skillRequired}` : ""}
                  </div>
                )}
              </div>
              <Button
                disabled={!gate.ok}
                onClick={() => onPlay(gig.id)}
                variant={gate.ok ? "primary" : "secondary"}
              >
                {levelLocked ? `Lv ${gig.levelRequired}` : skillLocked ? `${skill?.icon} ${gig.skillRequired}` : gate.ok ? "Play" : gate.reason}
              </Button>
            </div>
          </Card>
        );
      })}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

function ProjectsSection({ state, run }: { state: GameState; run: RunFn }) {
  const { career } = state;
  const active = career.activeProject;
  const level = trackById(career.trackId)!.levels[career.levelIndex];

  if (active) {
    const def = projectById(active.projectId)!;
    const done = active.totalShifts - active.shiftsRemaining;
    const bonus = Math.round(level.baseSalaryPerTick * def.rewardPerShiftSalary);
    return (
      <section className="space-y-2">
        <SubHeading>Active Project</SubHeading>
        <Card className="border-accent/30">
          <div className="flex items-center justify-between">
            <span className="font-semibold">
              {def.icon} {def.name}
            </span>
            <span className="text-xs text-muted">
              {done}/{active.totalShifts} shifts
            </span>
          </div>
          <ProgressBar className="mt-2" value={(done / active.totalShifts) * 100} />
          <div className="mt-2 text-[11px] text-muted">
            Reward: ~{money(bonus)} · 🏅 +{def.reputation} · work shifts to progress
          </div>
          <button
            onClick={() => run(gameActions.abandonProject(state))}
            className="mt-2 w-full text-center text-[11px] text-muted active:text-white"
          >
            Abandon project
          </button>
        </Card>
      </section>
    );
  }

  const offered = PROJECTS.filter((p) => state.progression.level >= p.levelRequired).slice(0, 3);
  const locked = PROJECTS.find((p) => state.progression.level < p.levelRequired);
  return (
    <section className="space-y-2">
      <SubHeading sub="Multi-shift assignments for a lump-sum payoff.">Projects</SubHeading>
      {offered.map((p) => {
        const skill = SKILLS.find((s) => s.id === p.skillId);
        const bonus = Math.round(level.baseSalaryPerTick * p.rewardPerShiftSalary);
        return (
          <Card key={p.id}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">
                  {p.icon} {p.name}
                </div>
                <div className="text-[11px] text-muted">{p.description}</div>
                <div className="mt-1 text-[11px] text-muted">
                  {p.shifts} shifts · ~{money(bonus)} · 🏅 +{p.reputation} · {skill?.icon} +{p.skillXp}xp
                </div>
              </div>
              <Button onClick={() => run(gameActions.acceptProject(state, p.id))}>Accept</Button>
            </div>
          </Card>
        );
      })}
      {locked && (
        <div className="px-2 text-center text-[11px] text-muted">
          Next: {locked.icon} {locked.name} unlocks at level {locked.levelRequired}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Perks
// ---------------------------------------------------------------------------

function PerksSection({ state, run }: { state: GameState; run: RunFn }) {
  return (
    <section className="space-y-2">
      <SubHeading sub="Permanent career upgrades.">Perks</SubHeading>
      {PERKS.map((perk) => {
        const owned = state.career.perks.includes(perk.id);
        const locked = state.progression.level < perk.levelRequired;
        const affordable = state.stats.cash >= perk.cost;
        return (
          <Card key={perk.id} className={owned ? "border-accent-2/30" : locked ? "opacity-60" : ""}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">
                  {perk.icon} {perk.name} {owned && <span className="text-accent-2">✓</span>}
                </div>
                <div className="text-[11px] text-muted">{perk.description}</div>
                {!owned && <div className="mt-1 text-[11px] text-muted">{money(perk.cost)}</div>}
              </div>
              {!owned && (
                <Button
                  disabled={locked || !affordable}
                  onClick={() => run(gameActions.buyPerk(state, perk.id))}
                >
                  {locked ? `Lv ${perk.levelRequired}` : affordable ? "Buy" : "🔒"}
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Education (carried over, lightly restyled)
// ---------------------------------------------------------------------------

function EducationSection({ state, run }: { state: GameState; run: RunFn }) {
  const { progression } = state;
  return (
    <section className="space-y-2">
      <SubHeading sub="Credentials gate prestigious careers.">Education</SubHeading>
      {progression.studyingId && (
        <Card className="border-accent/40">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">📚 {educationById(progression.studyingId)?.name}</span>
            <span className="text-muted">{progression.studyTicksRemaining}s left</span>
          </div>
        </Card>
      )}
      {EDUCATION.map((edu) => {
        const owned = progression.credentials.includes(edu.id);
        const gate = canStartStudy(state, edu);
        return (
          <Card key={edu.id} className={owned ? "border-accent-2/30" : ""}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">
                  {edu.name} {owned && <span className="text-accent-2">✓</span>}
                </div>
                <div className="text-[11px] text-muted">{edu.description}</div>
                <div className="mt-1 text-[11px] text-muted">
                  {edu.cost > 0 ? money(edu.cost) : "Free"} · {edu.studyTicks}s study · Lv{" "}
                  {edu.levelRequired}
                </div>
              </div>
              {!owned && (
                <Button disabled={!gate.ok} onClick={() => run(gameActions.studyEducation(state, edu.id))}>
                  {gate.ok ? "Study" : gate.reason}
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Career tracks
// ---------------------------------------------------------------------------

function TracksSection({ state, run }: { state: GameState; run: RunFn }) {
  const tracks = [...CAREER_TRACKS].sort((a, b) => a.prestigeRank - b.prestigeRank);
  return (
    <section className="space-y-2">
      <SubHeading sub="Climb a ladder, or switch tracks.">Career Tracks</SubHeading>
      {tracks.map((t) => {
        const gate = trackUnlocked(state, t);
        const current = state.career.trackId === t.id;
        const topPay = t.levels[t.levels.length - 1].baseSalaryPerTick;
        return (
          <Card key={t.id} className={current ? "border-accent/40" : gate.ok ? "" : "opacity-70"}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{t.name}</div>
                <div className="text-xs text-muted">{t.description}</div>
                <div className="mt-1 text-[11px] text-muted">
                  {t.levels.length} tiers · top pay {money(topPay)}/tick
                </div>
              </div>
              <Button
                variant={current ? "secondary" : "primary"}
                disabled={!gate.ok || current}
                onClick={() => run(gameActions.takeJob(state, t.id))}
              >
                {current ? "Current" : gate.ok ? "Join" : "🔒"}
              </Button>
            </div>
            {!gate.ok && !current && (
              <div className="mt-2 text-[11px] text-danger">Requires: {gate.reason}</div>
            )}
          </Card>
        );
      })}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------------

function SubHeading({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">{children}</div>
      {sub && <div className="text-[11px] text-muted/80">{sub}</div>}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/5 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function Meter({
  label,
  value,
  tone,
  suffix = "",
}: {
  label: string;
  value: number;
  tone: string;
  suffix?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] text-muted">
        <span>{label}</span>
        <span>
          {value.toFixed(0)}
          {suffix}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full ${tone} transition-all`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}
