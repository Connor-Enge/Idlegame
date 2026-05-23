"use client";

import { useState } from "react";
import { useGame, gameActions } from "@/lib/store";
import { money } from "@/lib/format";
import { Button, Card, Pill, ProgressBar } from "@/components/ui";
import { EDUCATION } from "@/lib/game/data";
import { JOBS, JOB_COUNT, jobByIndex, minigameById } from "@/lib/game/careerJobs";
import { currentJob, currentMinigame, jobProgressPct, isFinalJob } from "@/lib/game/career";
import { canStartStudy, educationById, xpToNext } from "@/lib/game/progression";
import { MinigameHost } from "@/components/career/minigames";
import type { GameState } from "@/lib/game/types";

export default function JobsPage() {
  const state = useGame((s) => s.state);
  const run = useGame((s) => s.run);
  // null = hub view; a number = playing that job index (the current frontier
  // job, or any previously-cleared job replayed for cash + XP).
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);

  if (!state) return null;

  const job = currentJob(state);

  if (playingIdx !== null) {
    const playJob = jobByIndex(playingIdx);
    return (
      <div className="pb-4">
        <MinigameHost
          job={playJob}
          onFinish={(points) => {
            // Pull the latest state so a tick mid-round doesn't get overwritten.
            const latest = useGame.getState().state;
            if (latest) run(gameActions.workJob(latest, points, playingIdx));
            setPlayingIdx(null);
          }}
          onCancel={() => setPlayingIdx(null)}
        />
      </div>
    );
  }

  const { career, progression } = state;
  const mg = currentMinigame(state);
  const pct = jobProgressPct(state) * 100;
  const final = isFinalJob(state);
  const xpPct = (progression.xp / xpToNext(progression.level)) * 100;
  const perRound = Math.round(mg.basePoints * job.cashPerPoint);

  // Promotion gating: hit the goal AND have any required credential on the
  // next job. When goal is met but a credential is missing, the chain pauses
  // here until they study it.
  const goalMet = !final && career.progress >= job.goal;
  const nextJob = final ? null : JOBS[career.jobIndex + 1];
  const nextCred = nextJob?.requiresCredential;
  const credHeld = !nextCred || progression.credentials.includes(nextCred);
  const credName = nextCred ? educationById(nextCred)?.name : null;

  return (
    <div className="pb-4">
      {/* Header: where you are on the ladder + global level */}
      <div className="mb-3 mt-1 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight">Career</h1>
          <p className="truncate text-xs text-muted">
            Job {career.jobIndex + 1} of {JOB_COUNT} · Lv {progression.level}
          </p>
        </div>
        <div className="w-24 shrink-0">
          <div className="mb-1 text-right text-[10px] text-muted">
            {progression.xp.toFixed(0)}/{xpToNext(progression.level)} XP
          </div>
          <ProgressBar value={xpPct} />
        </div>
      </div>

      {/* Current job */}
      <Card className="border-accent/30">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{job.icon}</span>
            <div>
              <div className="text-lg font-bold leading-tight">{job.title}</div>
              <div className="text-[11px] text-muted">{mg.name} · ~{money(perRound)}/round</div>
            </div>
          </div>
          <Pill tone="up">#{career.jobIndex + 1}</Pill>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex justify-between text-[11px] text-muted">
            <span>{final ? "Career maxed" : "Goal to unlock next job"}</span>
            <span>
              {Math.floor(career.progress)}/{job.goal} {mg.unit}
            </span>
          </div>
          <ProgressBar value={pct} />
        </div>

        <p className="mt-3 text-xs text-muted">{mg.blurb}</p>

        {/* Credential gate: goal hit but next job needs a license you don't have. */}
        {goalMet && !credHeld && (
          <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs">
            <div className="font-bold text-amber-200">🔒 Promotion blocked</div>
            <div className="mt-1 text-amber-100/90">
              Earn <span className="font-bold">{credName ?? nextCred}</span> to unlock {nextJob?.icon} {nextJob?.title}. Study below.
            </div>
          </div>
        )}

        {goalMet && credHeld ? (
          <Button className="mt-4 w-full" onClick={() => run(gameActions.promote(state))}>
            🎉 Claim promotion to {nextJob?.icon} {nextJob?.title}
          </Button>
        ) : (
          <Button className="mt-4 w-full" onClick={() => setPlayingIdx(career.jobIndex)}>
            ▶️ Work — play {mg.name}
          </Button>
        )}
      </Card>

      {/* What's next on the ladder */}
      {!final && (
        <section className="mt-4 space-y-2">
          <SubHeading sub="Hit each job's goal to unlock the next.">Coming up</SubHeading>
          {JOBS.slice(career.jobIndex + 1, career.jobIndex + 6).map((j) => {
            const jmg = minigameById(j.minigameId);
            const credShort = j.requiresCredential ? educationById(j.requiresCredential)?.short ?? j.requiresCredential : null;
            const credMissing = j.requiresCredential && !progression.credentials.includes(j.requiresCredential);
            return (
              <div key={j.index} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2 opacity-80">
                <span className="text-2xl grayscale">{j.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    #{j.index + 1} {j.title}
                  </div>
                  <div className="text-[11px] text-muted">
                    {jmg.name} · goal {j.goal} {jmg.unit}
                    {credShort && (
                      <span className={`ml-2 font-semibold ${credMissing ? "text-amber-300" : "text-accent-2"}`}>
                        · 🪪 {credShort}{credMissing ? "" : " ✓"}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-muted">🔒</span>
              </div>
            );
          })}
        </section>
      )}

      {/* Already cleared — tap any to replay it for cash + XP (no chain progress). */}
      {career.jobIndex > 0 && (
        <section className="mt-4 space-y-2">
          <SubHeading sub="Tap to replay for cash + XP (doesn't advance the chain).">
            Cleared ({career.jobIndex})
          </SubHeading>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
            {JOBS.slice(0, career.jobIndex).map((j) => (
              <button
                key={j.index}
                onPointerDown={() => setPlayingIdx(j.index)}
                title={`#${j.index + 1} ${j.title}`}
                className="flex flex-col items-center gap-0.5 rounded-xl bg-white/5 px-2 py-2 active:bg-white/10"
              >
                <span className="text-xl">{j.icon}</span>
                <span className="text-[9px] text-muted">#{j.index + 1}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <LicensesSection state={state} run={run} />
    </div>
  );
}

type RunFn = ReturnType<typeof useGame.getState>["run"];

// Optional licenses/credentials, kept for the investing & real-estate gates.
// These no longer gate careers — purely a side path you can ignore.
function LicensesSection({ state, run }: { state: GameState; run: RunFn }) {
  const { progression } = state;
  return (
    <section className="mt-5 space-y-2">
      <SubHeading sub="Optional — unlock licensed investments and commercial property.">
        Education &amp; Licenses
      </SubHeading>
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
                  {edu.cost > 0 ? money(edu.cost) : "Free"} · {edu.studyTicks}s study · Lv {edu.levelRequired}
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

function SubHeading({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">{children}</div>
      {sub && <div className="text-[11px] text-muted/80">{sub}</div>}
    </div>
  );
}
