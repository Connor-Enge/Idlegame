"use client";

import { useGame, gameActions } from "@/lib/store";
import { money } from "@/lib/format";
import { Button, Card, SectionTitle, Pill } from "@/components/ui";
import { CAREER_TRACKS } from "@/lib/game/data";

export default function JobsPage() {
  const state = useGame((s) => s.state);
  const run = useGame((s) => s.run);
  if (!state) return null;

  const { career, stats } = state;
  const track = CAREER_TRACKS.find((t) => t.id === career.trackId);

  return (
    <div className="space-y-3">
      <SectionTitle sub="Trade time for money. Climb the ladder.">Career</SectionTitle>

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

                {next && (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-[11px] text-muted">
                      <span>Promotion to {next.title}</span>
                      <span>
                        {career.shiftsWorked}/{level.promoteAfterShifts} shifts
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    {stats.reputation < next.reputationRequired && (
                      <div className="mt-1 text-[11px] text-danger">
                        Need {Math.ceil(next.reputationRequired - stats.reputation)} more reputation
                      </div>
                    )}
                  </div>
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
                <Button
                  variant="ghost"
                  onClick={() => run(gameActions.quitJob(state))}
                  className="mt-1 w-full"
                >
                  Quit job
                </Button>
              </>
            );
          })()}
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-muted">
            You&apos;re unemployed. Pick a career track below to start earning a salary and build
            reputation.
          </p>
        </Card>
      )}

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">Career Tracks</div>
        {CAREER_TRACKS.map((t) => {
          const entry = t.levels[0];
          const locked = stats.reputation < entry.reputationRequired;
          const current = career.trackId === t.id;
          return (
            <Card key={t.id} className={current ? "border-accent/40" : ""}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-xs text-muted">{t.description}</div>
                  <div className="mt-1 text-[11px] text-muted">
                    {t.levels.length} levels · top pay {money(t.levels[t.levels.length - 1].baseSalaryPerTick)}/tick
                  </div>
                </div>
                <Button
                  variant={current ? "secondary" : "primary"}
                  disabled={locked || current}
                  onClick={() => run(gameActions.takeJob(state, t.id))}
                >
                  {current ? "Current" : locked ? "Locked" : "Join"}
                </Button>
              </div>
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
