"use client";

import { useGame } from "@/lib/store";
import { money } from "@/lib/format";
import { Button } from "./ui";

export default function DeathModal() {
  const report = useGame((s) => s.state?.life.deathReport ?? null);
  const generation = useGame((s) => s.state?.life.generation ?? 1);
  const dismiss = useGame((s) => s.dismissDeath);
  if (!report) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6">
      <div className="animate-pop w-full max-w-[400px] rounded-2xl border border-white/10 bg-bg-card p-5 text-center">
        <div className="text-4xl">⚰️</div>
        <h2 className="mt-2 text-lg font-bold">You died at {report.age}</h2>
        <p className="text-xs text-muted">
          A life well gambled. Your estate is settled and a new heir takes over.
        </p>

        <div className="mt-4 space-y-2 text-left text-sm">
          <Row label="Final net worth" value={money(report.netWorth)} positive />
          <Row label="Legacy credits earned" value={`+${report.credits}`} positive />
          <Row label="Next generation" value={`#${generation}`} positive />
        </div>

        <p className="mt-4 text-xs text-muted">
          Legacy credits permanently boost income across every life.
        </p>

        <Button className="mt-5 w-full" onClick={dismiss}>
          Begin a new life
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
      <span className="text-muted">{label}</span>
      <span className={`font-semibold ${positive ? "text-accent-2" : "text-danger"}`}>{value}</span>
    </div>
  );
}
