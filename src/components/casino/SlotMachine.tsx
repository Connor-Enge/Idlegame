"use client";

import { useEffect, useRef, useState } from "react";
import { useGame } from "@/lib/store";
import { commitGamble } from "@/lib/game/actions";
import { SLOT_THEMES, type SlotGame } from "@/lib/game/slots/games";
import { key, type Frame, type Sym } from "@/lib/game/slots/engine";
import { money } from "@/lib/format";
import { Button } from "@/components/ui";
import WagerInput from "./WagerInput";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function cellSize(cols: number): number {
  if (cols <= 3) return 60;
  if (cols <= 5) return 50;
  if (cols === 6) return 44;
  return 38;
}

export default function SlotMachine({ game }: { game: SlotGame }) {
  const state = useGame((s) => s.state)!;
  const run = useGame((s) => s.run);
  const theme = SLOT_THEMES[game.id];

  const [wager, setWager] = useState(50);
  const [grid, setGrid] = useState<Sym[][]>(() => randomShaped(game));
  const [highlights, setHighlights] = useState<Set<string>>(new Set());
  const [label, setLabel] = useState<string | null>(null);
  const [runningWin, setRunningWin] = useState(0);
  const [ways, setWays] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [done, setDone] = useState<{ win: number; total: number } | null>(null);
  const [seq, setSeq] = useState(0);
  const cancelled = useRef(false);

  const cash = state.stats.cash;
  const cs = cellSize(game.cols);
  const maxRows = Math.max(...grid.map((c) => c.length));

  useEffect(() => {
    return () => {
      cancelled.current = true;
    };
  }, []);

  async function spin() {
    if (spinning || wager <= 0 || wager > cash) return;
    cancelled.current = false;
    setSpinning(true);
    setDone(null);
    setRunningWin(0);
    setHighlights(new Set());
    setLabel(null);

    const result = game.spin(wager, state.stats.luck);
    setWays(result.ways ?? null);

    // Scramble the reels for a beat.
    const shape = result.frames[0].grid;
    for (let i = 0; i < 9; i++) {
      if (cancelled.current) return;
      setGrid(shape.map((col) => col.map(() => game.symbols[Math.floor(Math.random() * game.symbols.length)])));
      setSeq((s) => s + 1);
      await sleep(70);
    }

    // Play each frame in sequence.
    let acc = 0;
    for (let f = 0; f < result.frames.length; f++) {
      if (cancelled.current) return;
      const frame: Frame = result.frames[f];
      setGrid(frame.grid.map((c) => [...c]));
      setSeq((s) => s + 1);
      setLabel(frame.label ?? null);
      // brief beat, then flash wins
      await sleep(f === 0 ? 260 : 520);
      if (cancelled.current) return;
      if (frame.highlights && frame.highlights.length) setHighlights(new Set(frame.highlights));
      acc += frame.win ?? 0;
      setRunningWin(acc);
      await sleep(frame.highlights && frame.highlights.length ? 620 : 120);
      setHighlights(new Set());
    }

    if (cancelled.current) return;
    const payout = Math.floor(wager * result.totalMult);
    run(
      commitGamble(state, {
        game: "slots",
        wager,
        payout,
        net: payout - wager,
        won: payout > 0,
        detail: `${game.name}${result.note ? " — " + result.note : ""}`,
      }),
    );
    setLabel(result.note ?? null);
    setDone({ win: payout, total: result.totalMult });
    setSpinning(false);
  }

  return (
    <div className="rounded-2xl p-3" style={{ background: theme.pageBg }}>
      {/* Title bar */}
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-lg font-black leading-none" style={cssText(theme.title + `;font-family:${theme.font}`)}>
            {game.name}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-white/60">{game.style}</div>
        </div>
        <span className="text-2xl">{game.icon}</span>
      </div>

      {/* Cabinet + reels */}
      <div className="rounded-xl p-1.5" style={{ background: theme.cabinet }}>
        <div className="rounded-lg p-2" style={{ background: theme.reelBg }}>
          <div className="flex items-start justify-center gap-1.5" style={{ minHeight: maxRows * (cs + 4) }}>
            {grid.map((col, c) => (
              <div key={c} className="flex flex-col gap-1">
                {col.map((sym, r) => {
                  const on = highlights.has(key(c, r));
                  return (
                    <div
                      key={`${c}-${r}-${seq}`}
                      className="card-deal flex items-center justify-center rounded-md"
                      style={{
                        width: cs,
                        height: cs,
                        background: theme.cellBg,
                        border: `1px solid ${on ? theme.accent : theme.cellBorder}`,
                        boxShadow: on ? `0 0 14px 2px ${theme.winGlow}` : undefined,
                        animationDelay: `${c * 0.05}s`,
                      }}
                    >
                      <span style={{ fontSize: cs * 0.56, transform: on ? "scale(1.12)" : undefined, transition: "transform .15s" }}>
                        {sym}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Feature strip + status */}
      <div className="mt-2 flex min-h-5 items-center justify-between text-[11px]">
        <span className="text-white/70">
          {ways != null ? `${ways.toLocaleString()} ways` : game.blurb}
        </span>
        {label && <span className="font-semibold" style={{ color: theme.accent }}>{label}</span>}
      </div>

      {game.id === "jackpot" && <JackpotMeters accent={theme.accent} />}

      {/* Win banner */}
      {done && (
        <div
          className="mt-2 rounded-lg p-2 text-center"
          style={{ border: `1px solid ${done.win > 0 ? theme.accent : "rgba(255,255,255,0.15)"}` }}
        >
          {done.win > 0 ? (
            <span className="text-lg font-black" style={{ color: theme.accent }}>
              WIN {money(done.win)} · {done.total.toFixed(2)}×
            </span>
          ) : (
            <span className="text-sm text-white/60">No win — spin again</span>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="mt-3 space-y-2">
        <WagerInput wager={wager} setWager={setWager} cash={cash} disabled={spinning} />
        {runningWin > 0 && spinning && (
          <div className="text-center text-sm font-bold" style={{ color: theme.accent }}>
            +{(runningWin).toFixed(2)}× so far
          </div>
        )}
        <button
          onClick={spin}
          disabled={spinning || wager > cash || wager <= 0}
          className="w-full rounded-xl py-3 text-base font-black disabled:opacity-50"
          style={{ background: theme.accent, color: theme.accentText }}
        >
          {spinning ? "Spinning…" : `SPIN · ${money(wager)}`}
        </button>
      </div>
    </div>
  );
}

function JackpotMeters({ accent }: { accent: string }) {
  const pots = [
    { name: "MINI", v: "2×" },
    { name: "MINOR", v: "8×" },
    { name: "MAJOR", v: "81×" },
    { name: "GRAND", v: "810×" },
  ];
  return (
    <div className="mt-2 grid grid-cols-4 gap-1">
      {pots.map((p) => (
        <div key={p.name} className="rounded-md bg-black/30 py-1 text-center">
          <div className="text-[8px] tracking-wider text-white/60">{p.name}</div>
          <div className="text-[11px] font-bold" style={{ color: accent }}>{p.v}</div>
        </div>
      ))}
    </div>
  );
}

function randomShaped(game: SlotGame): Sym[][] {
  // A reasonable resting grid before the first spin.
  const rows = game.id === "cluster" ? 7 : game.id === "scatter" ? 5 : game.id === "holdwin" || game.id === "cascade" ? 4 : 3;
  const cols = game.cols;
  const g: Sym[][] = [];
  for (let c = 0; c < cols; c++) {
    const col: Sym[] = [];
    const rc = game.id === "megaways" ? 3 + Math.floor(Math.random() * 3) : rows;
    for (let r = 0; r < rc; r++) col.push(game.symbols[Math.floor(Math.random() * game.symbols.length)]);
    g.push(col);
  }
  return g;
}

// Parse a "prop:value;prop:value" string into a React style object.
function cssText(s: string): React.CSSProperties {
  const out: Record<string, string> = {};
  for (const part of s.split(";")) {
    const idx = part.indexOf(":");
    if (idx === -1) continue;
    const prop = part.slice(0, idx).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    out[prop] = part.slice(idx + 1).trim();
  }
  return out as React.CSSProperties;
}
