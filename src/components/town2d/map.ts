// 2D Pokemon-style overworld map. The map is a grid of TILE-by-TILE pixel
// cells; each cell has a single-char symbol that determines walkability and
// rendering. Buildings are coloured blocks (lowercase letters) with one
// labelled door tile (uppercase letter) — the player walks into the door to
// open that feature's menu as an in-world modal.
//
// Symbol legend (kept terse so the map literal stays readable):
//   .  grass             - walkable
//   ,  path              - walkable, dirt path
//   f  flowers           - walkable, decorative
//   t  tree              - blocked
//   F  fence             - blocked
//   w  water             - blocked
//   s  sign post         - blocked, interactable (future)
//   #  generic wall      - blocked, gray
//   j/J career office (blue) — door J → /jobs
//   b/B business HQ  (purple) — door B → /business
//   m/M markets      (green) — door M → /invest
//   r/R real estate  (amber) — door R → /realestate
//   c/C casino       (red) — door C → /gambling
//   h/H city hall    (slate) — door H → /economy
//   y/T trophy hall  (yellow) — door T → /goals
//   l/L leaderboard  (pink) — door L → /leaderboard

export const TILE = 32;

export type TileSymbol = string;

export interface DoorInfo {
  id: string;
  label: string;
  icon: string;
  color: string;
  route: string; // existing menu route to open as a modal
}

export interface BuildingPalette {
  wall: string; // tailwind hex
  roof: string; // accent line at top
  door: string;
}

// Door symbols → which feature page to open. Single chars only so the map
// literal stays one-char-per-cell.
export const DOORS: Record<string, DoorInfo> = {
  J: { id: "jobs", label: "Career Office", icon: "💼", color: "#0ea5e9", route: "/jobs" },
  B: { id: "business", label: "Business HQ", icon: "🏢", color: "#a855f7", route: "/business" },
  M: { id: "markets", label: "Stock Market", icon: "📈", color: "#22c55e", route: "/invest" },
  R: { id: "realestate", label: "Real Estate", icon: "🏘️", color: "#f59e0b", route: "/realestate" },
  C: { id: "casino", label: "Casino", icon: "🎰", color: "#ef4444", route: "/gambling" },
  H: { id: "economy", label: "City Hall", icon: "🌍", color: "#94a3b8", route: "/economy" },
  T: { id: "goals", label: "Trophy Hall", icon: "🏆", color: "#eab308", route: "/goals" },
  L: { id: "leaderboard", label: "Leaderboard", icon: "📊", color: "#ec4899", route: "/leaderboard" },
};

// Lowercase wall symbol → which building it belongs to. Used for colouring.
export const WALL_BUILDING: Record<string, keyof typeof DOORS> = {
  j: "J", b: "B", m: "M", r: "R", c: "C", h: "H", y: "T", l: "L",
};

// Building wall palettes — wall body, top-of-roof accent, door frame.
export const PALETTES: Record<string, BuildingPalette> = {
  J: { wall: "#0c4a6e", roof: "#0ea5e9", door: "#7dd3fc" },
  B: { wall: "#4c1d95", roof: "#a855f7", door: "#c4b5fd" },
  M: { wall: "#14532d", roof: "#22c55e", door: "#86efac" },
  R: { wall: "#78350f", roof: "#f59e0b", door: "#fcd34d" },
  C: { wall: "#7f1d1d", roof: "#ef4444", door: "#fca5a5" },
  H: { wall: "#334155", roof: "#94a3b8", door: "#cbd5e1" },
  T: { wall: "#713f12", roof: "#eab308", door: "#fde047" },
  L: { wall: "#831843", roof: "#ec4899", door: "#f9a8d4" },
};

// Map literal — each row is a single-char-per-cell string. The map is laid
// out top-down as drawn; top of the string = top of the screen. Width and
// height are derived from MAP_RAW.
//
// Layout: 8 buildings around a central plaza, joined by dirt paths. Spawn
// is on the south path so the first thing the player sees is the casino /
// trophy / leaderboard buildings (the fun stuff).
const MAP_RAW = [
  "FFFFFFFFFFFFFFFFFFFFFFFFFF",
  "F.tt..............t.....tF",
  "F.t...jjjjj....bbbbb....tF",
  "F.....jjjjj....bbbbb....tF",
  "F.....jjJjj....bbBbb.....F",
  "F.,,,,,,,,,,,,,,,,,,,,,,.F",
  "F.,t.....,,......,,.....tF",
  "F.,t..mmmmm,,..,,hhhhh..tF",
  "F.,...mmmmm,,..,,hhhhh...F",
  "F.,...mmMmm,,..,,hhHhh...F",
  "F.,,,,,,,,,,,,,,,,,,,,,,.F",
  "F.,....,,...ffff...,,....F",
  "F.,....,,..ffssff..,,....F",
  "F.,....,,..ffffff..,,....F",
  "F.,....,,...ffff...,,....F",
  "F.,,,,,,,,,,,,,,,,,,,,,,.F",
  "F.,...rrrrr,,..,,ccccc...F",
  "F.,...rrrrr,,..,,ccccc...F",
  "F.,t..rrRrr,,..,,ccCcc..tF",
  "F.,t..............tt....tF",
  "F.,,,,,,,,,,,,,,,,,,,,,,.F",
  "F.,...yyyyy,,..,,lllll...F",
  "F.,...yyyyy,,..,,lllll...F",
  "F.,...yyTyy,,..,,llLll..tF",
  "F.tt..............t.....tF",
  "FFFFFFFFFFFFFFFFFFFFFFFFFF",
];

export const MAP_W = MAP_RAW[0].length;
export const MAP_H = MAP_RAW.length;

const MAP: string[][] = MAP_RAW.map((row) => row.split(""));

// Sanity — every row must be MAP_W wide so the grid stays rectangular. Build
// fails loud rather than producing a ragged map.
if (process.env.NODE_ENV !== "production") {
  for (let y = 0; y < MAP.length; y++) {
    if (MAP[y].length !== MAP_W) {
      throw new Error(`town2d/map: row ${y} is ${MAP[y].length} wide, expected ${MAP_W}`);
    }
  }
}

export function tileAt(x: number, y: number): TileSymbol {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return "F";
  return MAP[y][x];
}

const WALKABLE = new Set([".", ",", "f"]);

// Walkable for stepping. Door tiles are NOT walkable — they trigger an
// interaction when bumped, leaving the player on the adjacent tile (Pokemon
// "step toward door → enter" feel).
export function isWalkable(x: number, y: number): boolean {
  return WALKABLE.has(tileAt(x, y));
}

export function doorAt(x: number, y: number): DoorInfo | null {
  const sym = tileAt(x, y);
  return DOORS[sym] ?? null;
}

// Returns the palette for any wall or door tile (so the renderer can colour
// the building consistently across all its cells), else null.
export function buildingPaletteAt(x: number, y: number): BuildingPalette | null {
  const sym = tileAt(x, y);
  if (sym in DOORS) return PALETTES[sym];
  if (sym in WALL_BUILDING) return PALETTES[WALL_BUILDING[sym]];
  return null;
}

// True if the tile is part of a building (wall or door).
export function isBuilding(x: number, y: number): boolean {
  const sym = tileAt(x, y);
  return sym in DOORS || sym in WALL_BUILDING;
}

// Roof row marker — used so the top row of a building gets a different shade
// for visual depth. A wall cell is "roof" if the cell above it is not part
// of the same building.
export function isRoofCell(x: number, y: number): boolean {
  if (!isBuilding(x, y)) return false;
  return !isBuilding(x, y - 1);
}

// Player spawn — central plaza, south of the flower garden.
export const SPAWN = { x: 12, y: 15 };

// Visual variant id for trees/flowers — derived from coordinates so
// neighbours look slightly different without needing per-tile data.
export function variant(x: number, y: number): number {
  return (x * 31 + y * 17) % 3;
}
