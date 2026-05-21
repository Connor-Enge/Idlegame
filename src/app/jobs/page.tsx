"use client";

import { useGame, gameActions } from "@/lib/store";
import { money } from "@/lib/format";
import { Button, Card, SectionTitle, Pill, ProgressBar } from "@/components/ui";
import { CAREER_TRACKS, EDUCATION } from "@/lib/game/data";
import { canStartStudy, educationById, trackUnlocked, xpToNext } from "@/lib/game/progression";

export default function JobsPage() {
  const state = useGame((s) => s.state);
  const run = useGame((s) => s.run);
  if (!state) return null;

  const { career, stats, progression } = state;
  const track = CAREER_TRACKS.find((t) => t.id === career.trackId);
  const tracks = [...CAREER_TRACKS].sort((a, b) => a.prestigeRank - b.prestigeRank);

  return (
    <div className="space-y-3">
      <SectionTitle sub={`Level ${progression.level} · ${progression.xp}/${xpToNext(progression.level)} XP`}>
        Career
      </SectionTitle>

      {track ? (
        <Card>
          {(() => {
            const level = track.levels[career.levelIndex];
            const next = track.levels[career.levelIndex + 1];
            const progress = Math.min(100, (career.shiftsWorked / level.promoteAfterShifts) * 100);
            return (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted">{track.name}</div>
                    <div className="text-lg font-bold">{level.title}</div>
                  </div>
                  <Pill tone="up">Tier {level.tier}</Pill>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <Info label="Passive / tick" value={money(level.baseSalaryPerTick)} />
                  <Info label="Shift pays" value={money(level.baseSalaryPerTick * 8)} />
                  <Info label="Energy / shift" value={`${level.energyCostPerShift}⚡`} />
                  <Info label="Shifts worked" value={`${career.shiftsWorked}`} />
                </div>

                {next ? (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-[11px] text-muted">
                      <span>Promotion to {next.title}</span>
                      <span>
                        {career.shiftsWorked}/{level.promoteAfterShifts} shifts
                      </span>
                    </div>
                    <ProgressBar value={progress} />
                    {stats.reputation < next.reputationRequired && (
                      <div className="mt-1 text-[11px] text-danger">
                        Need {Math.ceil(next.reputationRequired - stats.reputation)} more reputation
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 text-[11px] text-accent-2">Top of the ladder. Time to retire?</div>
                )}

                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={() => run(gameActions.workShift(state))}
                    disabled={stats.energy < level.energyCostPerShift}
                    className="flex-1"
                  >
                    Work a Shift
                  </Button>
                  <Button variant="secondary" onClick={() => run(gameActions.rest(state))}>
                    Rest
                  </Button>
                </div>
                <Button variant="ghost" onClick={() => run(gameActions.quitJob(state))} className="mt-1 w-full">
                  Quit job
                </Button>
              </>
            );
          })()}
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-muted">
            You&apos;re unemployed. Service work is open to anyone — better careers need
            qualifications. Study below to unlock them.
          </p>
        </Card>
      )}

      {/* Education */}
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">Education</div>
        {progression.studyingId && (
          <Card className="border-accent/40">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">📚 Studying: {educationById(progression.studyingId)?.name}</span>
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
                  <Button
                    disabled={!gate.ok}
                    onClick={() => run(gameActions.studyEducation(state, edu.id))}
                  >
                    {gate.ok ? "Study" : gate.reason}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Career tracks */}
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">Career Tracks</div>
        {tracks.map((t) => {
          const gate = trackUnlocked(state, t);
          const current = career.trackId === t.id;
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
      </div>
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
