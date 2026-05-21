"use client";

import { useMemo, useRef, useState } from "react";
import { useGame } from "@/lib/store";
import { roulette, WHEEL_ORDER, pocketColor } from "@/lib/game/gambling";
import { commitGamble } from "@/lib/game/actions";
import { money } from "@/lib/format";
import { Button } from "@/components/ui";
import WagerInput from "./WagerInput";
import type { GambleResult, RouletteBet } from "@/lib/game/types";

const SIZE = 280;
const R = SIZE / 2;
const SEG = 360 / 37;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180; // 0deg at top
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function sectorPath(i: number): string {
  // Sector i centered at clockwise angle i*SEG + SEG/2 from top.
  const a0 = i * SEG;
  const a1 = (i + 1) * SEG;
  const p0 = polar(R, R, R, a0);
  const p1 = polar(R, R, R, a1);
  return `M ${R} ${R} L ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${R} ${R} 0 0 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} Z`;
}

const COLORS = { red: "#dc2626", black: "#171717", green: "#16a34a" };

function betLabel(bet: RouletteBet): string {
  switch (bet.type) {
    case "number":
      return `Number ${bet.number}`;
    case "dozen":
      return `${ordinal(bet.which)} 12`;
    case "column":
      return `Column ${bet.which}`;
    default:
      return bet.type[0].toUpperCase() + bet.type.slice(1);
  }
}
function ordinal(n: number) {
  return ["", "1st", "2nd", "3rd"][n];
}

export default function Roulette() {
  const state = useGame((s) => s.state)!;
  const run = useGame((s) => s.run);
  const [wager, setWager] = useState(50);
  const [bet, setBet] = useState<RouletteBet>({ type: "red" });
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<GambleResult | null>(null);
  const rotRef = useRef(0);

  const cash = state.stats.cash;
  const sectors = useMemo(() => WHEEL_ORDER.map((n, i) => ({ n, i, path: sectorPath(i), color: pocketColor(n) })), []);

  function spin() {
    if (spinning || wager <= 0 || wager > cash) return;
    setResult(null);
    setSpinning(true);
    const res = roulette(wager, state.stats.luck, bet);
    const idx = WHEEL_ORDER.indexOf(res.outcome!.pocket!);
    const desired = -(idx * SEG + SEG / 2); // end angle (mod 360) to align under top pointer
    const cur = rotRef.current;
    const curMod = ((cur % 360) + 360) % 360;
    const desMod = ((desired % 360) + 360) % 360;
    let delta = desMod - curMod;
    if (delta <= 0) delta += 360;
    const target = cur + 360 * 5 + delta;
    rotRef.current = target;
    setRot(target);
    setTimeout(() => {
      setSpinning(false);
      setResult(res);
      run(commitGamble(state, res));
    }, 4600);
  }

  const sel = (b: RouletteBet) => JSON.stringify(b) === JSON.stringify(bet);

  return (
    <div className="space-y-4">
      {/* Wheel */}
      <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
        {/* pointer */}
        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2">
          <div className="h-0 w-0 border-x-8 border-t-[14px] border-x-transparent border-t-accent" />
        </div>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="wheel" style={{ transform: `rotate(${rot}deg)` }}>
          {sectors.map(({ n, i, path, color }) => {
            const labelPos = polar(R, R, R * 0.82, i * SEG + SEG / 2);
            return (
              <g key={i}>
                <path d={path} fill={COLORS[color]} stroke="#0a0a0f" strokeWidth={0.6} />
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  fill="#fff"
                  fontSize={9}
                  fontWeight={700}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${i * SEG + SEG / 2} ${labelPos.x} ${labelPos.y})`}
                >
                  {n}
                </text>
              </g>
            );
          })}
          <circle cx={R} cy={R} r={R * 0.46} fill="#1b1b2a" stroke="#facc15" strokeWidth={2} />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-2xl">🎯</span>
        </div>
      </div>

      {result && !spinning && (
        <div className={`rounded-xl border p-3 text-center ${result.won ? "border-accent-2/50 flash-win" : "border-danger/50"}`}>
          <div className="text-sm">
            Ball landed on{" "}
            <span
              className="rounded px-2 py-0.5 font-bold text-white"
              style={{ background: COLORS[pocketColor(result.outcome!.pocket!)] }}
            >
              {result.outcome!.pocket}
            </span>
          </div>
          <span className={`text-lg font-bold ${result.won ? "text-accent-2" : "text-danger"}`}>
            {result.won ? `Won ${money(result.payout)}` : `Lost ${money(result.wager)}`}
          </span>
        </div>
      )}

      {/* Betting board */}
      <div className="space-y-2">
        <div className="text-center text-[11px] text-muted">
          Bet: <span className="font-semibold text-white">{betLabel(bet)}</span> · pays{" "}
          {bet.type === "number" ? "36" : bet.type === "dozen" || bet.type === "column" ? "3" : "2"}×
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Chip active={sel({ type: "red" })} onClick={() => setBet({ type: "red" })} color="#dc2626">
            Red
          </Chip>
          <Chip active={sel({ type: "black" })} onClick={() => setBet({ type: "black" })} color="#171717">
            Black
          </Chip>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Chip active={sel({ type: "even" })} onClick={() => setBet({ type: "even" })}>Even</Chip>
          <Chip active={sel({ type: "odd" })} onClick={() => setBet({ type: "odd" })}>Odd</Chip>
          <Chip active={sel({ type: "low" })} onClick={() => setBet({ type: "low" })}>1-18</Chip>
          <Chip active={sel({ type: "high" })} onClick={() => setBet({ type: "high" })}>19-36</Chip>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((w) => (
            <Chip key={w} active={sel({ type: "dozen", which: w as 1 })} onClick={() => setBet({ type: "dozen", which: w as 1 })}>
              {ordinal(w)} 12
            </Chip>
          ))}
        </div>

        {/* Straight-up number grid */}
        <div className="text-center text-[10px] uppercase tracking-wider text-muted">Straight up (36×)</div>
        <div className="grid grid-cols-7 gap-1">
          <button
            onClick={() => setBet({ type: "number", number: 0 })}
            className={`col-span-7 rounded py-1.5 text-xs font-bold text-white ${sel({ type: "number", number: 0 }) ? "ring-2 ring-accent" : ""}`}
            style={{ background: COLORS.green }}
          >
            0
          </button>
          {Array.from({ length: 36 }, (_, k) => k + 1).map((n) => (
            <button
              key={n}
              onClick={() => setBet({ type: "number", number: n })}
              className={`rounded py-1.5 text-[11px] font-bold text-white ${sel({ type: "number", number: n }) ? "ring-2 ring-accent" : ""}`}
              style={{ background: COLORS[pocketColor(n)] }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <WagerInput wager={wager} setWager={setWager} cash={cash} disabled={spinning} />
      <Button className="w-full" disabled={spinning || wager > cash || wager <= 0} onClick={spin}>
        {spinning ? "No more bets…" : `Spin for ${money(wager)}`}
      </Button>
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
  color,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg py-2 text-xs font-bold text-white transition ${active ? "ring-2 ring-accent" : ""} ${color ? "" : "bg-white/10"}`}
      style={color ? { background: color } : undefined}
    >
      {children}
    </button>
  );
}
