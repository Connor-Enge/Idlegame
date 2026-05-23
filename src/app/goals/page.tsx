"use client";

import { useGame } from "@/lib/store";
import { money } from "@/lib/format";
import { Card, Explainer, SectionTitle, ProgressBar } from "@/components/ui";
import { ACHIEVEMENTS, TIER_COLOR } from "@/lib/game/achievements";

export default function GoalsPage() {
  const state = useGame((s) => s.state);
  if (!state) return null;

  const unlocked = new Set(state.progression.achievements);
  const done = unlocked.size;
  const total = ACHIEVEMENTS.length;

  return (
    <div className="space-y-3">
      <SectionTitle sub={`${done} / ${total} unlocked`}>Goals</SectionTitle>

      <Explainer
        title="How goals work"
        steps={[
          { n: "1", icon: "🎯", label: "Hit it", body: "Goals trigger automatically when you meet the condition." },
          { n: "2", icon: "🎁", label: "Reward", body: "Cash, luck, or legacy points apply instantly." },
          { n: "3", icon: "🔓", label: "Permanent", body: "Survive death — earned goals stay across lives." },
        ]}
      />

      <Card>
        <ProgressBar value={(done / total) * 100} />
      </Card>

      <div className="space-y-2">
        {ACHIEVEMENTS.map((a) => {
          const got = unlocked.has(a.id);
          return (
            <Card key={a.id} className={got ? "border-accent-2/30" : "opacity-80"}>
              <div className="flex items-center gap-3">
                <span className={`text-2xl ${got ? "" : "grayscale"}`}>{got ? a.icon : "🔒"}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{a.name}</span>
                    <span className={`text-[10px] uppercase ${TIER_COLOR[a.tier]}`}>{a.tier}</span>
                  </div>
                  <div className="text-[11px] text-muted">{a.description}</div>
                  {a.reward && (
                    <div className="mt-0.5 text-[10px] text-accent">
                      Reward:{" "}
                      {[
                        a.reward.cash && money(a.reward.cash),
                        a.reward.luck && `+${a.reward.luck} luck`,
                        a.reward.legacy && `+${a.reward.legacy} ✨`,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  )}
                </div>
                {got && <span className="text-accent-2">✓</span>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
