"use client";

import { useEffect, useState } from "react";
import { useGame } from "@/lib/store";
import { money } from "@/lib/format";
import { Card, SectionTitle } from "@/components/ui";

interface Row {
  id: string;
  email: string;
  peakNetWorth: number;
  netWorth: number;
}

// Show the local part of the email as a username (alice@x.com -> "alice"),
// truncated so very long handles still fit on mobile.
function usernameFor(email: string): string {
  const local = email.split("@")[0] || email;
  return local.length > 18 ? local.slice(0, 17) + "…" : local;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const account = useGame((s) => s.account);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/leaderboard")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (!cancelled) setRows(Array.isArray(data.leaderboard) ? data.leaderboard : []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-3">
      <SectionTitle sub="Highest net worth ever reached — across every life.">Leaderboard</SectionTitle>

      {rows === null && !error && (
        <Card><p className="text-sm text-muted">Loading…</p></Card>
      )}

      {error && (
        <Card><p className="text-sm text-danger">Couldn&apos;t load: {error}</p></Card>
      )}

      {rows && rows.length === 0 && (
        <Card>
          <p className="text-sm text-muted">
            No registered players yet. Create an account on the{" "}
            <a href="/account" className="text-accent underline">Account page</a> to claim your spot.
          </p>
        </Card>
      )}

      {rows && rows.length > 0 && (
        <Card className="p-0">
          <ul>
            {rows.map((r, i) => {
              const isMe = account?.id === r.id;
              return (
                <li
                  key={r.id}
                  className={`flex items-center gap-3 border-b border-white/5 px-4 py-3 last:border-b-0 ${isMe ? "bg-accent/10" : ""}`}
                >
                  <span className="w-8 shrink-0 text-center text-lg font-bold">
                    {i < 3 ? MEDALS[i] : <span className="text-muted">{i + 1}</span>}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {usernameFor(r.email)}
                    {isMe && <span className="ml-2 text-[10px] uppercase tracking-wider text-accent">you</span>}
                  </span>
                  <span className="shrink-0 text-right text-sm font-bold text-accent-2">
                    {money(r.peakNetWorth)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <p className="px-2 text-[11px] text-muted">
        Only registered players appear. Sign in to track your peak and climb the board.
      </p>
    </div>
  );
}
