"use client";

import Link from "next/link";
import { useGame, gameActions } from "@/lib/store";
import { money } from "@/lib/format";
import { Button, Card, Explainer, SectionTitle, Pill, ProgressBar } from "@/components/ui";
import { BUSINESS_TYPES, FEATURE_UNLOCKS, RETIRE_THRESHOLD } from "@/lib/game/data";
import { jobByIndex } from "@/lib/game/careerJobs";
import { canRetire, hasFeature, legacyGain, nextUnlock, xpToNext } from "@/lib/game/progression";

export default function HomePage() {
  const state = useGame((s) => s.state);
  const run = useGame((s) => s.run);
  if (!state) return null;

  const { stats, career, economy, holdings, properties, businesses, progression } = state;

  const jobTitle = jobByIndex(career.jobIndex).title;
  const nu = nextUnlock(state);
  const retireReady = canRetire(state);

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

      <Explainer
        title="How the game works"
        steps={[
          { n: "1", icon: "💼", label: "Earn", body: "Climb the career chain (active) or stack businesses & investments (passive)." },
          { n: "2", icon: "📈", label: "Grow", body: "Cash unlocks investing → real estate → businesses by net-worth gates." },
          { n: "3", icon: "✨", label: "Retire", body: "Reset for Legacy Points — permanent +2% income each, forever." },
        ]}
        rules={[
          "Lives are short (~37 min) — death is automatic. Net worth converts to Legacy Points and a new life starts.",
          "Tiles with 🔒 need a higher net worth before they unlock.",
        ]}
      />

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

      {/* Level + next unlock */}
      <Card>
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">Level {progression.level}</span>
          <span className="text-[11px] text-muted">
            {progression.xp.toFixed(2)}/{xpToNext(progression.level)} XP
            {progression.legacyPoints > 0 && ` · ✨ ${progression.legacyPoints} legacy`}
          </span>
        </div>
        <ProgressBar className="mt-2" value={(progression.xp / xpToNext(progression.level)) * 100} />
        {nu && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[11px] text-muted">
              <span>Next unlock: {nu.label}</span>
              <span>{money(stats.netWorth)} / {money(nu.netWorth)}</span>
            </div>
            <ProgressBar value={(stats.netWorth / nu.netWorth) * 100} />
          </div>
        )}
      </Card>

      {/* Prestige */}
      {(retireReady || progression.retirements > 0) && (
        <Card className={retireReady ? "border-accent/40" : ""}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Retire &amp; Reinvest</div>
              <div className="text-[11px] text-muted">
                {progression.retirements > 0 && `Retired ${progression.retirements}× · `}
                Each Legacy Point = +2% income, forever.
              </div>
            </div>
            <span className="text-2xl">✨</span>
          </div>
          {retireReady ? (
            <Button
              className="mt-3 w-full"
              onClick={() => {
                if (confirm(`Retire now for +${legacyGain(stats.netWorth)} Legacy Points? This resets your run.`))
                  run(gameActions.retire(state));
              }}
            >
              Retire for +{legacyGain(stats.netWorth)} ✨
            </Button>
          ) : (
            <div className="mt-3 text-[11px] text-muted">
              Reach {money(RETIRE_THRESHOLD)} net worth to retire again.
            </div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Tile href="/jobs" icon="💼" title={jobTitle} sub="Career" />
        <Tile href="/gambling" icon="🎰" title="Casino" sub="Push your luck" />
        <Tile
          href="/invest"
          icon="📈"
          title={hasFeature(state, "invest") ? `${holdings.length} positions` : "Locked"}
          sub={hasFeature(state, "invest") ? "Markets" : `🔒 ${money(featureCost("invest"))} net worth`}
          locked={!hasFeature(state, "invest")}
        />
        <Tile
          href="/realestate"
          icon="🏘️"
          title={hasFeature(state, "realestate") ? `${properties.length} props` : "Locked"}
          sub={hasFeature(state, "realestate") ? "Real estate" : `🔒 ${money(featureCost("realestate"))} net worth`}
          locked={!hasFeature(state, "realestate")}
        />
        <Tile
          href="/business"
          icon="🏢"
          title={hasFeature(state, "business") ? `${businesses.length} owned` : "Locked"}
          sub={hasFeature(state, "business") ? "Businesses" : `🔒 ${money(featureCost("business"))} net worth`}
          locked={!hasFeature(state, "business")}
        />
        <Tile href="/economy" icon="🌍" title="Economy" sub="Macro & events" />
        <Tile href="/goals" icon="🏆" title={`${progression.achievements.length} unlocked`} sub="Goals" />
        <Tile href="/leaderboard" icon="📊" title="Leaderboard" sub="Top players" />
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

function featureCost(flag: "invest" | "business" | "realestate"): number {
  return FEATURE_UNLOCKS.find((r) => r.flag === flag)?.netWorth ?? 0;
}

function Tile({
  href,
  icon,
  title,
  sub,
  locked,
}: {
  href: string;
  icon: string;
  title: string;
  sub: string;
  locked?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col gap-1 rounded-2xl border border-white/5 bg-bg-card p-4 active:scale-[0.98] transition ${locked ? "opacity-70 grayscale" : ""}`}
    >
      <span className="text-2xl">{icon}</span>
      <span className="truncate text-sm font-semibold">{title}</span>
      <span className={`text-[11px] ${locked ? "text-amber-300" : "text-muted"}`}>{sub}</span>
    </Link>
  );
}
