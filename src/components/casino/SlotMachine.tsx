"use client";

import { useEffect, useRef, useState } from "react";
import { useGame } from "@/lib/store";
import { commitGamble } from "@/lib/game/actions";
import { SLOT_THEMES, type SlotGame } from "@/lib/game/slots/games";
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

function reelDuration(c: number, lastCol: number, feature: boolean): number {
  return 760 + c * 180 + (feature && c === lastCol ? 800 : 0);
}

export default function SlotMachine({ game }: { game: SlotGame }) {
  const state = useGame((s) => s.state)!;
  const run = useGame((s) => s.run);
  const theme = SLOT_THEMES[game.id];

  const [wager, setWager] = useState(50);
  const [mode, setMode] = useState<"grid" | "spin">("grid");
  const [grid, setGrid] = useState<Sym[][]>(() => restingGrid(game));
  const [strips, setStrips] = useState<Sym[][]>([]);
  const [featInc, setFeatInc] = useState(false);
  const [reveal, setReveal] = useState({ seq: 0, drop: false });
  const [highlights, setHighlights] = useState<Set<string>>(new Set());
  const [exploding, setExploding] = useState<Set<string>>(new Set());
  const [feature, setFeature] = useState<{ text: string; seq: number } | null>(null);
  const [ways, setWays] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [done, setDone] = useState<{ win: number; mult: number; tier: WinTier | null } | null>(null);
  const [displayWin, setDisplayWin] = useState(0);
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

  async function spin() {
    if (spinning || wager <= 0 || wager > cash) return;
    cancelled.current = false;
    setSpinning(true);
    setDone(null);
    setDisplayWin(0);
    setHighlights(new Set());
    setExploding(new Set());
    setFeature(null);

    const result = game.spin(wager, state.stats.luck);
    setWays(result.ways ?? null);
    const target = result.frames[0].grid;
    const cols = target.length;
    const feature_incoming = result.frames.length > 1 || !!result.note || result.totalMult >= 15;

    // Build reel strips: buffer of random symbols, then the landing symbols.
    setStrips(target.map((col) => [...Array.from({ length: BUF }, rand), ...col]));
    setFeatInc(feature_incoming);
    setMode("spin"); // keyframe animation plays on mount of these reels

    const maxDur = reelDuration(cols - 1, cols - 1, feature_incoming);
    await sleep(maxDur + 150);
    if (cancelled.current) return;

    // Land on the static grid (no drop — the reels already placed the symbols).
    setGrid(target.map((c) => c.slice()));
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
      commitGamble(state, {
        game: "slots",
        wager,
        payout,
        net: payout - wager,
        won: payout > 0,
        detail: `${game.name}${result.note ? " — " + result.note : ""}`,
      }),
    );
    const tier = winTier(result.totalMult);
    if (result.note) showFeature(result.note);
    setDone({ win: payout, mult: result.totalMult, tier });
    setSpinning(false);
  }

  const lastCol = strips.length - 1;

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
                  const rows = strip.length - BUF;
                  const dur = reelDuration(c, lastCol, featInc);
                  const dist = BUF * pitch;
                  const anticip = featInc && c === lastCol;
                  return (
                    <div
                      key={c}
                      className={`relative overflow-hidden rounded-md ${anticip ? "anticip-reel" : ""}`}
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
              : grid.map((col, c) => (
                  <div key={c} className="flex flex-col gap-1" style={{ minHeight: maxRows * pitch }}>
                    {col.map((sym, r) => {
                      const k = key(c, r);
                      const on = highlights.has(k);
                      const boom = exploding.has(k);
                      const dim = highlights.size > 0 && !on;
                      return (
                        <div
                          key={`${r}-${reveal.seq}`}
                          className={`flex items-center justify-center rounded-md ${reveal.drop ? "slot-drop" : ""}`}
                          style={{
                            width: cs,
                            height: cs,
                            background: theme.cellBg,
                            border: `1px solid ${on ? theme.accent : theme.cellBorder}`,
                            boxShadow: on ? `0 0 16px 2px ${theme.winGlow}` : undefined,
                            opacity: dim ? 0.32 : 1,
                            transition: "opacity .2s, box-shadow .15s, border-color .15s",
                            animationDelay: reveal.drop ? `${c * 0.04 + r * 0.03}s` : undefined,
                          }}
                        >
                          <span
                            className={boom ? "slot-explode-sym" : on ? "slot-win-sym" : ""}
                            style={{ fontSize: cs * 0.56, display: "inline-block" }}
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
      </div>

      {game.id === "jackpot" && <JackpotMeters accent={theme.accent} />}

      {done && (
        <div
          className="mt-2 rounded-lg p-2 text-center"
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

      <div className="mt-3 space-y-2">
        <WagerInput wager={wager} setWager={setWager} cash={cash} disabled={spinning} />
        <button
          onClick={spin}
          disabled={spinning || wager > cash || wager <= 0}
          className="w-full rounded-xl py-3 text-base font-black disabled:opacity-50"
          style={{ background: theme.accent, color: theme.accentText }}
        >
          {spinning ? "Spinning…" : `SPIN · ${money(wager)}`}
        </button>
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
