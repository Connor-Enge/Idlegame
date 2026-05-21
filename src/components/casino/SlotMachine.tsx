"use client";

import { useEffect, useRef, useState } from "react";
import { useGame } from "@/lib/store";
import { commitGamble } from "@/lib/game/actions";
import { SLOT_THEMES, jackpotPots, type SlotGame } from "@/lib/game/slots/games";
import { key, type Sym } from "@/lib/game/slots/engine";
import { money } from "@/lib/format";
import WagerInput from "./WagerInput";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const BUF = 18; // buffer symbols per reel for the scroll
const GAP = 4; // matches gap-1

function cellSize(cols: number): number {
  if (cols <= 3) return 60;
  if (cols <= 5) return 50;
  if (cols === 6) return 44;
  return 38;
}

interface WinTier {
  label: string;
  color: string;
}
function winTier(mult: number): WinTier | null {
  if (mult >= 100) return { label: "EPIC WIN", color: "#f0abfc" };
  if (mult >= 40) return { label: "MEGA WIN", color: "#fde047" };
  if (mult >= 15) return { label: "BIG WIN", color: "#4ade80" };
  return null;
}

function reelDuration(c: number, anticip: boolean): number {
  return 760 + c * 180 + (anticip ? 650 : 0);
}

// Which reels should show anticipation: a reel anticipates when the scatters
// already landed on the reels BEFORE it are one short of the trigger (so a
// scatter on this reel — or a later one — could still complete the bonus).
function anticipationReels(target: Sym[][], scatterSym?: string, trigger?: number): Set<number> {
  const set = new Set<number>();
  if (!scatterSym || !trigger) return set;
  let before = 0;
  for (let c = 0; c < target.length; c++) {
    if (before >= trigger - 1) set.add(c);
    before += target[c].filter((s) => s === scatterSym).length;
  }
  return set;
}

export default function SlotMachine({ game }: { game: SlotGame }) {
  const state = useGame((s) => s.state)!;
  const run = useGame((s) => s.run);
  const theme = SLOT_THEMES[game.id];

  const [wager, setWager] = useState(50);
  const [rows, setRows] = useState<number | undefined>(game.rowOptions ? game.rowOptions[0] : undefined);
  const [mode, setMode] = useState<"grid" | "spin">("grid");
  const [grid, setGrid] = useState<Sym[][]>(() => restingGrid(game));
  const [strips, setStrips] = useState<Sym[][]>([]);
  const [anticip, setAnticip] = useState<Set<number>>(new Set());
  const [reveal, setReveal] = useState({ seq: 0, drop: false });
  const [highlights, setHighlights] = useState<Set<string>>(new Set());
  const [overlays, setOverlays] = useState<Record<string, string>>({});
  const [fallMap, setFallMap] = useState<Record<string, number> | null>(null);
  const [exploding, setExploding] = useState<Set<string>>(new Set());
  const [feature, setFeature] = useState<{ text: string; seq: number } | null>(null);
  const [ways, setWays] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [done, setDone] = useState<{ win: number; mult: number; tier: WinTier | null } | null>(null);
  const [displayWin, setDisplayWin] = useState(0);
  // Lucky Locks (Book of Shadows): lock reels, pay to respin the rest.
  const [keepCols, setKeepCols] = useState<Set<number>>(new Set());
  const [locksOpen, setLocksOpen] = useState(false);
  const [lockedCols, setLockedCols] = useState<Set<number>>(new Set());
  // Red/black gamble.
  const [gamble, setGamble] = useState<{ amount: number; tries: number } | null>(null);
  const cancelled = useRef(false);

  const cash = state.stats.cash;
  const cs = cellSize(game.cols);
  const pitch = cs + GAP;
  const maxRows = Math.max(...(mode === "spin" ? strips.map((s) => s.length - BUF) : grid.map((c) => c.length)), 1);

  useEffect(() => () => void (cancelled.current = true), []);

  // Count-up roll-up when a win resolves.
  useEffect(() => {
    if (!done || done.win <= 0) {
      setDisplayWin(0);
      return;
    }
    let id = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      setDisplayWin(Math.floor(done.win * (1 - Math.pow(1 - p, 3))));
      if (p < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [done]);

  const rand = () => game.symbols[Math.floor(Math.random() * game.symbols.length)];
  const showFeature = (text: string) => setFeature((f) => ({ text, seq: (f?.seq ?? 0) + 1 }));

  // Shadow Rows cost more per spin: 4 rows = +50%, 5 rows = 2x (Book of Shadows).
  const rowMult = game.rowOptions && rows ? (rows >= 5 ? 2 : rows >= 4 ? 1.5 : 1) : 1;

  async function spin(o: { buy?: boolean; preset?: import("@/lib/game/slots/engine").SpinResult; keep?: number[]; stake?: number } = {}) {
    const buy = !!o.buy;
    const keep = o.keep ?? [];
    const stake = o.stake ?? (buy ? wager * (game.buyCost ?? 0) : wager) * rowMult;
    if (spinning || wager <= 0 || stake > cash || (buy && !game.buyCost)) return;
    cancelled.current = false;
    setSpinning(true);
    setDone(null);
    setDisplayWin(0);
    setHighlights(new Set());
    setExploding(new Set());
    setOverlays({});
    setFallMap(null);
    setFeature(null);
    setLocksOpen(false);
    setGamble(null);

    const result = o.preset ?? game.spin(wager, state.stats.luck, { buy, rows });
    setWays(result.ways ?? null);
    const target = result.frames[0].grid;
    const cols = target.length;
    const anticipSet = anticipationReels(target, game.scatterSym, game.scatterTrigger);

    // Locked reels (Lucky Locks respin) don't spin — they stay put.
    setKeepCols(new Set(keep));
    setStrips(target.map((col, c) => (keep.includes(c) ? col.slice() : [...Array.from({ length: BUF }, rand), ...col])));
    setAnticip(anticipSet);
    setMode("spin");

    let maxDur = 0;
    for (let c = 0; c < cols; c++) if (!keep.includes(c)) maxDur = Math.max(maxDur, reelDuration(c, anticipSet.has(c)));
    await sleep(maxDur + 150);
    if (cancelled.current) return;

    // Land on the static grid (no drop — the reels already placed the symbols).
    setGrid(target.map((c) => c.slice()));
    setOverlays(result.frames[0].overlays ?? {});
    setFallMap(null);
    setReveal((s) => ({ seq: s.seq + 1, drop: false }));
    setMode("grid");
    await sleep(140);

    // Present each frame: highlight wins, tumble cascades, feature popups.
    let acc = 0;
    let prev: string[] = [];
    for (let f = 0; f < result.frames.length; f++) {
      if (cancelled.current) return;
      const frame = result.frames[f];
      if (f > 0) {
        if (prev.length) {
          setExploding(new Set(prev));
          await sleep(330);
          if (cancelled.current) return;
        }
        setExploding(new Set());
        setHighlights(new Set());
        setGrid(frame.grid.map((c) => c.slice()));
        setOverlays(frame.overlays ?? {});
        setFallMap(frame.fall ?? null);
        setReveal((s) => ({ seq: s.seq + 1, drop: true }));
        await sleep(470);
        if (cancelled.current) return;
      }
      if (frame.label) showFeature(frame.label);
      const hl = frame.highlights ?? [];
      if (hl.length) {
        setHighlights(new Set(hl));
        acc += frame.win ?? 0;
        await sleep(740);
        prev = hl;
      } else {
        acc += frame.win ?? 0;
        if (frame.label) await sleep(720);
      }
    }

    if (cancelled.current) return;
    setHighlights(new Set());
    const payout = Math.floor(wager * result.totalMult);
    run(
      commitGamble(useGame.getState().state!, {
        game: "slots",
        wager: stake,
        payout,
        net: payout - stake,
        won: payout > 0,
        detail: `${game.name}${result.note ? " — " + result.note : ""}`,
      }),
      { silent: true },
    );
    const tier = winTier(result.totalMult);
    if (result.note) showFeature(result.note);
    setDone({ win: payout, mult: result.totalMult, tier });
    setSpinning(false);

    // Interactive follow-ups (Book of Shadows). FS rounds skip Lucky Locks.
    const isFS = result.frames.length > 1;
    if (game.luckyLocks && !isFS) {
      setLocksOpen(true);
      setLockedCols(new Set());
    }
    if (game.gamble && payout > 0) setGamble({ amount: payout, tries: 0 });
  }

  function toggleLock(c: number) {
    if (spinning || !locksOpen) return;
    setLockedCols((s) => {
      const n = new Set(s);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });
  }

  const lockCost = game.lockCost && locksOpen ? game.lockCost(grid, [...lockedCols], rows ?? 3) : 0;

  function doRespin() {
    if (!game.respin || lockedCols.size === 0) return;
    const locked = [...lockedCols];
    const stake = lockCost * wager;
    if (stake <= 0 || stake > cash) return;
    const preset = game.respin(grid, locked, rows ?? 3);
    spin({ preset, keep: locked, stake });
  }

  function doGamble() {
    if (!gamble) return;
    const amt = gamble.amount;
    const st = useGame.getState().state!;
    const won = Math.random() < 0.5;
    if (won) {
      run(commitGamble(st, { game: "slots", wager: 0, payout: amt, net: amt, won: true, detail: `${game.name} — gamble` }), { silent: true });
      const tries = gamble.tries + 1;
      setDone((d) => (d ? { ...d, win: amt * 2 } : d));
      if (tries >= 5) setGamble(null);
      else setGamble({ amount: amt * 2, tries });
    } else {
      run(commitGamble(st, { game: "slots", wager: amt, payout: 0, net: -amt, won: false, detail: `${game.name} — gamble lost` }), { silent: true });
      setDone((d) => (d ? { ...d, win: 0 } : d));
      setGamble(null);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl p-3" style={{ background: theme.pageBg }}>
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
          <div className="flex items-start justify-center gap-1.5">
            {mode === "spin"
              ? strips.map((strip, c) => {
                  // Held reel (Lucky Locks): show its symbols static, with a lock.
                  if (keepCols.has(c)) {
                    const col = grid[c] ?? strip;
                    return (
                      <div key={c} className="relative flex flex-col gap-1">
                        {col.map((sym, r) => (
                          <div
                            key={r}
                            className="flex items-center justify-center rounded-md"
                            style={{ width: cs, height: cs, background: theme.cellBg, border: `1px solid ${theme.accent}` }}
                          >
                            <span style={{ fontSize: cs * 0.56 }}>{sym}</span>
                          </div>
                        ))}
                        <span className="absolute right-0 top-0 text-[10px]">🔒</span>
                      </div>
                    );
                  }
                  const rows = strip.length - BUF;
                  const isAnticip = anticip.has(c);
                  const dur = reelDuration(c, isAnticip);
                  const dist = BUF * pitch;
                  return (
                    <div
                      key={c}
                      className={`relative overflow-hidden rounded-md ${isAnticip ? "anticip-reel" : ""}`}
                      style={{ width: cs, height: rows * pitch, ["--anticip" as string]: theme.winGlow }}
                    >
                      <div
                        className="flex flex-col gap-1"
                        style={{
                          ["--dist" as string]: `${dist}px`,
                          animation: `reelSpin ${dur}ms cubic-bezier(0.1, 0.62, 0.12, 1) forwards, reelBlur ${dur}ms linear forwards`,
                        }}
                      >
                        {strip.map((sym, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-center rounded-md"
                            style={{ width: cs, height: cs, background: theme.cellBg, border: `1px solid ${theme.cellBorder}` }}
                          >
                            <span style={{ fontSize: cs * 0.56 }}>{sym}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              : grid.map((col, c) => {
                  const locked = locksOpen && lockedCols.has(c);
                  return (
                  <div
                    key={c}
                    onClick={() => toggleLock(c)}
                    className="relative flex flex-col gap-1"
                    style={{
                      minHeight: maxRows * pitch,
                      cursor: locksOpen ? "pointer" : "default",
                      outline: locked ? `3px solid ${theme.accent}` : locksOpen ? "2px dashed rgba(255,255,255,0.25)" : undefined,
                      outlineOffset: locksOpen ? "2px" : undefined,
                      borderRadius: 6,
                      transform: locked ? "scale(0.97)" : undefined,
                      transition: "transform .12s",
                    }}
                  >
                    {locked && (
                      <div
                        className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md"
                        style={{ background: `${theme.accent}22`, border: `1px solid ${theme.accent}` }}
                      >
                        <span className="text-2xl drop-shadow">🔒</span>
                      </div>
                    )}
                    {col.map((sym, r) => {
                      const k = key(c, r);
                      const on = highlights.has(k);
                      const boom = exploding.has(k);
                      const dim = highlights.size > 0 && !on;
                      const badge = overlays[k];
                      // Tumble: this cell fell `fallRows` rows into place. With a
                      // fall map we animate gravity per-cell (static cells don't
                      // move); otherwise a full-board drop (free spins / respins).
                      const tumbling = fallMap != null;
                      const fallRows = tumbling ? fallMap[k] ?? 0 : 0;
                      const animate = tumbling && fallRows > 0 ? "tumbleFall 0.4s cubic-bezier(0.3, 1.1, 0.5, 1) both" : undefined;
                      return (
                        <div
                          key={`${r}-${reveal.seq}`}
                          className={`relative flex items-center justify-center rounded-md ${!tumbling && reveal.drop ? "slot-drop" : ""}`}
                          style={{
                            width: cs,
                            height: cs,
                            background: theme.cellBg,
                            border: `1px solid ${on ? theme.accent : theme.cellBorder}`,
                            boxShadow: on ? `0 0 16px 2px ${theme.winGlow}` : undefined,
                            opacity: dim ? 0.32 : 1,
                            transition: "opacity .2s, box-shadow .15s, border-color .15s",
                            animation: animate,
                            ["--fall" as string]: tumbling ? `${fallRows * pitch}px` : undefined,
                            animationDelay: !tumbling && reveal.drop ? `${c * 0.04 + r * 0.03}s` : undefined,
                          }}
                        >
                          <span
                            className={boom ? "slot-explode-sym" : on ? "slot-win-sym" : ""}
                            style={{ fontSize: cs * 0.56, display: "inline-block" }}
                          >
                            {sym}
                          </span>
                          {badge && (
                            <span
                              className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/4 rounded px-1 text-[9px] font-black leading-tight"
                              style={{ background: theme.accent, color: theme.accentText, fontSize: Math.max(8, cs * 0.2) }}
                            >
                              {badge}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  );
                })}
          </div>
        </div>
      </div>

      <div className="mt-2 flex min-h-5 items-center justify-between text-[11px]">
        <span className="text-white/70">{ways != null ? `${ways.toLocaleString()} ways` : game.blurb}</span>
      </div>

      {game.id === "jackpot" && <JackpotMeters accent={theme.accent} />}

      {/* Fixed-height result slot — always reserved so the buttons never shift. */}
      <div className="mt-2 flex h-12 items-center justify-center">
        {done && (
          <div
            className="flex h-full w-full items-center justify-center rounded-lg px-2 text-center"
            style={{ border: `1px solid ${done.win > 0 ? theme.accent : "rgba(255,255,255,0.15)"}` }}
          >
            {done.win > 0 ? (
              <span className="text-lg font-black" style={{ color: theme.accent }}>
                WIN {money(displayWin)} · {done.mult.toFixed(2)}×
              </span>
            ) : (
              <span className="text-sm text-white/60">No win — spin again</span>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {game.rowOptions && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/60">Shadow Rows</span>
            {game.rowOptions.map((n) => (
              <button
                key={n}
                disabled={spinning}
                onClick={() => setRows(n)}
                className="flex-1 rounded-lg py-1.5 text-xs font-bold transition disabled:opacity-50"
                style={
                  rows === n
                    ? { background: theme.accent, color: theme.accentText }
                    : { background: "rgba(255,255,255,0.08)", color: "#fff" }
                }
              >
                {n} rows · {n >= 5 ? 20 : n >= 4 ? 15 : 10} lines
              </button>
            ))}
          </div>
        )}
        <WagerInput wager={wager} setWager={setWager} cash={cash} disabled={spinning} />

        {/* Red/black gamble (Book of Shadows) — double or nothing, up to 5x. */}
        {gamble && !spinning && (
          <div className="rounded-xl border p-2" style={{ borderColor: theme.accent }}>
            <div className="mb-1 text-center text-[11px] text-white/70">
              Gamble {money(gamble.amount)} · attempt {gamble.tries + 1}/5
            </div>
            <div className="flex gap-2">
              <button onClick={doGamble} className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-black text-white">
                ❤ Red
              </button>
              <button onClick={doGamble} className="flex-1 rounded-lg bg-black py-2 text-sm font-black text-white">
                ♠ Black
              </button>
              <button onClick={() => setGamble(null)} className="rounded-lg bg-white/15 px-3 py-2 text-sm font-bold text-white">
                Collect
              </button>
            </div>
          </div>
        )}

        {/* Lucky Locks (Book of Shadows) — lock reels, pay to respin the rest. */}
        {locksOpen && !spinning && (
          <div className="rounded-xl border p-2" style={{ borderColor: theme.accent, background: `${theme.accent}11` }}>
            <div className="mb-1.5 text-center text-[11px] font-semibold" style={{ color: theme.accent }}>
              🔒 LUCKY LOCKS — tap reels to hold ({lockedCols.size} held), then respin the rest
            </div>
            <button
              onClick={doRespin}
              disabled={lockedCols.size === 0 || lockCost * wager > cash}
              className="w-full rounded-lg py-2.5 text-sm font-black disabled:opacity-40"
              style={{ background: theme.accent, color: theme.accentText }}
            >
              {lockedCols.size === 0
                ? "Tap reels to hold"
                : lockCost * wager > cash
                  ? `Respin needs ${money(lockCost * wager)}`
                  : `RESPIN · ${money(lockCost * wager)} (${lockCost}×)`}
            </button>
          </div>
        )}

        <button
          onClick={() => spin({ buy: false })}
          disabled={spinning || wager * rowMult > cash || wager <= 0}
          className="w-full rounded-xl py-3 text-base font-black disabled:opacity-50"
          style={{ background: theme.accent, color: theme.accentText }}
        >
          {spinning ? "Spinning…" : locksOpen ? `NEW SPIN · ${money(wager * rowMult)}` : `SPIN · ${money(wager * rowMult)}`}
        </button>
        {game.buyCost && (
          <button
            onClick={() => spin({ buy: true })}
            disabled={spinning || wager <= 0 || wager * game.buyCost * rowMult > cash}
            className="w-full rounded-xl border py-2 text-sm font-bold disabled:opacity-40"
            style={{ borderColor: theme.accent, color: theme.accent, background: "transparent" }}
          >
            Buy Bonus · {money(wager * game.buyCost * rowMult)} ({game.buyCost * rowMult}×)
          </button>
        )}
      </div>

      {feature && (
        <div key={feature.seq} className="feature-pop pointer-events-none absolute inset-x-0 top-1/3 z-20 flex justify-center">
          <div className="rounded-xl px-4 py-2 text-center text-base font-black shadow-lg" style={{ background: theme.accent, color: theme.accentText }}>
            {feature.text}
          </div>
        </div>
      )}

      {done?.tier && done.win > 0 && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <CoinShower />
          <div className="bigwin-in text-center">
            <div className="text-3xl font-black" style={{ color: done.tier.color, textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>
              {done.tier.label}
            </div>
            <div className="mt-1 text-2xl font-black text-white" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.7)" }}>
              {money(displayWin)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CoinShower() {
  const coins = Array.from({ length: 16 }, (_, i) => i);
  return (
    <div className="absolute inset-0 overflow-hidden">
      {coins.map((i) => (
        <span
          key={i}
          className="coin-fall text-xl"
          style={{ left: `${(i * 6.3 + 4) % 100}%`, animationDuration: `${1 + (i % 5) * 0.25}s`, animationDelay: `${(i % 7) * 0.08}s` }}
        >
          🪙
        </span>
      ))}
    </div>
  );
}

function JackpotMeters({ accent }: { accent: string }) {
  const live = jackpotPots();
  const pots: { name: string; key: keyof typeof live }[] = [
    { name: "MINI", key: "Mini" },
    { name: "MINOR", key: "Minor" },
    { name: "MAJOR", key: "Major" },
    { name: "GRAND", key: "Grand" },
  ];
  return (
    <div className="mt-2 grid grid-cols-4 gap-1">
      {pots.map((p) => (
        <div key={p.name} className="rounded-md bg-black/30 py-1 text-center">
          <div className="text-[8px] tracking-wider text-white/60">{p.name}</div>
          <div className="text-[11px] font-bold" style={{ color: accent }}>
            {live[p.key].toFixed(1)}×
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
