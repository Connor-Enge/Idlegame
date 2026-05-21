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
  spin: (bet: number, luck: number) => SpinResult;
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
};

// Global safety cap so a freak win can't bankrupt the house economy.
const CAP = 8000;
const cap = (m: number) => Math.min(CAP, Math.round(m * 100) / 100);

// Per-game RTP calibration. Every game's payouts are scaled by this so the
// long-run return-to-player sits around ~90% (house edge ~10%). Tuned against
// a Monte-Carlo probe; adjust here to retune without touching paytables.
const CAL: Record<string, number> = {
  scatter: 0.024,
  megaways: 0.097,
  cluster: 3.2,
  holdwin: 0.9,
  cascade: 0.085,
  book: 0.35,
  jackpot: 0.081,
  ways243: 0.73,
  video: 0.42,
  classic: 2.4,
};

// ---------------------------------------------------------------------------
// 1. Classic 3-reel — single payline, fruit machine.
// ---------------------------------------------------------------------------
const classic: SlotGame = (() => {
  const syms = ["🍒", "🍋", "🍊", "🔔", "⭐", "💰", "7️⃣"];
  const weights = [22, 20, 18, 12, 8, 5, 2];
  const pay3: Record<string, number> = { "🍒": 4, "🍋": 6, "🍊": 8, "🔔": 14, "⭐": 25, "💰": 60, "7️⃣": 150 };
  return {
    id: "classic",
    name: "Lucky Sevens",
    style: "Classic 3-Reel",
    icon: "🍒",
    blurb: "One payline. Pure nostalgia.",
    symbols: syms,
    cols: 3,
    spin: () => {
      const grid = genGrid(3, 1, syms, weights);
      const row = [grid[0][0], grid[1][0], grid[2][0]];
      let mult = 0;
      const hl: string[] = [];
      if (row[0] === row[1] && row[1] === row[2]) {
        mult = pay3[row[0]] * CAL.classic;
        hl.push(key(0, 0), key(1, 0), key(2, 0));
      } else if (row[0] === "🍒" && row[1] === "🍒") {
        mult = 2 * CAL.classic;
        hl.push(key(0, 0), key(1, 0));
      }
      return { frames: [{ grid, highlights: hl, win: mult }], totalMult: cap(mult) };
    },
  };
})();

// ---------------------------------------------------------------------------
// 2. 5x3 video slot — 20 paylines with wilds.
// ---------------------------------------------------------------------------
const video: SlotGame = (() => {
  const W = "🃏";
  const syms = ["🍇", "🍉", "🔔", "🪙", "💎", "👑", W];
  const weights = [26, 22, 16, 12, 8, 5, 6];
  const table: Record<string, [number, number, number]> = {
    "🍇": [0.4, 1, 3],
    "🍉": [0.5, 1.5, 4],
    "🔔": [0.8, 2.5, 8],
    "🪙": [1, 4, 15],
    "💎": [2, 8, 30],
    "👑": [4, 15, 60],
  };
  const L = [
    [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2],
    [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [1, 0, 0, 0, 1],
    [1, 2, 2, 2, 1], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0],
    [1, 2, 1, 0, 1], [1, 0, 1, 2, 1], [0, 1, 1, 1, 0],
    [2, 1, 1, 1, 2], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2],
    [1, 1, 0, 1, 1], [1, 1, 2, 1, 1], [0, 0, 2, 0, 0],
    [2, 2, 0, 2, 2], [0, 2, 0, 2, 0],
  ];
  const pay = (s: Sym, c: number) => (table[s] ? (table[s][c - 3] ?? 0) * CAL.video : 0);
  return {
    id: "video",
    name: "Royal Riches",
    style: "20-Line Video",
    icon: "👑",
    blurb: "20 paylines, wild jokers.",
    symbols: syms,
    cols: 5,
    spin: () => {
      const grid = genGrid(5, 3, syms, weights);
      const { mult, highlights } = evalLines(grid, L, pay, W);
      return { frames: [{ grid, highlights, win: mult }], totalMult: cap(mult) };
    },
  };
})();

// ---------------------------------------------------------------------------
// 3. 243 Ways to win — 5x3 adjacent-reel matching.
// ---------------------------------------------------------------------------
const ways243: SlotGame = (() => {
  const syms = ["🦊", "🐺", "🦌", "🦅", "🐉", "🌙"];
  const weights = [26, 22, 17, 12, 7, 16];
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
    blurb: "No lines — 243 ways to win.",
    symbols: syms,
    cols: 5,
    spin: () => {
      const grid = genGrid(5, 3, syms, weights);
      const { mult, highlights } = evalWays(grid, pay, { scatter: "🌙" });
      return { frames: [{ grid, highlights, win: mult }], totalMult: cap(mult), ways: 243 };
    },
  };
})();

// ---------------------------------------------------------------------------
// 4. Megaways — 6 reels, 2-7 symbols each, up to 117,649 ways.
// ---------------------------------------------------------------------------
const megaways: SlotGame = (() => {
  const syms = ["💠", "🟦", "🟩", "🟧", "🔺", "💎", "🏆"];
  const weights = [24, 22, 18, 14, 10, 7, 5];
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
  return {
    id: "megaways",
    name: "Mega Fortune X",
    style: "Megaways",
    icon: "💠",
    blurb: "Up to 117,649 ways every spin.",
    symbols: syms,
    cols: 6,
    spin: () => {
      const grid = genVariableGrid(6, 2, 7, syms, weights);
      const { mult, highlights } = evalWays(grid, pay, {});
      return { frames: [{ grid, highlights, win: mult }], totalMult: cap(mult), ways: countWays(grid) };
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
    let m = 0.4; // 5-6
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
      while (chain < 12) {
        const { mult, highlights } = evalClusters(grid, pay, 5);
        if (mult <= 0 || highlights.length === 0) {
          if (chain === 0) frames.push({ grid, win: 0 });
          break;
        }
        const m = mult * (1 + chain * 0.5); // rising cascade multiplier
        total += m;
        frames.push({ grid, highlights, win: m, label: chain > 0 ? `Cascade ×${(1 + chain * 0.5).toFixed(1)}` : undefined });
        grid = tumble(grid, new Set(highlights), syms, weights);
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
  const syms = ["🍫", "🍬", "🍭", "🧁", "🍩", "🎂"];
  const weights = [24, 21, 17, 13, 9, 16];
  const table: Record<string, [number, number, number]> = {
    "🍫": [0.2, 0.5, 1.2],
    "🍬": [0.3, 0.7, 1.8],
    "🍭": [0.4, 1, 2.5],
    "🧁": [0.6, 1.6, 4],
    "🍩": [1, 3, 8],
  };
  const MULTS = [1, 2, 3, 5, 8, 12, 20];
  const pay = (s: Sym, reels: number) => (table[s] ? (table[s][reels - 3] ?? 0) * CAL.cascade : 0);
  return {
    id: "cascade",
    name: "Sugar Cascade",
    style: "Cascading Reels",
    icon: "🍭",
    blurb: "Tumbles with a rising multiplier.",
    symbols: syms,
    cols: 5,
    spin: () => {
      let grid = genGrid(5, 4, syms, weights);
      const frames: Frame[] = [];
      let total = 0;
      let step = 0;
      while (step < 7) {
        const { mult, highlights } = evalWays(grid, pay, { scatter: "🎂" });
        if (mult <= 0) {
          if (step === 0) frames.push({ grid, win: 0 });
          break;
        }
        const m = mult * MULTS[Math.min(step, MULTS.length - 1)];
        total += m;
        frames.push({ grid, highlights, win: m, label: step > 0 ? `×${MULTS[Math.min(step, MULTS.length - 1)]} multiplier` : undefined });
        grid = tumble(grid, new Set(highlights), syms, weights);
        step++;
      }
      return { frames, totalMult: cap(total) };
    },
  };
})();

// ---------------------------------------------------------------------------
// 7. Scatter / pay-anywhere — 6x5, pay on 8+, tumble, multiplier bombs.
// ---------------------------------------------------------------------------
const scatterPays: SlotGame = (() => {
  const M = "✖️";
  const syms = ["🍌", "🍎", "🍓", "🍑", "🫐", "🍭", M];
  const weights = [22, 20, 16, 13, 10, 8, 4];
  const table: Record<string, (n: number) => number> = {};
  const base: Record<string, [number, number, number]> = {
    "🍌": [0.25, 0.75, 2],
    "🍎": [0.4, 1.2, 3],
    "🍓": [0.5, 2, 5],
    "🍑": [0.8, 3, 8],
    "🫐": [1.2, 5, 12],
    "🍭": [2, 10, 25],
  };
  for (const s of Object.keys(base)) {
    table[s] = (n: number) => {
      const t = base[s];
      if (n >= 12) return t[2];
      if (n >= 10) return t[1];
      return t[0]; // 8-9
    };
  }
  const pay = (s: Sym, n: number) => (table[s] ? table[s](n) * CAL.scatter : 0);
  return {
    id: "scatter",
    name: "Fruit Frenzy",
    style: "Pay Anywhere",
    icon: "🍓",
    blurb: "8+ anywhere pays. Tumbles + ✖️ bombs.",
    symbols: syms,
    cols: 6,
    spin: () => {
      let grid = genGrid(6, 5, syms, weights);
      const frames: Frame[] = [];
      let total = 0;
      let step = 0;
      while (step < 8) {
        const { mult, highlights } = evalScatterPays(grid, pay, 8, [M]);
        if (mult <= 0) {
          if (step === 0) frames.push({ grid, win: 0 });
          break;
        }
        total += mult;
        frames.push({ grid, highlights, win: mult });
        grid = tumble(grid, new Set(highlights), syms, weights);
        step++;
      }
      // After tumbles, ✖️ multiplier bombs on the board multiply the win.
      if (total > 0) {
        let bomb = 0;
        for (const col of grid) for (const s of col) if (s === M) bomb += 2 + Math.floor(Math.random() * 8);
        if (bomb > 0) {
          const before = total;
          total *= bomb;
          frames.push({ grid, label: `×${bomb} multiplier!`, win: total - before });
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
  const C = "🪙";
  const blank = "▫️";
  const syms = ["🔔", "🍀", "💵", "💎", C, blank];
  const weights = [20, 18, 14, 8, 10, 30];
  const coinValue = () => {
    const r = Math.random();
    if (r < 0.6) return 1;
    if (r < 0.85) return 2;
    if (r < 0.96) return 5;
    return 15;
  };
  const COLS = 5;
  const ROWS = 4;
  const CELLS = COLS * ROWS;
  return {
    id: "holdwin",
    name: "Coin Vault",
    style: "Hold & Win",
    icon: "🪙",
    blurb: "Collect 6+ coins to trigger respins.",
    symbols: syms,
    cols: COLS,
    spin: (bet) => {
      // Base spin.
      const grid = genGrid(COLS, ROWS, syms, weights);
      const frames: Frame[] = [];
      // Count coins; assign values.
      const coinVals = new Map<string, number>();
      const hl: string[] = [];
      for (let c = 0; c < COLS; c++)
        for (let r = 0; r < ROWS; r++)
          if (grid[c][r] === C) {
            coinVals.set(key(c, r), coinValue());
            hl.push(key(c, r));
          }
      frames.push({ grid, highlights: hl, label: `${coinVals.size} coins` });

      if (coinVals.size < 6) {
        return { frames, totalMult: 0 };
      }

      // Trigger Hold & Win: lock coins, 3 respins reset on each new coin.
      let respins = 3;
      const locked = new Map<string, number>(coinVals);
      let board = grid.map((col, c) => col.map((_, r) => (locked.has(key(c, r)) ? C : blank)));
      while (respins > 0 && locked.size < CELLS) {
        respins--;
        let newCoin = false;
        for (let c = 0; c < COLS; c++)
          for (let r = 0; r < ROWS; r++) {
            const k = key(c, r);
            if (locked.has(k)) continue;
            // Small chance each empty cell lands a coin on a respin.
            if (Math.random() < 0.16) {
              locked.set(k, coinValue());
              board[c][r] = C;
              newCoin = true;
            }
          }
        if (newCoin) respins = 3;
        frames.push({ grid: board.map((c) => [...c]), highlights: [...locked.keys()], label: `Respin · ${respins} left` });
      }

      let total = 0;
      for (const v of locked.values()) total += v;
      let note: string | undefined;
      if (locked.size >= CELLS) {
        total *= 5;
        note = "GRAND JACKPOT — full board!";
      }
      return { frames, totalMult: cap(total * CAL.holdwin), note };
    },
  };
})();

// ---------------------------------------------------------------------------
// 9. Expanding-wild "book" — 5x3, 10 lines, 3 books = 8 free spins.
// ---------------------------------------------------------------------------
const book: SlotGame = (() => {
  const B = "📖";
  const syms = ["🐍", "🐫", "🪲", "𓂀", "🏺", "👑", B];
  const weights = [24, 20, 16, 12, 8, 5, 7];
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
  const countBooks = (g: Sym[][]) => g.reduce((a, col) => a + col.filter((s) => s === B).length, 0);
  return {
    id: "book",
    name: "Book of Fortune",
    style: "Expanding Wild",
    icon: "📖",
    blurb: "3 books trigger 8 free spins with an expanding symbol.",
    symbols: syms,
    cols: 5,
    spin: () => {
      const grid = genGrid(5, 3, syms, weights);
      const frames: Frame[] = [];
      let total = 0;
      const base = evalLines(grid, L, pay, undefined, B);
      total += base.mult;
      frames.push({ grid, highlights: base.highlights, win: base.mult, label: countBooks(grid) >= 3 ? "3 books — Free Spins!" : undefined });

      if (countBooks(grid) >= 3) {
        // Choose one special expanding symbol for the feature.
        const pool = ["🐍", "🐫", "🪲", "𓂀", "🏺", "👑"];
        const special = pool[Math.floor(Math.random() * pool.length)];
        for (let fs = 1; fs <= 8; fs++) {
          const fg = genGrid(5, 3, syms, weights);
          // Any reel containing the special symbol expands to fill that reel.
          const hl: string[] = [];
          let expanded = false;
          for (let c = 0; c < 5; c++) {
            if (fg[c].includes(special)) {
              for (let r = 0; r < 3; r++) {
                fg[c][r] = special;
                hl.push(key(c, r));
              }
              expanded = true;
            }
          }
          let win = 0;
          if (expanded) {
            // Expanded symbol pays on all lines that run through expanded reels.
            const reelsHit = fg.filter((col) => col.every((s) => s === special)).length;
            if (reelsHit >= 3) win += pay(special, Math.min(5, reelsHit)) * 3;
          }
          const lines = evalLines(fg, L, pay, undefined, B);
          win += lines.mult;
          total += win;
          frames.push({ grid: fg, highlights: [...new Set([...hl, ...lines.highlights])], win, label: `Free spin ${fs}/8 · ${special}` });
        }
      }
      return { frames, totalMult: cap(total) };
    },
  };
})();

// ---------------------------------------------------------------------------
// 10. Progressive jackpot — 5x3 lines + collectible jackpot symbols.
// ---------------------------------------------------------------------------
const jackpot: SlotGame = (() => {
  const J = "💰";
  const syms = ["🎰", "🍀", "💍", "⌛", "🔮", J];
  const weights = [24, 20, 15, 11, 7, 6];
  const table: Record<string, [number, number, number]> = {
    "🎰": [0.4, 1.2, 3],
    "🍀": [0.6, 2, 5],
    "💍": [1, 3, 10],
    "⌛": [1.5, 5, 18],
    "🔮": [3, 10, 40],
  };
  const L = [
    [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2],
    [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [1, 0, 1, 2, 1],
    [1, 2, 1, 0, 1], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [0, 1, 0, 1, 0],
  ];
  const pay = (s: Sym, c: number) => (table[s] ? (table[s][c - 3] ?? 0) * CAL.jackpot : 0);
  // Pots grow over the session for flavor; trigger pays a fixed multiple.
  const POTS = { Mini: 20 * CAL.jackpot, Minor: 100 * CAL.jackpot, Major: 1000 * CAL.jackpot, Grand: 10000 * CAL.jackpot };
  return {
    id: "jackpot",
    name: "Jackpot Royale",
    style: "Progressive Jackpot",
    icon: "💰",
    blurb: "Collect 💰 for Mini → Grand jackpots.",
    symbols: syms,
    cols: 5,
    spin: () => {
      const grid = genGrid(5, 3, syms, weights);
      const frames: Frame[] = [];
      const lines = evalLines(grid, L, pay, undefined, J);
      let total = lines.mult;
      const jCells: string[] = [];
      for (let c = 0; c < 5; c++) for (let r = 0; r < 3; r++) if (grid[c][r] === J) jCells.push(key(c, r));
      let note: string | undefined;
      frames.push({ grid, highlights: lines.highlights, win: lines.mult });
      if (jCells.length >= 3) {
        let tier: keyof typeof POTS = "Mini";
        if (jCells.length >= 6) tier = "Grand";
        else if (jCells.length === 5) tier = "Major";
        else if (jCells.length === 4) tier = "Minor";
        total += POTS[tier];
        note = `${tier} Jackpot! +${POTS[tier]}×`;
        frames.push({ grid, highlights: jCells, win: POTS[tier], label: note });
      }
      return { frames, totalMult: cap(total), note };
    },
  };
})();

export const SLOT_GAMES: SlotGame[] = [
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
