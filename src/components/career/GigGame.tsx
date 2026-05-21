"use client";

import { useState } from "react";
import { useGame, gameActions } from "@/lib/store";
import { money } from "@/lib/format";
import { Button } from "@/components/ui";
import TimingBar from "./TimingBar";
import { getSkillLevel, qualityFromPosition, zonesForSkill } from "@/lib/game/career";
import { GIGS, SKILLS } from "@/lib/game/careerData";
import type { GigResult } from "@/lib/game/types";

export default function GigGame({ gigId, onExit }: { gigId: string; onExit: () => void }) {
  const run = useGame((s) => s.run);
  const startState = useGame.getState().state!;
  const gig = GIGS.find((g) => g.id === gigId)!;
  const skill = SKILLS.find((s) => s.id === gig.skillId);
  const skillLvl = getSkillLevel(startState, gig.skillId);
  const zones = zonesForSkill(skillLvl);

  const [frozen, setFrozen] = useState<number | null>(null);
  const [result, setResult] = useState<GigResult | null>(null);

  function handleStop(pos: number) {
    setFrozen(pos);
    const fresh = useGame.getState().state!;
    const res = gameActions.commitGig(fresh, gigId, pos);
    run(res, { silent: true });
    setResult(res.gig ?? null);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/5 bg-bg-card p-4 text-center">
        <div className="text-3xl">{gig.icon}</div>
        <div className="mt-1 text-lg font-bold">{gig.name}</div>
        <div className="text-xs text-muted">{gig.description}</div>
        <div className="mt-1 text-[11px] text-accent">
          {skill?.name} · Lv {skillLvl}
        </div>
      </div>

      {result ? (
        <>
          <div className="rounded-2xl border border-white/5 bg-bg-card p-5 text-center">
            <div className="text-3xl font-extrabold text-accent-2">+{money(result.cash)}</div>
            <div className="mt-1 text-xs text-muted">
              {skill?.name} +{result.skillXp.toFixed(0)} · 🏅 +{result.reputation}
            </div>
          </div>
          <Button className="w-full" onClick={onExit}>
            Done
          </Button>
        </>
      ) : (
        <>
          <TimingBar
            zones={zones}
            frozen={frozen}
            quality={frozen != null ? qualityFromPosition(frozen, zones) : null}
            speed={130}
            buttonLabel="GO"
            onStop={handleStop}
          />
          <p className="text-center text-[11px] text-muted">
            One shot — land it in the center for top pay.
          </p>
          <button onClick={onExit} className="w-full text-center text-xs text-muted active:text-white">
            Cancel
          </button>
        </>
      )}
    </div>
  );
}
