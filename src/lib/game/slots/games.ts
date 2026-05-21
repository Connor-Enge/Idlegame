import {
  countWays,
  evalClusters,
  evalLines,
  evalScatterPays,
  evalWays,
  genGrid,
  genVariableGrid,
  key,
  tumble,
  weightedPick,
  type Frame,
  type SpinResult,
  type Sym,
} from "./engine";

export interface SlotGame {
  id: string;
  name: string;
  style: string;
  icon: string;
  blurb: string;
  symbols: Sym[];
  cols: number;
  spin: (bet: number, luck: number, opts?: { buy?: boolean; rows?: number }) => SpinResult;
  buyCost?: number; // cost of Feature Buy, in multiples of the bet
  scatterSym?: Sym; // symbol that triggers the bonus (drives reel anticipation)
  scatterTrigger?: number; // how many are needed to trigger
  rowOptions?: number[]; // selectable row counts (Book of Shadows "Shadow Rows")
  luckyLocks?: boolean; // after a base spin, lock reels and pay to respin the rest
  respin?: (grid: Sym[][], lockedCols: number[], rows: number) => SpinResult; // Lucky Locks respin
  lockCost?: (grid: Sym[][], lockedCols: number[], rows: number) => number; // cost in x bet
  gamble?: boolean; // red/black double-or-nothing offered after a win
}

// Each machine gets its own visual identity — distinct backdrop, reel frame,
// cell treatment, accent and title — so the lobby feels like a real casino
// floor rather than one skin reused ten times.
export interface SlotTheme {
  pageBg: string; // backdrop behind the whole machine
  cabinet: string; // the machine cabinet / frame
  reelBg: string; // reel window background
  cellBg: string; // individual symbol cell
  cellBorder: string;
  accent: string; // wins, glow, button
  accentText: string; // text color on accent button
  title: string; // CSS for the title text (gradient clip etc.)
  font: string; // font-family stack for the title
  winGlow: string; // box-shadow color for winning cells
}

export const SLOT_THEMES: Record<string, SlotTheme> = {
  scatter: {
    pageBg: "radial-gradient(120% 90% at 50% 0%, #7b2d6b 0%, #3b1138 55%, #1a0a1f 100%)",
    cabinet: "linear-gradient(180deg,#ff7eb3 0%,#c64fb0 100%)",
    reelBg: "linear-gradient(180deg,#2a0f33,#150818)",
    cellBg: "rgba(255,255,255,0.06)",
    cellBorder: "rgba(255,200,240,0.18)",
    accent: "#ff5ea8",
    accentText: "#1a0a1f",
    title: "background:linear-gradient(90deg,#fff,#ffd6f0);-webkit-background-clip:text;background-clip:text;color:transparent",
    font: "'Trebuchet MS', sans-serif",
    winGlow: "rgba(255,94,168,0.8)",
  },
  megaways: {
    pageBg: "radial-gradient(120% 90% at 50% 0%, #06283d 0%, #041c2e 55%, #010a12 100%)",
    cabinet: "linear-gradient(180deg,#22d3ee 0%,#2563eb 100%)",
    reelBg: "linear-gradient(180deg,#04263b,#01121f)",
    cellBg: "rgba(34,211,238,0.08)",
    cellBorder: "rgba(34,211,238,0.3)",
    accent: "#22d3ee",
    accentText: "#012",
    title: "background:linear-gradient(90deg,#7dd3fc,#22d3ee);-webkit-background-clip:text;background-clip:text;color:transparent;letter-spacing:2px",
    font: "'Arial Black', system-ui, sans-serif",
    winGlow: "rgba(34,211,238,0.85)",
  },
  cluster: {
    pageBg: "radial-gradient(120% 90% at 50% 0%, #0f766e 0%, #134e4a 55%, #06201e 100%)",
    cabinet: "linear-gradient(180deg,#2dd4bf 0%,#0d9488 100%)",
    reelBg: "linear-gradient(180deg,#0b3b38,#04201e)",
    cellBg: "rgba(255,255,255,0.04)",
    cellBorder: "rgba(45,212,191,0.25)",
    accent: "#2dd4bf",
    accentText: "#04201e",
    title: "background:linear-gradient(90deg,#99f6e4,#2dd4bf);-webkit-background-clip:text;background-clip:text;color:transparent",
    font: "'Verdana', sans-serif",
    winGlow: "rgba(45,212,191,0.85)",
  },
  holdwin: {
    pageBg: "radial-gradient(120% 90% at 50% 0%, #3b2f0a 0%, #1c1604 55%, #0a0800 100%)",
    cabinet: "linear-gradient(180deg,#fde047 0%,#b8860b 100%)",
    reelBg: "linear-gradient(180deg,#2a2206,#120e02)",
    cellBg: "rgba(253,224,71,0.07)",
    cellBorder: "rgba(253,224,71,0.3)",
    accent: "#facc15",
    accentText: "#1c1604",
    title: "background:linear-gradient(90deg,#fde047,#fbbf24);-webkit-background-clip:text;background-clip:text;color:transparent;letter-spacing:1px",
    font: "'Georgia', serif",
    winGlow: "rgba(250,204,21,0.9)",
  },
  cascade: {
    pageBg: "radial-gradient(120% 90% at 50% 0%, #be5985 0%, #6d2f6d 55%, #2a1230 100%)",
    cabinet: "linear-gradient(180deg,#fbcfe8 0%,#f9a8d4 100%)",
    reelBg: "linear-gradient(180deg,#3a1640,#1c0d22)",
    cellBg: "rgba(255,255,255,0.07)",
    cellBorder: "rgba(251,207,232,0.3)",
    accent: "#f472b6",
    accentText: "#2a1230",
    title: "background:linear-gradient(90deg,#fff,#fbcfe8);-webkit-background-clip:text;background-clip:text;color:transparent",
    font: "'Comic Sans MS', 'Trebuchet MS', sans-serif",
    winGlow: "rgba(244,114,182,0.85)",
  },
  book: {
    pageBg: "radial-gradient(120% 90% at 50% 0%, #7c5a1e 0%, #3d2c0c 55%, #1a1204 100%)",
    cabinet: "linear-gradient(180deg,#d4af37 0%,#8a6d1f 100%)",
    reelBg: "linear-gradient(180deg,#2e2208,#150f03)",
    cellBg: "rgba(212,175,55,0.08)",
    cellBorder: "rgba(212,175,55,0.35)",
    accent: "#d4af37",
    accentText: "#1a1204",
    title: "background:linear-gradient(90deg,#f5e1a4,#d4af37);-webkit-background-clip:text;background-clip:text;color:transparent;letter-spacing:3px",
    font: "'Papyrus', 'Georgia', serif",
    winGlow: "rgba(212,175,55,0.9)",
  },
  jackpot: {
    pageBg: "radial-gradient(120% 90% at 50% 0%, #7f1d1d 0%, #450a0a 55%, #1a0505 100%)",
    cabinet: "linear-gradient(180deg,#fca5a5 0%,#dc2626 100%)",
    reelBg: "linear-gradient(180deg,#3a0a0a,#1a0505)",
    cellBg: "rgba(255,215,0,0.06)",
    cellBorder: "rgba(220,38,38,0.4)",
    accent: "#ef4444",
    accentText: "#fff",
    title: "background:linear-gradient(90deg,#fde047,#ef4444);-webkit-background-clip:text;background-clip:text;color:transparent;letter-spacing:2px",
    font: "'Impact', 'Arial Black', sans-serif",
    winGlow: "rgba(250,204,21,0.9)",
  },
  ways243: {
    pageBg: "radial-gradient(120% 90% at 50% 0%, #14532d 0%, #0a2e1a 55%, #04130a 100%)",
    cabinet: "linear-gradient(180deg,#86efac 0%,#15803d 100%)",
    reelBg: "linear-gradient(180deg,#0d3a22,#04130a)",
    cellBg: "rgba(134,239,172,0.06)",
    cellBorder: "rgba(134,239,172,0.25)",
    accent: "#4ade80",
    accentText: "#04130a",
    title: "background:linear-gradient(90deg,#bbf7d0,#4ade80);-webkit-background-clip:text;background-clip:text;color:transparent",
    font: "'Trebuchet MS', sans-serif",
    winGlow: "rgba(74,222,128,0.85)",
  },
  video: {
    pageBg: "radial-gradient(120% 90% at 50% 0%, #4c1d95 0%, #2e1065 55%, #150330 100%)",
    cabinet: "linear-gradient(180deg,#d8b4fe 0%,#7c3aed 100%)",
    reelBg: "linear-gradient(180deg,#2a1257,#140330)",
    cellBg: "rgba(216,180,254,0.07)",
    cellBorder: "rgba(216,180,254,0.3)",
    accent: "#a855f7",
    accentText: "#fff",
    title: "background:linear-gradient(90deg,#fde047,#d8b4fe);-webkit-background-clip:text;background-clip:text;color:transparent;letter-spacing:2px",
    font: "'Georgia', serif",
    winGlow: "rgba(168,85,247,0.85)",
  },
  classic: {
    pageBg: "radial-gradient(120% 90% at 50% 0%, #b91c1c 0%, #7f1d1d 55%, #2a0808 100%)",
    cabinet: "linear-gradient(180deg,#fef3c7 0%,#dc2626 100%)",
    reelBg: "linear-gradient(180deg,#fff7ed,#fde68a)",
    cellBg: "#fffdf5",
    cellBorder: "rgba(0,0,0,0.15)",
    accent: "#dc2626",
    accentText: "#fff",
    title: "background:linear-gradient(90deg,#fff,#fde68a);-webkit-background-clip:text;background-clip:text;color:transparent;letter-spacing:3px",
    font: "'Courier New', monospace",
    winGlow: "rgba(220,38,38,0.8)",
  },
  shadows: {
    pageBg: "radial-gradient(120% 90% at 50% 0%, #2e1a4d 0%, #170b2b 55%, #07030f 100%)",
    cabinet: "linear-gradient(180deg,#7c5cc4 0%,#3b2566 100%)",
    reelBg: "linear-gradient(180deg,#1d1036,#0a0518)",
    cellBg: "rgba(167,139,250,0.07)",
    cellBorder: "rgba(167,139,250,0.3)",
    accent: "#c4b5fd",
    accentText: "#1a0a2e",
    title: "background:linear-gradient(90deg,#e9d5ff,#a78bfa);-webkit-background-clip:text;background-clip:text;color:transparent;letter-spacing:2px",
    font: "'Papyrus', 'Georgia', serif",
    winGlow: "rgba(196,181,253,0.9)",
  },
};

// Global safety cap so a freak win can't bankrupt the house economy.
const CAP = 8000;
const cap = (m: number) => Math.min(CAP, Math.round(m * 100) / 100);

// Per-game RTP calibration. Every game's payouts are scaled by this so the
// long-run return-to-player sits around ~90% (house edge ~10%). Tuned against
// a Monte-Carlo probe; adjust here to retune without touching paytables.
const CAL: Record<string, number> = {
  scatter: 0.1039,
  megaways: 0.0224,
  cluster: 3.22,
  holdwin: 0.254,
  cascade: 0.1307,
  book: 0.5255,
  jackpot: 1.64,
  ways243: 0.4725,
  video: 0.169,
  classic: 0.8,
  shadows: 1.0,
};

const countSym = (g: Sym[][], s: Sym) => g.reduce((a, col) => a + col.filter((x) => x === s).length, 0);

// Force at least n of a scatter onto distinct reels (used by Feature Buy).
const forceScatters = (g: Sym[][], sym: Sym, n: number) => {
  const cols = [...g.keys()].sort(() => Math.random() - 0.5);
  for (let i = 0; i < n && i < cols.length; i++) {
    const c = cols[i];
    const r = Math.floor(Math.random() * g[c].length);
    g[c][r] = sym;
  }
};

// ---------------------------------------------------------------------------
// 1. Classic 3-reel — single payline; cherries pay even 1-2 of a kind.
// ---------------------------------------------------------------------------
const classic: SlotGame = (() => {
  // Fruit-machine staples: cherries, fruit, bells, single/double/triple BARs,
  // and a wild 7 that substitutes and pays the top jackpot.
  const W = "7️⃣";
  const syms = ["🍒", "🍋", "🍊", "🔔", "⬛", "🇧", "📊", "💰", W];
  const weights = [20, 18, 16, 11, 12, 9, 6, 4, 2];
  // BAR tiers: single ⬛ / double 🇧 / triple 📊.
  const BARS = new Set(["⬛", "🇧", "📊"]);
  const pay3: Record<string, number> = { "🍒": 4, "🍋": 6, "🍊": 8, "🔔": 14, "⬛": 10, "🇧": 20, "📊": 40, "💰": 80, "7️⃣": 150 };
  const sub = (s: Sym, t: Sym) => s === t || s === W; // wild substitutes
  return {
    id: "classic",
    name: "Lucky Sevens",
    style: "Classic 3-Reel",
    icon: "🍒",
    blurb: "One line · wild 7s · mixed-BAR wins · cherries pay anywhere.",
    symbols: syms,
    cols: 3,
    spin: () => {
      const grid = genGrid(3, 1, syms, weights);
      const row = [grid[0][0], grid[1][0], grid[2][0]];
      let mult = 0;
      const hl: string[] = [];
      const all = (t: Sym) => sub(row[0], t) && sub(row[1], t) && sub(row[2], t);
      const cherries = row.filter((s) => s === "🍒").length;

      if (row[0] === W && row[1] === W && row[2] === W) {
        mult = pay3[W]; // triple 7s
        hl.push(key(0, 0), key(1, 0), key(2, 0));
      } else {
        // Best three-of-a-kind with wilds (highest-paying match wins).
        let best = 0;
        let bestSym = "";
        for (const t of ["💰", "📊", "🇧", "⬛", "🔔", "🍊", "🍋", "🍒"]) {
          if (all(t) && pay3[t] > best) {
            best = pay3[t];
            bestSym = t;
          }
        }
        // Any-BAR win: three bars of mixed tiers pay the single-bar value.
        if (!bestSym && BARS.has(row[0]) && BARS.has(row[1]) && BARS.has(row[2])) {
          best = pay3["⬛"];
          bestSym = "bars";
        }
        if (bestSym) {
          mult = best;
          hl.push(key(0, 0), key(1, 0), key(2, 0));
        } else if (cherries >= 1) {
          mult = cherries >= 2 ? 3 : 1;
          for (let c = 0; c < 3; c++) if (row[c] === "🍒") hl.push(key(c, 0));
        }
      }
      const m = mult * CAL.classic;
      return { frames: [{ grid, highlights: hl, win: m }], totalMult: cap(m) };
    },
  };
})();

// ---------------------------------------------------------------------------
// 2. Expanding Wilds — Starburst-style: a wild on the middle reels expands to
//    fill the reel, substitutes for everything, and awards a respin with that
//    reel HELD. More expanding wilds extend the respins. Win both ways.
// ---------------------------------------------------------------------------
const video: SlotGame = (() => {
  const W = "🌟"; // expanding wild
  const syms = ["💜", "🟦", "🟩", "🟧", "🔷", "💎", "7️⃣", W];
  const weights = [22, 20, 17, 14, 11, 7, 4, 5];
  const table: Record<string, [number, number, number]> = {
    "💜": [0.25, 0.6, 1.5],
    "🟦": [0.3, 0.8, 2],
    "🟩": [0.4, 1.2, 3],
    "🟧": [0.6, 2, 5],
    "🔷": [1, 3, 8],
    "💎": [2, 6, 18],
    "7️⃣": [5, 15, 60],
  };
  // 10 fixed lines, evaluated BOTH ways (left-to-right and right-to-left).
  const L = [
    [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2],
    [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [1, 0, 1, 2, 1],
    [1, 2, 1, 0, 1], [0, 1, 1, 1, 0], [2, 1, 1, 1, 2], [0, 0, 1, 2, 2],
  ];
  const Lrev = L.map((line) => [...line].reverse());
  const pay = (s: Sym, c: number) => (table[s] ? (table[s][c - 3] ?? 0) * CAL.video : 0);
  const evalBoth = (g: Sym[][]) => {
    const a = evalLines(g, L, pay, W);
    const b = evalLines(g, Lrev.map((l) => l), pay, W); // right-to-left
    // For right-to-left we evaluate a mirrored grid so existing left-anchored
    // logic still works.
    const mirror = [...g].reverse();
    const b2 = evalLines(mirror, L, pay, W);
    const hl = new Set<string>([...a.highlights]);
    // remap mirrored highlights back to real columns
    for (const k of b2.highlights) {
      const [c, r] = k.split(",").map(Number);
      hl.add(key(g.length - 1 - c, r));
    }
    return { mult: a.mult + b2.mult, highlights: [...hl] };
  };

  // Expand any middle reel (1..3) that holds a wild; return the held reel set.
  const expand = (g: Sym[][], held: Set<number>) => {
    for (let c = 1; c <= 3; c++) {
      if (held.has(c) || g[c].includes(W)) {
        held.add(c);
        for (let r = 0; r < g[c].length; r++) g[c][r] = W;
      }
    }
    const hl: string[] = [];
    for (const c of held) for (let r = 0; r < g[c].length; r++) hl.push(key(c, r));
    return hl;
  };
  const newGrid = () => {
    const g = genGrid(5, 3, syms, weights);
    // Wilds only land on the middle three reels.
    for (const c of [0, 4]) for (let r = 0; r < 3; r++) if (g[c][r] === W) g[c][r] = syms[Math.floor(Math.random() * 6)];
    return g;
  };

  return {
    id: "video",
    name: "Cosmic Wilds",
    style: "Expanding Wilds",
    icon: "🌟",
    blurb: "Wilds expand on the middle reels & lock for respins. Win both ways.",
    symbols: syms,
    cols: 5,
    spin: () => {
      const frames: Frame[] = [];
      let total = 0;
      let grid = newGrid();
      const held = new Set<number>();
      let hl = expand(grid, held);
      let r = evalBoth(grid);
      total += r.mult;
      frames.push({ grid: grid.map((c) => [...c]), highlights: [...new Set([...hl, ...r.highlights])], win: r.mult });

      // Respins while new wilds keep landing (held reels stay full of wilds).
      let prevHeld = held.size;
      let guard = 0;
      while (held.size > 0 && held.size < 3 && guard < 4) {
        guard++;
        const fg = newGrid();
        for (const c of held) for (let rr = 0; rr < 3; rr++) fg[c][rr] = W; // keep held wild reels
        hl = expand(fg, held);
        if (held.size === prevHeld) {
          // no new wild — show the final respin and stop
          r = evalBoth(fg);
          total += r.mult;
          frames.push({ grid: fg.map((c) => [...c]), highlights: [...new Set([...hl, ...r.highlights])], win: r.mult, label: "Respin" });
          break;
        }
        prevHeld = held.size;
        r = evalBoth(fg);
        total += r.mult;
        frames.push({ grid: fg.map((c) => [...c]), highlights: [...new Set([...hl, ...r.highlights])], win: r.mult, label: "Wild respin!" });
        grid = fg;
      }
      return { frames, totalMult: cap(total) };
    },
  };
})();

// ---------------------------------------------------------------------------
// 3. 243 Ways — adjacent reels; 3 scatters → 8 free spins (wins ×2).
// ---------------------------------------------------------------------------
const ways243: SlotGame = (() => {
  const SC = "🌙";
  const WILD = "🐾";
  const syms = ["🦊", "🐺", "🦌", "🦅", "🐉", "▪️", WILD, SC];
  const weights = [22, 18, 14, 9, 5, 26, 5, 4];
  const table: Record<string, [number, number, number]> = {
    "🦊": [0.2, 0.6, 1.5],
    "🐺": [0.3, 0.8, 2],
    "🦌": [0.4, 1.2, 3],
    "🦅": [0.6, 2, 6],
    "🐉": [1.5, 5, 20],
  };
  const pay = (s: Sym, reels: number) => (table[s] ? (table[s][reels - 3] ?? 0) * CAL.ways243 : 0);
  return {
    id: "ways243",
    name: "Wild Spirits",
    style: "243 Ways",
    icon: "🐉",
    blurb: "243 ways · 🐾 wilds · 3 🌙 = free spins with rising multiplier.",
    symbols: syms,
    cols: 5,
    buyCost: 20,
    scatterSym: "🌙",
    scatterTrigger: 3,
    spin: (_b, _l, opts) => {
      const frames: Frame[] = [];
      let total = 0;
      const grid = genGrid(5, 3, syms, weights);
      if (opts?.buy) forceScatters(grid, SC, 3);
      const base = evalWays(grid, pay, { wild: WILD, scatter: SC });
      total += base.mult;
      const scat = countSym(grid, SC);
      frames.push({ grid, highlights: base.highlights, win: base.mult, label: scat >= 3 ? "3 🌙 — 8 Free Spins!" : undefined });
      if (scat >= 3) {
        let spins = 8;
        let i = 0;
        while (spins > 0 && i < 40) {
          spins--;
          i++;
          // Multiplier trail climbs through the round: ×2, ×3, ×4, ×5 (cap).
          const fsMult = Math.min(5, 2 + Math.floor((i - 1) / 2));
          const fg = genGrid(5, 3, syms, weights);
          const r = evalWays(fg, pay, { wild: WILD, scatter: SC });
          const w = r.mult * fsMult;
          total += w;
          const more = countSym(fg, SC);
          if (more >= 3) spins += 5; // retrigger
          frames.push({ grid: fg, highlights: r.highlights, win: w, label: `Free spin ${i} · ×${fsMult}${more >= 3 ? " · +5!" : ""}` });
        }
      }
      return { frames, totalMult: cap(total), ways: 243 };
    },
  };
})();

// ---------------------------------------------------------------------------
// 4. Megaways — 6 variable reels AND cascading wins with a rising multiplier.
// ---------------------------------------------------------------------------
const megaways: SlotGame = (() => {
  const SC = "💫"; // scatter — does not pay, triggers free spins
  const syms = ["💠", "🟦", "🟩", "🟧", "🔺", "💎", "🏆", SC];
  const weights = [24, 22, 18, 14, 10, 7, 5, 2];
  const table: Record<string, [number, number, number, number]> = {
    "💠": [0.1, 0.3, 0.8, 2],
    "🟦": [0.15, 0.4, 1, 2.5],
    "🟩": [0.2, 0.6, 1.5, 4],
    "🟧": [0.3, 1, 2.5, 6],
    "🔺": [0.5, 1.5, 5, 12],
    "💎": [1, 3, 10, 30],
    "🏆": [2, 8, 25, 80],
  };
  const pay = (s: Sym, reels: number) => (table[s] ? (table[s][Math.min(3, reels - 3)] ?? 0) * CAL.megaways : 0);
  const newGrid = () => genVariableGrid(6, 2, 7, syms, weights);

  return {
    id: "megaways",
    name: "Mega Fortune X",
    style: "Megaways",
    icon: "💠",
    blurb: "117,649 ways · cascades · unlimited free-spin multiplier.",
    symbols: syms,
    cols: 6,
    buyCost: 176,
    scatterSym: "💫",
    scatterTrigger: 4,
    spin: (_b, _l, opts) => {
      const frames: Frame[] = [];
      let total = 0;
      let grid = newGrid();
      if (opts?.buy) forceScatters(grid, SC, 4);
      const ways = countWays(grid);

      // Base game: cascades pay at ×1 (no multiplier — that's a free-spins thing).
      const baseScat = countSym(grid, SC);
      let step = 0;
      let pend: Record<string, number> | undefined;
      while (step < 12) {
        const { mult: m, highlights } = evalWays(grid, pay, { scatter: SC });
        if (m <= 0 || highlights.length === 0) {
          if (step === 0) frames.push({ grid, win: 0 });
          else frames.push({ grid, win: 0, fall: pend });
          break;
        }
        total += m;
        frames.push({ grid, highlights, win: m, fall: pend, label: step > 0 ? "Cascade" : undefined });
        const t = tumble(grid, new Set(highlights), syms, weights);
        grid = t.grid;
        pend = t.fall;
        step++;
      }

      // 4+ scatters → 12 free spins with an UNLIMITED progressive multiplier
      // that increments on every cascade and never resets (Bonanza-style).
      if (baseScat >= 4) {
        frames.push({ grid, win: 0, label: `${baseScat} 💫 — 12 Free Spins!` });
        let fsMult = 1;
        let spins = 12;
        let i = 0;
        while (spins > 0 && i < 50) {
          spins--;
          i++;
          let fg = newGrid();
          let s = 0;
          let fpend: Record<string, number> | undefined;
          while (s < 12) {
            const { mult: m, highlights } = evalWays(fg, pay, { scatter: SC });
            if (m <= 0 || highlights.length === 0) break;
            const w = m * fsMult;
            total += w;
            frames.push({ grid: fg.map((c) => [...c]), highlights, win: w, fall: fpend, label: `FS ${i} · ×${fsMult}` });
            const t = tumble(fg, new Set(highlights), syms, weights);
            fg = t.grid;
            fpend = t.fall;
            fsMult++; // persists across the whole bonus
            s++;
          }
          if (countSym(fg, SC) >= 3) spins += 5; // retrigger
        }
      }
      return { frames, totalMult: cap(total), ways };
    },
  };
})();

// ---------------------------------------------------------------------------
// 5. Cluster pays — 7x7 grid, groups of 5+, with tumble.
// ---------------------------------------------------------------------------
const cluster: SlotGame = (() => {
  const syms = ["🟥", "🟧", "🟨", "🟩", "🟦", "🟪", "⬜"];
  const weights = [16, 16, 16, 15, 14, 12, 8];
  const pay = (_s: Sym, size: number) => {
    let m = 0.4;
    if (size >= 15) m = 25;
    else if (size >= 12) m = 10;
    else if (size >= 9) m = 4;
    else if (size >= 7) m = 1.5;
    return m * CAL.cluster;
  };
  return {
    id: "cluster",
    name: "Gem Cluster",
    style: "Cluster Pays",
    icon: "🟪",
    blurb: "7×7 clusters that tumble.",
    symbols: syms,
    cols: 7,
    spin: () => {
      let grid = genGrid(7, 7, syms, weights);
      const frames: Frame[] = [];
      let total = 0;
      let chain = 0;
      let pend: Record<string, number> | undefined;
      while (chain < 12) {
        const { mult, highlights } = evalClusters(grid, pay, 5);
        if (mult <= 0 || highlights.length === 0) {
          if (chain === 0) frames.push({ grid, win: 0 });
          else frames.push({ grid, win: 0, fall: pend }); // show the final settle
          break;
        }
        const m = mult * (1 + chain * 0.5);
        total += m;
        frames.push({ grid, highlights, win: m, fall: pend, label: chain > 0 ? `Cascade ×${(1 + chain * 0.5).toFixed(1)}` : undefined });
        const t = tumble(grid, new Set(highlights), syms, weights);
        grid = t.grid;
        pend = t.fall;
        chain++;
      }
      return { frames, totalMult: cap(total) };
    },
  };
})();

// ---------------------------------------------------------------------------
// 6. Cascading reels — 5x4 ways, rising multiplier per tumble.
// ---------------------------------------------------------------------------
const cascade: SlotGame = (() => {
  const SC = "🎂";
  const syms = ["🍫", "🍬", "🍭", "🧁", "🍩", "▪️", SC];
  const weights = [20, 17, 13, 9, 6, 26, 3];
  const table: Record<string, [number, number, number]> = {
    "🍫": [0.2, 0.5, 1.2],
    "🍬": [0.3, 0.7, 1.8],
    "🍭": [0.4, 1, 2.5],
    "🧁": [0.6, 1.6, 4],
    "🍩": [1, 3, 8],
  };
  // Base ladder resets each spin; free spins use a bigger ladder (Gonzo-style).
  const MULTS_BASE = [1, 2, 3, 5];
  const MULTS_FS = [5, 10, 20, 40];
  const pay = (s: Sym, reels: number) => (table[s] ? (table[s][reels - 3] ?? 0) * CAL.cascade : 0);

  const runCascades = (g0: Sym[][], ladder: number[], fs: number | null) => {
    const fr: Frame[] = [];
    let grid = g0;
    let win = 0;
    let step = 0;
    let pend: Record<string, number> | undefined;
    while (step < 9) {
      const { mult, highlights } = evalWays(grid, pay, { scatter: SC });
      if (mult <= 0) {
        if (step === 0) fr.push({ grid, win: 0 });
        else fr.push({ grid, win: 0, fall: pend });
        break;
      }
      const x = ladder[Math.min(step, ladder.length - 1)];
      const m = mult * x;
      win += m;
      fr.push({ grid, highlights, win: m, fall: pend, label: `${fs != null ? `FS ${fs} · ` : ""}×${x}` });
      const t = tumble(grid, new Set(highlights), syms, weights);
      grid = t.grid;
      pend = t.fall;
      step++;
    }
    return { frames: fr, win, grid };
  };

  return {
    id: "cascade",
    name: "Sugar Cascade",
    style: "Cascading Reels",
    icon: "🍭",
    blurb: "Rising multiplier · 3 🎂 = free spins with a bigger ladder.",
    symbols: syms,
    cols: 5,
    buyCost: 25,
    scatterSym: "🎂",
    scatterTrigger: 3,
    spin: (_b, _l, opts) => {
      const frames: Frame[] = [];
      let total = 0;
      const grid = genGrid(5, 4, syms, weights);
      if (opts?.buy) forceScatters(grid, SC, 3);
      const baseScat = countSym(grid, SC);
      const base = runCascades(grid, MULTS_BASE, null);
      total += base.win;
      frames.push(...base.frames);
      if (baseScat >= 3) {
        frames.push({ grid: base.grid, win: 0, label: "3 🎂 — 10 Free Spins!" });
        let spins = 10;
        let i = 0;
        while (spins > 0 && i < 40) {
          spins--;
          i++;
          const fg = genGrid(5, 4, syms, weights);
          const seq = runCascades(fg, MULTS_FS, i);
          total += seq.win;
          frames.push(...seq.frames);
          if (countSym(fg, SC) >= 3) spins += 5;
        }
      }
      return { frames, totalMult: cap(total) };
    },
  };
})();

// ---------------------------------------------------------------------------
// 7. Pay-anywhere (Sweet-Bonanza style) — 6x5, 8+ pays, tumble, ✖️ bombs
//    accumulate and multiply the sequence; 4 🍭 scatters → 10 free spins.
// ---------------------------------------------------------------------------
const scatterPays: SlotGame = (() => {
  const BOMB = "✖️";
  const SC = "🍭";
  const BLANK = "▪️";
  const syms = ["🍌", "🍎", "🍓", "🍑", "🫐", BLANK, BOMB, SC];
  const weights = [18, 16, 13, 10, 7, 26, 6, 2];
  const base: Record<string, [number, number, number]> = {
    "🍌": [0.25, 0.75, 2],
    "🍎": [0.4, 1.2, 3],
    "🍓": [0.5, 2, 5],
    "🍑": [0.8, 3, 8],
    "🫐": [1.2, 5, 12],
  };
  const pay = (s: Sym, n: number) => {
    const t = base[s];
    if (!t) return 0;
    const v = n >= 12 ? t[2] : n >= 10 ? t[1] : t[0];
    return v * CAL.scatter;
  };
  // One tumble sequence: pays 8+ anywhere, tumbles, then accumulated ✖️ bombs
  // multiply the sequence total (Sweet-Bonanza mechanic).
  // One tumble sequence. In free spins the multiplier bombs are bigger
  // (2x–100x) and guaranteed on every winning tumble — that's why the bonus
  // is the star, exactly like Sweet Bonanza.
  const playSeq = (g0: Sym[][], fs = false) => {
    const fr: Frame[] = [];
    let tot = 0;
    let grid = g0;
    let step = 0;
    let bombSum = 0;
    let pend: Record<string, number> | undefined;
    const bombRoll = () => (fs ? 2 + Math.floor(Math.random() * 99) : 2 + Math.floor(Math.random() * 24));
    while (step < 10) {
      const { mult, highlights } = evalScatterPays(grid, pay, 8, [BOMB, SC, BLANK]);
      if (mult <= 0) {
        if (step > 0) fr.push({ grid: grid.map((c) => [...c]), win: 0, fall: pend });
        break;
      }
      tot += mult;
      let stepBomb = 0;
      const bombCells: string[] = [];
      for (let c = 0; c < grid.length; c++)
        for (let r = 0; r < grid[c].length; r++)
          if (grid[c][r] === BOMB) {
            stepBomb += bombRoll();
            bombCells.push(key(c, r));
          }
      if (fs && stepBomb === 0) stepBomb += bombRoll(); // guaranteed bomb in FS
      bombSum += stepBomb;
      fr.push({
        grid: grid.map((c) => [...c]),
        highlights: [...highlights, ...bombCells],
        win: mult,
        fall: pend,
        label: stepBomb > 0 ? `+×${stepBomb}` : undefined,
      });
      const t = tumble(grid, new Set(highlights), syms, weights);
      grid = t.grid;
      pend = t.fall;
      step++;
    }
    if (tot > 0 && bombSum > 0) {
      const before = tot;
      tot *= bombSum;
      if (fr.length) {
        const last = fr[fr.length - 1];
        fr[fr.length - 1] = { ...last, label: `×${bombSum} total!`, win: (last.win ?? 0) + (tot - before) };
      }
    }
    return { frames: fr, win: tot, grid };
  };
  return {
    id: "scatter",
    name: "Fruit Frenzy",
    style: "Pay Anywhere",
    icon: "🍓",
    blurb: "8+ anywhere; ✖️ bombs; 4 🍭 = free spins.",
    symbols: syms,
    cols: 6,
    buyCost: 37,
    scatterSym: "🍭",
    scatterTrigger: 4,
    spin: (_b, _l, opts) => {
      const frames: Frame[] = [];
      let total = 0;
      const grid = genGrid(6, 5, syms, weights);
      if (opts?.buy) forceScatters(grid, SC, 4);
      const scat = countSym(grid, SC);
      const baseSeq = playSeq(grid);
      total += baseSeq.win;
      if (baseSeq.frames.length) frames.push(...baseSeq.frames);
      else frames.push({ grid, win: 0 });
      if (scat >= 4) {
        frames.push({ grid: baseSeq.grid, win: 0, label: "4 🍭 — 10 Free Spins!" });
        for (let i = 1; i <= 10; i++) {
          const fg = genGrid(6, 5, syms, weights);
          const fs = playSeq(fg, true);
          total += fs.win;
          const out = fs.frames.length ? fs.frames : [{ grid: fg, win: 0 }];
          out.forEach((fr) => frames.push({ ...fr, label: fr.label ? `FS ${i}/10 · ${fr.label}` : `Free spin ${i}/10` }));
        }
      }
      return { frames, totalMult: cap(total) };
    },
  };
})();

// ---------------------------------------------------------------------------
// 8. Hold & Win — collect coins, lock them, 3 respins; full board = grand.
// ---------------------------------------------------------------------------
const holdwin: SlotGame = (() => {
  const C = "🪙"; // money symbol — triggers the hold & spin, doesn't pay lines
  const blank = "▫️";
  const syms = ["🔔", "🍀", "💵", "💎", C, blank];
  const weights = [24, 19, 12, 7, 8, 30];
  // Normal paying base game (ways-to-win) so most spins can land a small win,
  // exactly like a real Lightning Link / 88 Fortunes base game.
  const table: Record<string, [number, number, number]> = {
    "🔔": [0.3, 0.8, 2],
    "🍀": [0.4, 1.2, 3],
    "💵": [0.7, 2.5, 7],
    "💎": [1.5, 6, 18],
  };
  const pay = (s: Sym, reels: number) => (table[s] ? (table[s][reels - 3] ?? 0) * CAL.holdwin : 0);
  // Coins carry a real cash value (a true multiple of bet); rare jackpot coins.
  const makeCoin = (): { v: number; label: string } => {
    if (Math.random() < 0.992) {
      const x = Math.random();
      const v = x < 0.55 ? 0.5 : x < 0.82 ? 1 : x < 0.95 ? 2 : 5;
      return { v, label: `${v}×` };
    }
    const j = Math.random();
    if (j < 0.6) return { v: 10, label: "MINI" };
    if (j < 0.85) return { v: 25, label: "MINOR" };
    if (j < 0.97) return { v: 60, label: "MAJOR" };
    return { v: 150, label: "GRAND" };
  };
  const COLS = 5;
  const ROWS = 4;
  const CELLS = COLS * ROWS;
  return {
    id: "holdwin",
    name: "Coin Vault",
    style: "Hold & Win",
    icon: "🪙",
    blurb: "Ways-pay base game · 6 🪙 trigger lock-and-respin with jackpot coins.",
    symbols: syms,
    cols: COLS,
    scatterSym: C,
    scatterTrigger: 6,
    spin: () => {
      const grid = genGrid(COLS, ROWS, syms, weights);
      const frames: Frame[] = [];

      // 1. Base game pays on the value symbols (coin is treated as a scatter).
      const base = evalWays(grid, pay, { scatter: C });
      let total = base.mult;

      const coins = new Map<string, { v: number; label: string }>();
      for (let c = 0; c < COLS; c++)
        for (let r = 0; r < ROWS; r++)
          if (grid[c][r] === C) coins.set(key(c, r), makeCoin());
      const overlaysOf = () => Object.fromEntries([...coins].map(([k, info]) => [k, info.label]));

      const trigger = coins.size >= 6;
      frames.push({
        grid,
        highlights: [...base.highlights, ...coins.keys()],
        overlays: overlaysOf(),
        win: base.mult,
        label: trigger ? `${coins.size} 🪙 — HOLD & WIN!` : coins.size > 0 ? `${coins.size} 🪙` : undefined,
      });
      if (!trigger) return { frames, totalMult: cap(total) };

      // 2. Hold & Win: lock coins, 3 respins that reset whenever a new coin lands.
      let respins = 3;
      const board = grid.map((col, c) => col.map((_, r) => (coins.has(key(c, r)) ? C : blank)));
      while (respins > 0 && coins.size < CELLS) {
        respins--;
        let newCoin = false;
        for (let c = 0; c < COLS; c++)
          for (let r = 0; r < ROWS; r++) {
            const k = key(c, r);
            if (coins.has(k)) continue;
            if (Math.random() < 0.05) {
              coins.set(k, makeCoin());
              board[c][r] = C;
              newCoin = true;
            }
          }
        if (newCoin) respins = 3;
        frames.push({ grid: board.map((c) => [...c]), highlights: [...coins.keys()], overlays: overlaysOf(), label: `Respin · ${respins} left` });
      }

      // 3. Pay the sum of all coin values (their face value is the real win).
      let coinSum = 0;
      for (const info of coins.values()) coinSum += info.v;
      total += coinSum;
      let note: string | undefined = `Coins: ${coinSum}×`;
      if (coins.size >= CELLS) {
        total += 150; // full board awards the Grand
        note = "GRAND JACKPOT — full board!";
      }
      return { frames, totalMult: cap(total), note };
    },
  };
})();

// ---------------------------------------------------------------------------
// 9. Expanding-wild book — 5x3, 3 books → 10 free spins with a chosen
//    special symbol that expands to fill its reel and pays scattered; retrigger.
// ---------------------------------------------------------------------------
const book: SlotGame = (() => {
  const B = "📖";
  const syms = ["🐍", "🐫", "🪲", "𓂀", "🏺", "👑", B];
  const weights = [24, 20, 16, 12, 8, 5, 4];
  const table: Record<string, [number, number, number]> = {
    "🐍": [0.3, 1, 3],
    "🐫": [0.4, 1.5, 4],
    "🪲": [0.6, 2, 8],
    "𓂀": [1, 4, 15],
    "🏺": [2, 8, 30],
    "👑": [4, 15, 60],
  };
  const L = [
    [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2],
    [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [0, 0, 1, 0, 0],
    [2, 2, 1, 2, 2], [1, 0, 1, 2, 1], [1, 2, 1, 0, 1], [0, 1, 1, 1, 2],
  ];
  const pay = (s: Sym, c: number) => (table[s] ? (table[s][c - 3] ?? 0) * CAL.book : 0);
  return {
    id: "book",
    name: "Book of Fortune",
    style: "Book / Expanding Symbol",
    icon: "📖",
    blurb: "3 books = 10 free spins with an expanding symbol.",
    symbols: syms,
    cols: 5,
    buyCost: 30,
    scatterSym: "📖",
    scatterTrigger: 3,
    spin: (_b, _l, opts) => {
      const frames: Frame[] = [];
      let total = 0;
      const grid = genGrid(5, 3, syms, weights);
      if (opts?.buy) forceScatters(grid, B, 3);
      const baseLines = evalLines(grid, L, pay, undefined, B);
      total += baseLines.mult;
      const books = countSym(grid, B);
      frames.push({ grid, highlights: baseLines.highlights, win: baseLines.mult, label: books >= 3 ? "3 📖 — 10 Free Spins!" : undefined });
      if (books >= 3) {
        const pool = ["🐍", "🐫", "🪲", "𓂀", "🏺", "👑"];
        const special = pool[Math.floor(Math.random() * pool.length)];
        let fsLeft = 10;
        let i = 0;
        while (fsLeft > 0 && i < 40) {
          fsLeft--;
          i++;
          const fg = genGrid(5, 3, syms, weights);
          const hl: string[] = [];
          // Expand the special symbol to fill any reel it lands on.
          for (let c = 0; c < 5; c++) {
            if (fg[c].includes(special)) {
              for (let r = 0; r < 3; r++) {
                fg[c][r] = special;
                hl.push(key(c, r));
              }
            }
          }
          let win = 0;
          const reelsWith = fg.filter((col) => col.every((s) => s === special)).length;
          if (reelsWith >= 3) win += pay(special, Math.min(5, reelsWith)) * 6; // pays on all rows
          const lines = evalLines(fg, L, pay, undefined, B);
          win += lines.mult;
          total += win;
          const more = countSym(fg, B);
          if (more >= 3) fsLeft += 10; // retrigger
          frames.push({ grid: fg, highlights: [...new Set([...hl, ...lines.highlights])], win, label: `Free spin ${i} · ${special}${more >= 3 ? " · +10!" : ""}` });
        }
      }
      return { frames, totalMult: cap(total) };
    },
  };
})();

// ---------------------------------------------------------------------------
// 10. Progressive jackpot — 5x3 lines + collectible jackpot symbols.
// ---------------------------------------------------------------------------
// Live progressive pots (multiplier units) shared with the UI meter. They grow
// every spin and reset to seed when won via the random Jackpot Wheel — the
// Mega Moolah model adapted to a bet-multiplier economy.
type PotTier = "Mini" | "Minor" | "Major" | "Grand";
const POT_SEED: Record<PotTier, number> = { Mini: 8, Minor: 30, Major: 200, Grand: 1500 };
const POT_CAP: Record<PotTier, number> = { Mini: 25, Minor: 80, Major: 600, Grand: 3000 };
const POT_GROW: Record<PotTier, number> = { Mini: 0.02, Minor: 0.05, Major: 0.2, Grand: 0.6 };
const jackpotPotsState: Record<PotTier, number> = { ...POT_SEED };
export function jackpotPots(): Record<PotTier, number> {
  return { ...jackpotPotsState };
}

const jackpot: SlotGame = (() => {
  const syms = ["🎰", "🍀", "💍", "⌛", "🔮", "💰"];
  const weights = [24, 20, 15, 11, 7, 8];
  const table: Record<string, [number, number, number]> = {
    "🎰": [0.4, 1.2, 3],
    "🍀": [0.6, 2, 5],
    "💍": [1, 3, 10],
    "⌛": [1.5, 5, 18],
    "🔮": [3, 10, 40],
    "💰": [2, 6, 25],
  };
  const L = [
    [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2],
    [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [1, 0, 1, 2, 1],
    [1, 2, 1, 0, 1], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [0, 1, 0, 1, 0],
  ];
  const pay = (s: Sym, c: number) => (table[s] ? (table[s][c - 3] ?? 0) * CAL.jackpot : 0);

  // Random jackpot trigger per spin; tier weighted toward the small pots.
  const TRIGGER = 0.001;
  const TIER_WEIGHTS: [PotTier, number][] = [["Mini", 0.7], ["Minor", 0.24], ["Major", 0.05], ["Grand", 0.01]];
  const pickTier = (): PotTier => {
    let r = Math.random();
    for (const [t, w] of TIER_WEIGHTS) {
      if (r < w) return t;
      r -= w;
    }
    return "Mini";
  };

  return {
    id: "jackpot",
    name: "Jackpot Royale",
    style: "Progressive Jackpot",
    icon: "💰",
    blurb: "Growing pots · random Jackpot Wheel.",
    symbols: syms,
    cols: 5,
    spin: () => {
      // Pots tick up every spin (capped).
      (Object.keys(POT_GROW) as PotTier[]).forEach((t) => {
        jackpotPotsState[t] = Math.min(POT_CAP[t], jackpotPotsState[t] + POT_GROW[t]);
      });

      const grid = genGrid(5, 3, syms, weights);
      const frames: Frame[] = [];
      const lines = evalLines(grid, L, pay);
      let total = lines.mult;
      let note: string | undefined;
      frames.push({ grid, highlights: lines.highlights, win: lines.mult });

      // Random Jackpot Wheel can fire on any spin.
      if (Math.random() < TRIGGER) {
        const tier = pickTier();
        const award = Math.round(jackpotPotsState[tier]);
        // Wheel build-up frames cycling the tiers, then landing.
        const order: PotTier[] = ["Mini", "Minor", "Major", "Grand"];
        for (let k = 0; k < 6; k++) {
          frames.push({ grid, win: 0, label: `🎡 ${order[k % 4]}…` });
        }
        total += award;
        note = `${tier.toUpperCase()} JACKPOT!`;
        frames.push({ grid, highlights: [], win: award, label: note });
        jackpotPotsState[tier] = POT_SEED[tier]; // reset the won pot
      }
      return { frames, totalMult: cap(total), note };
    },
  };
})();

// ---------------------------------------------------------------------------
// 11. Book of Shadows (Nolimit City recreation) — the book is wild AND scatter,
//     selectable Shadow Rows expand the paylines (3/4/5 rows → 10/15/20 lines),
//     and 3+ books award 10 free spins with a golden expanding symbol that is
//     redrawn for the best-paying choice, with retriggers.
// ---------------------------------------------------------------------------
const shadows: SlotGame = (() => {
  const B = "📕"; // book — acts as BOTH wild and scatter (Nolimit City)
  // 10 regular symbols: 10-A royals (low) + eyeball, butterfly, goat skull,
  // purple cat, witch (high). Real 5-of-a-kind values; witch & book top at 500x.
  const syms = ["🔟", "🇯", "🇶", "🇰", "🇦", "👁️", "🦋", "🐐", "🐈‍⬛", "🧙‍♀️", B];
  const weights = [16, 15, 14, 12, 11, 8, 7, 5, 4, 3, 4];
  const table: Record<string, [number, number, number]> = {
    "🔟": [0.2, 1, 10],
    "🇯": [0.25, 1.2, 12],
    "🇶": [0.3, 1.5, 15],
    "🇰": [0.4, 2, 20],
    "🇦": [0.5, 2.5, 25],
    "👁️": [1, 5, 50],
    "🦋": [1.5, 8, 75],
    "🐐": [2, 10, 100],
    "🐈‍⬛": [4, 20, 200],
    "🧙‍♀️": [10, 50, 500],
  };
  const pay = (s: Sym, c: number) => (table[s] ? (table[s][c - 3] ?? 0) * CAL.shadows : 0);
  // Book scatter pays for 3/4/5 anywhere (5 books = 500x, matching the witch).
  const bookPay = (n: number) => (n >= 5 ? 500 : n >= 4 ? 20 : n >= 3 ? 2 : 0) * CAL.shadows;
  const lineCount = (rows: number) => (rows >= 5 ? 20 : rows >= 4 ? 15 : 10);
  const makeLines = (rows: number, count: number): number[][] => {
    const out: number[][] = [];
    for (let r = 0; r < rows && out.length < count; r++) out.push([r, r, r, r, r]);
    for (let a = 0; a < rows; a++)
      for (let b = 0; b < rows; b++) {
        if (out.length >= count || a === b) continue;
        out.push([a, b, a, b, a]);
      }
    for (let a = 0; a < rows; a++)
      for (let b = 0; b < rows; b++) {
        if (out.length >= count) break;
        out.push([a, a, b, a, a]);
      }
    while (out.length < count) out.push([0, 1 % rows, 2 % rows, 1 % rows, 0]);
    return out.slice(0, count);
  };
  const countB = (g: Sym[][]) => g.reduce((a, col) => a + col.filter((s) => s === B).length, 0);
  const wFor = (rows: number) => weights.map((x, i) => (i === weights.length - 1 ? (x * 3) / rows : x));
  const HIGHS = new Set(["👁️", "🦋", "🐐", "🐈‍⬛", "🧙‍♀️"]);

  // Resolve a fully-formed grid: base line/scatter win + free spins if 3+ books.
  const resolve = (grid: Sym[][], rows: number): SpinResult => {
    const lines = makeLines(rows, lineCount(rows));
    const w = wFor(rows);
    const frames: Frame[] = [];
    let total = 0;
    const baseLines = evalLines(grid, lines, pay, B, B);
    const books = countB(grid);
    const bookCells: string[] = [];
    for (let c = 0; c < 5; c++) for (let r = 0; r < rows; r++) if (grid[c][r] === B) bookCells.push(key(c, r));
    total += baseLines.mult + bookPay(books);
    frames.push({
      grid: grid.map((c) => [...c]),
      highlights: [...new Set([...baseLines.highlights, ...bookCells])],
      win: baseLines.mult + bookPay(books),
      label: books >= 3 ? "3 📕 — 10 Free Spins!" : undefined,
    });
    if (books >= 3) {
      const poolSyms = ["🔟", "🇯", "🇶", "🇰", "🇦", "👁️", "🦋", "🐐", "🐈‍⬛", "🧙‍♀️"];
      const draw = () => poolSyms[Math.floor(Math.random() * poolSyms.length)];
      const d1 = draw();
      const d2 = draw();
      const special = pay(d1, 5) >= pay(d2, 5) ? d1 : d2; // redraw → keep better
      let fsLeft = 10;
      let i = 0;
      while (fsLeft > 0 && i < 50) {
        fsLeft--;
        i++;
        const fg = genGrid(5, rows, syms, w);
        const hl: string[] = [];
        for (let c = 0; c < 5; c++) {
          if (fg[c].includes(special)) {
            for (let r = 0; r < rows; r++) {
              fg[c][r] = special;
              hl.push(key(c, r));
            }
          }
        }
        const ln = evalLines(fg, lines, pay, B, B);
        const fb = countB(fg);
        const win = ln.mult + bookPay(fb);
        if (fb >= 3) fsLeft += 10;
        total += win;
        frames.push({ grid: fg, highlights: [...new Set([...hl, ...ln.highlights])], win, label: `Free spin ${i} · ${special}${fb >= 3 ? " · +10!" : ""}` });
      }
    }
    const rowFactor = rows >= 5 ? 0.7 : rows >= 4 ? 0.9 : 1;
    return { frames, totalMult: cap(total * rowFactor) };
  };

  return {
    id: "shadows",
    name: "Book of Shadows",
    style: "Book · Shadow Rows",
    icon: "📕",
    blurb: "Book wild+scatter · Lucky Locks · 3/4/5 rows · golden free spins · gamble.",
    symbols: syms,
    cols: 5,
    rowOptions: [3, 4, 5],
    scatterSym: B,
    scatterTrigger: 3,
    buyCost: 60,
    luckyLocks: true,
    gamble: true,
    spin: (_b, _l, opts) => {
      const rows = opts?.rows ?? 3;
      const grid = genGrid(5, rows, syms, wFor(rows));
      if (opts?.buy) forceScatters(grid, B, 3);
      return resolve(grid, rows);
    },
    // Lucky Locks: keep the chosen reels, respin the rest, then re-resolve.
    respin: (grid, lockedCols, rows) => {
      const w = wFor(rows);
      const ng = grid.map((col, c) =>
        lockedCols.includes(c) ? col.slice() : Array.from({ length: rows }, () => weightedPick(syms, w)),
      );
      return resolve(ng, rows);
    },
    // Respin price scales with the locked symbols — books cost the most.
    lockCost: (grid, lockedCols) => {
      let cost = 0;
      for (const c of lockedCols) {
        const col = grid[c];
        if (col.includes(B)) cost += 20;
        else if (col.some((s) => HIGHS.has(s))) cost += 2;
        else cost += 0.6;
      }
      return Math.round(cost * 100) / 100;
    },
  };
})();

export const SLOT_GAMES: SlotGame[] = [
  shadows,
  scatterPays,
  megaways,
  cluster,
  holdwin,
  cascade,
  book,
  jackpot,
  ways243,
  video,
  classic,
];

export function slotById(id: string): SlotGame | undefined {
  return SLOT_GAMES.find((g) => g.id === id);
}
