"use client";

import Link from "next/link";
import { useGame } from "@/lib/store";
import { money } from "@/lib/format";
import { Card, SectionTitle, Pill } from "@/components/ui";
import { BUSINESS_TYPES, CAREER_TRACKS, PROPERTIES } from "@/lib/game/data";

export default function HomePage() {
  const state = useGame((s) => s.state);
  if (!state) return null;

  const { stats, career, economy, holdings, properties, businesses } = state;

  const track = CAREER_TRACKS.find((t) => t.id === career.trackId);
  const jobTitle = track ? track.levels[career.levelIndex].title : "Unemployed";

  const holdingsValue = holdings.reduce((sum, h) => {
    const a = state.assets.find((x) => x.id === h.assetId);
    return sum + (a ? a.price * h.quantity : 0);
  }, 0);
  const realEstateValue = properties.reduce((s, p) => s + p.currentValue - p.mortgageRemaining, 0);
  const bizValue = businesses.reduce((s, b) => {
    const def = BUSINESS_TYPES.find((x) => x.id === b.businessId);
    return s + (def ? def.startupCost * b.level * 0.8 : 0);
  }, 0);

  return (
    <div className="space-y-3">
      <SectionTitle sub="Your empire, at a glance">Gambler&apos;s Paradise</SectionTitle>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted">Total Net Worth</div>
            <div className="text-3xl font-extrabold text-accent-2">{money(stats.netWorth)}</div>
          </div>
          <Pill tone={economy.marketSentiment >= 0 ? "up" : "down"}>{economy.phase}</Pill>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <Breakdown label="Cash" value={money(stats.cash)} />
          <Breakdown label="Investments" value={money(holdingsValue)} />
          <Breakdown label="Real Estate" value={money(realEstateValue)} />
          <Breakdown label="Businesses" value={money(bizValue)} />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Tile href="/jobs" icon="💼" title={jobTitle} sub="Career" />
        <Tile href="/gambling" icon="🎰" title="Casino" sub="Push your luck" />
        <Tile href="/invest" icon="📈" title={`${holdings.length} positions`} sub="Markets" />
        <Tile href="/realestate" icon="🏘️" title={`${properties.length} props`} sub="Real estate" />
        <Tile href="/business" icon="🏢" title={`${businesses.length} owned`} sub="Businesses" />
        <Tile href="/economy" icon="🌍" title="Economy" sub="Macro & events" />
      </div>

      {economy.activeEvents.length > 0 && (
        <Card>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Breaking News
          </div>
          <ul className="space-y-2">
            {economy.activeEvents.map((e) => (
              <li key={e.id} className="text-sm">
                <span className="font-semibold text-accent">{e.title}</span>
                <span className="text-muted"> — {e.description}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Breakdown({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/5 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function Tile({ href, icon, title, sub }: { href: string; icon: string; title: string; sub: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-2xl border border-white/5 bg-bg-card p-4 active:scale-[0.98] transition"
    >
      <span className="text-2xl">{icon}</span>
      <span className="truncate text-sm font-semibold">{title}</span>
      <span className="text-[11px] text-muted">{sub}</span>
    </Link>
  );
}
