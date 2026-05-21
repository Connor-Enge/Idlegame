// Shared slot engine: grid generation, RNG, and the family of win evaluators
// (paylines, ways-to-win, clusters, scatter/pay-anywhere) plus tumble logic.
// Grids are column-major: grid[col][row], row 0 = top.

export type Sym = string;

export interface Frame {
  grid: Sym[][];
  highlights?: string[]; // "col,row" cells to flash
  label?: string; // e.g. "Cascade ×3", "Respin 2", "Free spin 4/8"
  win?: number; // payout multiplier credited on this frame
}

export interface SpinResult {
  frames: Frame[];
  totalMult: number; // total payout as a multiple of the bet
  ways?: number; // optional, for Megaways display
  note?: string;
}

export const key = (c: number, r: number) => `${c},${r}`;

export function weightedPick(syms: Sym[], weights: number[]): Sym {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = Math.random() * total;
  for (let i = 0; i < syms.length; i++) {
    x -= weights[i];
    if (x <= 0) return syms[i];
  }
  return syms[syms.length - 1];
}

export function genGrid(cols: number, rows: number, syms: Sym[], weights: number[]): Sym[][] {
  const g: Sym[][] = [];
  for (let c = 0; c < cols; c++) {
    const col: Sym[] = [];
    for (let r = 0; r < rows; r++) col.push(weightedPick(syms, weights));
    g.push(col);
  }
  return g;
}

// Variable-height reels (Megaways): each reel gets its own row count.
export function genVariableGrid(
  cols: number,
  minRows: number,
  maxRows: number,
  syms: Sym[],
  weights: number[],
): Sym[][] {
  const g: Sym[][] = [];
  for (let c = 0; c < cols; c++) {
    const rows = minRows + Math.floor(Math.random() * (maxRows - minRows + 1));
    const col: Sym[] = [];
    for (let r = 0; r < rows; r++) col.push(weightedPick(syms, weights));
    g.push(col);
  }
  return g;
}

// ---- Payline evaluation (left-to-right from reel 0) ----
export function evalLines(
  grid: Sym[][],
  lines: number[][],
  pay: (s: Sym, count: number) => number,
  wild?: Sym,
  scatter?: Sym,
): { mult: number; highlights: string[] } {
  let mult = 0;
  const hl = new Set<string>();
  for (const line of lines) {
    let base: Sym | null = null;
    for (let c = 0; c < grid.length; c++) {
      const s = grid[c][line[c]];
      if (wild && s === wild) continue;
      base = s;
      break;
    }
    if (base === null) base = wild ?? null;
    if (base === null || base === scatter) continue;
    let count = 0;
    for (let c = 0; c < grid.length; c++) {
      const s = grid[c][line[c]];
      if (s === base || (wild && s === wild)) count++;
      else break;
    }
    if (count >= 3) {
      const m = pay(base, count);
      if (m > 0) {
        mult += m;
        for (let c = 0; c < count; c++) hl.add(key(c, line[c]));
      }
    }
  }
  return { mult, highlights: [...hl] };
}

// ---- Ways-to-win (adjacent reels from reel 0); supports variable heights ----
export function evalWays(
  grid: Sym[][],
  pay: (s: Sym, reels: number) => number,
  opts: { wild?: Sym; scatter?: Sym } = {},
): { mult: number; highlights: string[] } {
  const { wild, scatter } = opts;
  let mult = 0;
  const hl = new Set<string>();
  const candidates = new Set(grid[0].filter((s) => s !== scatter && s !== wild));
  // If reel 0 is all wild, every symbol is a candidate.
  if (candidates.size === 0) for (const col of grid) for (const s of col) if (s !== scatter && s !== wild) candidates.add(s);

  for (const s of candidates) {
    let ways = 1;
    let reels = 0;
    const pos: string[] = [];
    for (let c = 0; c < grid.length; c++) {
      let cnt = 0;
      const cellPos: string[] = [];
      for (let r = 0; r < grid[c].length; r++) {
        if (grid[c][r] === s || (wild && grid[c][r] === wild)) {
          cnt++;
          cellPos.push(key(c, r));
        }
      }
      if (cnt === 0) break;
      ways *= cnt;
      reels++;
      pos.push(...cellPos);
    }
    if (reels >= 3) {
      const m = pay(s, reels) * ways;
      if (m > 0) {
        mult += m;
        pos.forEach((p) => hl.add(p));
      }
    }
  }
  return { mult, highlights: [...hl] };
}

// ---- Cluster pays (4-neighbour flood fill) ----
export function evalClusters(
  grid: Sym[][],
  pay: (s: Sym, size: number) => number,
  minSize = 5,
  exclude: Sym[] = [],
): { mult: number; highlights: string[] } {
  const cols = grid.length;
  const rows = grid[0].length;
  const seen = new Set<string>();
  let mult = 0;
  const hl: string[] = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const k = key(c, r);
      if (seen.has(k)) continue;
      const sym = grid[c][r];
      seen.add(k);
      if (exclude.includes(sym)) continue;
      const stack: [number, number][] = [[c, r]];
      const group: [number, number][] = [];
      while (stack.length) {
        const [cc, rr] = stack.pop()!;
        group.push([cc, rr]);
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nc = cc + dc;
          const nr = rr + dr;
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
          const nk = key(nc, nr);
          if (seen.has(nk) || grid[nc][nr] !== sym) continue;
          seen.add(nk);
          stack.push([nc, nr]);
        }
      }
      if (group.length >= minSize) {
        mult += pay(sym, group.length);
        for (const [gc, gr] of group) hl.push(key(gc, gr));
      }
    }
  }
  return { mult, highlights: hl };
}

// ---- Scatter / pay-anywhere ----
export function evalScatterPays(
  grid: Sym[][],
  pay: (s: Sym, count: number) => number,
  minCount = 8,
  exclude: Sym[] = [],
): { mult: number; highlights: string[] } {
  const counts = new Map<Sym, { n: number; pos: string[] }>();
  for (let c = 0; c < grid.length; c++) {
    for (let r = 0; r < grid[c].length; r++) {
      const s = grid[c][r];
      if (exclude.includes(s)) continue;
      const e = counts.get(s) ?? { n: 0, pos: [] };
      e.n++;
      e.pos.push(key(c, r));
      counts.set(s, e);
    }
  }
  let mult = 0;
  const hl: string[] = [];
  for (const [sym, { n, pos }] of counts) {
    if (n >= minCount) {
      mult += pay(sym, n);
      hl.push(...pos);
    }
  }
  return { mult, highlights: hl };
}

// Remove winning cells, collapse columns downward, refill from the top.
export function tumble(grid: Sym[][], remove: Set<string>, syms: Sym[], weights: number[]): Sym[][] {
  const out: Sym[][] = [];
  for (let c = 0; c < grid.length; c++) {
    const rows = grid[c].length;
    const kept: Sym[] = [];
    for (let r = 0; r < rows; r++) if (!remove.has(key(c, r))) kept.push(grid[c][r]);
    const need = rows - kept.length;
    const top: Sym[] = [];
    for (let i = 0; i < need; i++) top.push(weightedPick(syms, weights));
    out.push([...top, ...kept]);
  }
  return out;
}

export function countWays(grid: Sym[][]): number {
  return grid.reduce((acc, col) => acc * col.length, 1);
}
