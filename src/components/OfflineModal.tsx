"use client";

import { useGame } from "@/lib/store";
import { money } from "@/lib/format";
import { Button } from "./ui";

function duration(ticks: number): string {
  const s = ticks;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function OfflineModal() {
  const report = useGame((s) => s.offlineReport);
  const dismiss = useGame((s) => s.dismissOffline);
  if (!report) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <div className="animate-pop w-full max-w-[400px] rounded-2xl border border-white/10 bg-bg-card p-5 text-center">
        <div className="text-3xl">💤</div>
        <h2 className="mt-2 text-lg font-bold">Welcome back</h2>
        <p className="text-xs text-muted">You were away for {duration(report.ticks)}.</p>

        <div className="mt-4 space-y-2 text-left text-sm">
          <Row label="Cash earned" value={money(report.cash)} positive={report.cash >= 0} />
          <Row label="Net worth change" value={money(report.netWorth)} positive={report.netWorth >= 0} />
          <Row label="XP gained" value={`+${Math.round(report.xp)}`} positive />
          {report.levels > 0 && <Row label="Levels gained" value={`+${report.levels}`} positive />}
        </div>

        <Button className="mt-5 w-full" onClick={dismiss}>
          Collect
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
