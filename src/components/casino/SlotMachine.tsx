"use client";

import { useEffect, useRef, useState } from "react";
import { useGame } from "@/lib/store";
import { commitGamble } from "@/lib/game/actions";
import { SLOT_THEMES, type SlotGame } from "@/lib/game/slots/games";
import { key, type Sym } from "@/lib/game/slots/engine";
import { money } from "@/lib/format";
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
  const [grid, setGrid] = useState<Sym[][]>(() => restingGrid(game));
  const [highlights, setHighlights] = useState<Set<string>>(new Set());
  const [label, setLabel] = useState<string | null>(null);
  const [runningWin, setRunningWin] = useState(0);
  const [ways, setWays] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [done, setDone] = useState<{ win: number; total: number } | null>(null);
  const cancelled = useRef(false);

  const cash = state.stats.cash;
  const cs = cellSize(game.cols);
  const maxRows = Math.max(...grid.map((c) => c.length), 1);

  useEffect(() => {
    return () => {
      cancelled.current = true;
    };
  }, []);

  const rand = () => game.symbols[Math.floor(Math.random() * game.symbols.length)];

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
    const target = result.frames[0].grid;

    // Spin: scramble unlocked reels in place, lock them left-to-right.
    // No remounting — we only swap symbol content, so it stays smooth.
    let locked = 0;
    const iv = setInterval(() => {
      if (cancelled.current) return;
      setGrid(target.map((col, c) => (c < locked ? col.slice() : col.map(() => rand()))));
    }, 55);
    for (let c = 0; c < target.length; c++) {
      await sleep(150);
      if (cancelled.current) return clearInterval(iv);
      locked = c + 1;
    }
    clearInterval(iv);
    setGrid(target.map((c) => c.slice()));

    // Reveal frame 0 wins, then play any cascades / respins / free spins.
    let acc = 0;
    for (let f = 0; f < result.frames.length; f++) {
      if (cancelled.current) return;
      const frame = result.frames[f];
      if (f > 0) {
        setHighlights(new Set());
        setGrid(frame.grid.map((c) => c.slice()));
        setLabel(frame.label ?? null);
        await sleep(420);
        if (cancelled.current) return;
      } else {
        await sleep(180);
      }
      const hls = frame.highlights ?? [];
      if (hls.length) {
        setHighlights(new Set(hls));
        acc += frame.win ?? 0;
        setRunningWin(acc);
        await sleep(680);
        if (cancelled.current) return;
        setHighlights(new Set());
      } else if (frame.win) {
        acc += frame.win;
        setRunningWin(acc);
        await sleep(300);
      }
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
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-lg font-black leading-none" style={cssText(theme.title + `;font-family:${theme.font}`)}>
            {game.name}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-white/60">{game.style}</div>
        </div>
        <span className="text-2xl">{game.icon}</span>
      </div>

      <div className="rounded-xl p-1.5" style={{ background: theme.cabinet }}>
        <div className="rounded-lg p-2" style={{ background: theme.reelBg }}>
          <div className="flex items-start justify-center gap-1.5" style={{ minHeight: maxRows * (cs + 4) }}>
            {grid.map((col, c) => (
              <div key={c} className="flex flex-col gap-1">
                {col.map((sym, r) => {
                  const on = highlights.has(key(c, r));
                  return (
                    <div
                      key={r}
                      className="flex items-center justify-center rounded-md"
                      style={{
                        width: cs,
                        height: cs,
                        background: theme.cellBg,
                        border: `1px solid ${on ? theme.accent : theme.cellBorder}`,
                        boxShadow: on ? `0 0 14px 2px ${theme.winGlow}` : undefined,
                        transition: "box-shadow .15s, border-color .15s",
                      }}
                    >
                      <span
                        style={{
                          fontSize: cs * 0.56,
                          transform: on ? "scale(1.15)" : "scale(1)",
                          transition: "transform .15s",
                        }}
                      >
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

      <div className="mt-2 flex min-h-5 items-center justify-between text-[11px]">
        <span className="text-white/70">{ways != null ? `${ways.toLocaleString()} ways` : game.blurb}</span>
        {label && (
          <span className="font-semibold" style={{ color: theme.accent }}>
            {label}
          </span>
        )}
      </div>

      {game.id === "jackpot" && <JackpotMeters accent={theme.accent} />}

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

      <div className="mt-3 space-y-2">
        <WagerInput wager={wager} setWager={setWager} cash={cash} disabled={spinning} />
        {runningWin > 0 && spinning && (
          <div className="text-center text-sm font-bold" style={{ color: theme.accent }}>
            +{runningWin.toFixed(2)}× so far
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
          <div className="text-[11px] font-bold" style={{ color: accent }}>
            {p.v}
          </div>
        </div>
      ))}
    </div>
  );
}

function restingGrid(game: SlotGame): Sym[][] {
  const rows = game.id === "cluster" ? 7 : game.id === "scatter" ? 5 : game.id === "holdwin" || game.id === "cascade" ? 4 : 3;
  const g: Sym[][] = [];
  for (let c = 0; c < game.cols; c++) {
    const rc = game.id === "megaways" ? 4 : rows;
    const col: Sym[] = [];
    for (let r = 0; r < rc; r++) col.push(game.symbols[Math.floor(Math.random() * game.symbols.length)]);
    g.push(col);
  }
  return g;
}

function cssText(s: string): React.CSSProperties {
  const out: Record<string, string> = {};
  for (const part of s.split(";")) {
    const idx = part.indexOf(":");
    if (idx === -1) continue;
    const prop = part
      .slice(0, idx)
      .trim()
      .replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    out[prop] = part.slice(idx + 1).trim();
  }
  return out as React.CSSProperties;
}
