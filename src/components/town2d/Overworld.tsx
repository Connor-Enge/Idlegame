"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  TILE,
  MAP_W,
  MAP_H,
  SPAWN,
  tileAt,
  isWalkable,
  doorAt,
  signAt,
  buildingPaletteAt,
  isBuilding,
  isRoofCell,
  variant,
  DOORS,
  type DoorInfo,
} from "./map";
import { PlayerSprite, type Dir } from "./Sprite";
import NPCs, { type NPCsHandle } from "./NPCs";
import Pickups from "./Pickups";

export interface DialogPayload {
  who?: string;
  lines: string[];
}

const STEP_MS = 170; // duration of one tile step
const DAY_LENGTH_MS = 300_000; // 5 min real time = one full day cycle

// Day-night palette. tod is 0..1; 0 = midnight, 0.5 = noon. Returns a tint
// colour + opacity that we paint over the world with `mix-blend-mode:
// multiply` so the underlying tiles stay readable but feel warmer / cooler.
function dayTint(tod: number): { color: string; opacity: number } {
  // Sun height: 0 at midnight, 1 at noon.
  const sun = Math.max(0, Math.sin(tod * Math.PI * 2 - Math.PI / 2) + 1) / 2;
  if (sun < 0.15) {
    // Deep night → indigo overlay
    return { color: "#0c1530", opacity: 0.55 - sun * 0.5 };
  }
  if (sun < 0.35) {
    // Dawn / dusk — depend on which side of noon we're on.
    const isDawn = tod < 0.5;
    return { color: isDawn ? "#fb923c" : "#ec4899", opacity: 0.32 };
  }
  if (sun < 0.7) {
    // Morning / afternoon — mild warm tint
    return { color: "#fde68a", opacity: 0.12 };
  }
  // Full day — clear
  return { color: "#ffffff", opacity: 0 };
}

// All possible movement directions, with the (dx, dy) they apply to (x, y).
const DIRS: Record<Dir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

// Camera viewport — the part of the map visible at once. Smaller than the
// map so the camera scrolls as the player walks. Sized to fit the 480-px
// phone frame with a comfortable vertical margin.
const VIEW_W = 13; // tiles wide visible
const VIEW_H = 18; // tiles tall visible
const VIEW_PX_W = VIEW_W * TILE; // 416
const VIEW_PX_H = VIEW_H * TILE; // 576

const POS_KEY = "town2d:pos";

interface SavedPos { x: number; y: number; facing: Dir }

function readSavedPos(): SavedPos {
  if (typeof window === "undefined") return { x: SPAWN.x, y: SPAWN.y, facing: "down" };
  try {
    const raw = window.localStorage.getItem(POS_KEY);
    if (!raw) return { x: SPAWN.x, y: SPAWN.y, facing: "down" };
    const parsed = JSON.parse(raw);
    // Sanity — if the map shrank since last save, fall back to spawn.
    const x = typeof parsed.x === "number" ? parsed.x : SPAWN.x;
    const y = typeof parsed.y === "number" ? parsed.y : SPAWN.y;
    const facing = ["up", "down", "left", "right"].includes(parsed.facing) ? parsed.facing : "down";
    if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return { x: SPAWN.x, y: SPAWN.y, facing: "down" };
    if (!isWalkable(x, y)) return { x: SPAWN.x, y: SPAWN.y, facing: "down" };
    return { x, y, facing };
  } catch {
    return { x: SPAWN.x, y: SPAWN.y, facing: "down" };
  }
}

function writeSavedPos(p: SavedPos) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch {}
}

export default function Overworld({
  heldDir,
  onEnterDoor,
  onDialog,
  questTarget,
}: {
  heldDir: Dir | null;
  onEnterDoor: (door: DoorInfo) => void;
  onDialog: (payload: DialogPayload) => void;
  // Door symbol key (e.g. "J") whose door should show a quest indicator,
  // or null for none. The Overworld looks up the door's tile coords from
  // the map and floats an arrow above it.
  questTarget: string | null;
}) {
  const npcsRef = useRef<NPCsHandle>(null);
  // Time of day, persists for the page lifetime. Starts at noon so the first
  // load shows a clear daylight scene.
  const [tod, setTod] = useState(0.5);
  useEffect(() => {
    const t = setInterval(() => {
      setTod((cur) => (cur + 200 / DAY_LENGTH_MS) % 1);
    }, 200);
    return () => clearInterval(t);
  }, []);
  const tint = dayTint(tod);
  // Player position persists across reloads — read on mount, write on every
  // committed step. SSR-safe because the parent dynamic-loads this as
  // ssr:false, but we still guard against malformed storage.
  const initial = readSavedPos();
  const [px, setPx] = useState(initial.x);
  const [py, setPy] = useState(initial.y);
  const [facing, setFacing] = useState<Dir>(initial.facing);
  // Step animation state. step !== null while in-flight.
  const [phase, setPhase] = useState(0); // 0..1 within the active step
  const stepRef = useRef<null | { from: { x: number; y: number }; to: { x: number; y: number }; start: number }>(null);
  const heldRef = useRef<Dir | null>(heldDir);
  heldRef.current = heldDir;
  // Short-lived collection floaters. Each carries world coords + an amount;
  // they fade out via CSS animation and are pruned by a short timer.
  const [floats, setFloats] = useState<{ id: number; x: number; y: number; amount: number }[]>([]);
  const onCashCollect = useCallback((amount: number, x: number, y: number) => {
    const id = Date.now() + Math.random();
    setFloats((f) => [...f, { id, x, y, amount }]);
    setTimeout(() => setFloats((f) => f.filter((it) => it.id !== id)), 1200);
  }, []);

  // Drive the step machine with a single rAF loop. Held direction is read
  // from a ref so the loop never re-binds on input changes.
  useEffect(() => {
    let raf = 0;
    const loop = (t: number) => {
      const s = stepRef.current;
      if (s) {
        const elapsed = t - s.start;
        const p = Math.min(1, elapsed / STEP_MS);
        setPhase(p);
        if (p >= 1) {
          // Commit the step.
          stepRef.current = null;
          setPx(s.to.x);
          setPy(s.to.y);
          setPhase(0);
          writeSavedPos({ x: s.to.x, y: s.to.y, facing: heldRef.current ?? "down" });
          // Chain into the next step immediately if the player is still
          // holding a direction — Pokemon-style continuous walking.
          tryStartStep(s.to.x, s.to.y);
        }
      } else {
        // Idle — see if a held direction should start a step now.
        tryStartStep(px, py);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [px, py]);

  // Keyboard input — bound globally so the player can walk without focusing
  // the canvas. Maps WASD + arrows to the same directions the on-screen pad
  // emits. We mirror to the same ref the d-pad uses.
  useEffect(() => {
    const map: Record<string, Dir> = {
      ArrowUp: "up", w: "up", W: "up",
      ArrowDown: "down", s: "down", S: "down",
      ArrowLeft: "left", a: "left", A: "left",
      ArrowRight: "right", d: "right", D: "right",
    };
    const down = (e: KeyboardEvent) => { const d = map[e.key]; if (d) { e.preventDefault(); heldRef.current = d; } };
    const up = (e: KeyboardEvent) => { const d = map[e.key]; if (d && heldRef.current === d) heldRef.current = null; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  function tryStartStep(fromX: number, fromY: number) {
    const dir = heldRef.current;
    if (!dir) return;
    setFacing(dir);
    const { dx, dy } = DIRS[dir];
    const tx = fromX + dx;
    const ty = fromY + dy;
    // Door interaction takes priority — bumping into a door opens it,
    // player stays put.
    const door = doorAt(tx, ty);
    if (door) {
      heldRef.current = null; // consume hold so it doesn't auto-retrigger
      onEnterDoor(door);
      return;
    }
    const sign = signAt(tx, ty);
    if (sign) {
      heldRef.current = null;
      onDialog({ lines: sign });
      return;
    }
    const npc = npcsRef.current?.npcAt(tx, ty);
    if (npc) {
      heldRef.current = null;
      onDialog({ who: npc.name, lines: npc.lines });
      return;
    }
    if (!isWalkable(tx, ty)) return; // blocked — face only
    stepRef.current = { from: { x: fromX, y: fromY }, to: { x: tx, y: ty }, start: performance.now() };
  }

  // Interpolated pixel position for the player + camera. During a step the
  // player slides smoothly from `from` to `to`; at rest, sits at (px, py).
  const renderX = stepRef.current
    ? stepRef.current.from.x + (stepRef.current.to.x - stepRef.current.from.x) * phase
    : px;
  const renderY = stepRef.current
    ? stepRef.current.from.y + (stepRef.current.to.y - stepRef.current.from.y) * phase
    : py;

  // Camera follows the player, clamped to map edges so the void never shows.
  const camX = Math.max(0, Math.min(MAP_W * TILE - VIEW_PX_W, renderX * TILE + TILE / 2 - VIEW_PX_W / 2));
  const camY = Math.max(0, Math.min(MAP_H * TILE - VIEW_PX_H, renderY * TILE + TILE / 2 - VIEW_PX_H / 2));

  return (
    <div
      className="relative mx-auto overflow-hidden bg-[#162017]"
      style={{ width: VIEW_PX_W, height: VIEW_PX_H, imageRendering: "pixelated" }}
    >
      {/* Day/night tint overlay — covers the viewport, sits above the world
          but beneath any HUD. Uses multiply so dark tiles get darker and
          light tiles get coloured without losing detail. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: tint.color,
          opacity: tint.opacity,
          mixBlendMode: "multiply",
          pointerEvents: "none",
          zIndex: 60,
          transition: "background 400ms linear, opacity 400ms linear",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -camX,
          top: -camY,
          width: MAP_W * TILE,
          height: MAP_H * TILE,
        }}
      >
        <Tiles />

        {/* Money pickups — collected when the player's tile matches. */}
        <Pickups playerTile={{ x: px, y: py }} onCollect={onCashCollect} />

        {/* Wandering NPCs — bumping into one opens their dialog. */}
        <NPCs ref={npcsRef} />

        {/* Player — rendered above tiles. Pixel position interpolated. */}
        <div
          style={{
            position: "absolute",
            left: renderX * TILE,
            top: renderY * TILE,
            width: TILE,
            height: TILE,
            zIndex: Math.floor(renderY) + 2,
          }}
        >
          <PlayerSprite
            facing={facing}
            walking={stepRef.current !== null}
            phase={phase}
          />
        </div>

        {/* Door labels — float above each door so the player can see where
            they're heading. zIndex puts them under the player when they're
            standing in front of the door. */}
        <DoorLabels questTarget={questTarget} />

        {/* Collection floaters — fade-up "+$N" indicators at the pickup
            tile. Lifetimes managed by the parent's setTimeout. */}
        {floats.map((f) => (
          <div
            key={f.id}
            style={{
              position: "absolute",
              left: f.x * TILE - TILE / 2,
              top: f.y * TILE - 12,
              width: TILE * 2,
              textAlign: "center",
              fontSize: 13,
              fontWeight: 900,
              color: "#bbf7d0",
              textShadow: "0 1px 2px #000",
              pointerEvents: "none",
              zIndex: 50,
              animation: "cashPop 1.2s ease-out forwards",
            }}
          >
            +${f.amount}
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes cashPop {
          0% { opacity: 0; transform: translateY(4px) scale(0.85); }
          15% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-22px) scale(1); }
        }
      `}</style>
    </div>
  );
}

// ------------------------------------------------------------------
// Memoised tile rendering. The tile grid never changes after mount, so we
// render it once and let the camera transform handle scrolling.

function Tiles() {
  const cells = useMemo(() => {
    const out: React.ReactNode[] = [];
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        out.push(<Cell key={`${x},${y}`} x={x} y={y} />);
      }
    }
    return out;
  }, []);
  return <>{cells}</>;
}

function Cell({ x, y }: { x: number; y: number }) {
  const sym = tileAt(x, y);
  const left = x * TILE;
  const top = y * TILE;
  const v = variant(x, y);

  if (isBuilding(x, y)) {
    return <BuildingCell x={x} y={y} left={left} top={top} v={v} />;
  }

  // Decorative / decorative-blocker tiles drawn on top of grass.
  const decor = (() => {
    switch (sym) {
      case "t":
        return <Tree v={v} />;
      case "F":
        return <Fence />;
      case "w":
        return <Water v={v} />;
      case "W":
        return <Fountain />;
      case "f":
        return <Flowers v={v} />;
      case "s":
        return <Sign />;
      default:
        return null;
    }
  })();

  // Pick the base tile. Path tiles render their own dirt texture; grass
  // (anything else walkable + the ground beneath decor) gets a grass
  // background. Water/fence tiles paint their full backdrop themselves so
  // we don't need a base behind them.
  const baseEl =
    sym === "," ? <Path v={v} /> :
    sym === "w" || sym === "W" || sym === "F" ? null :
    <Grass v={v} />;

  return (
    <div style={{ position: "absolute", left, top, width: TILE, height: TILE }}>
      {baseEl}
      {decor}
    </div>
  );
}

// -- Buildings -----------------------------------------------------------

function BuildingCell({
  x, y, left, top, v,
}: { x: number; y: number; left: number; top: number; v: number }) {
  const palette = buildingPaletteAt(x, y)!;
  const isRoof = isRoofCell(x, y);
  const door = doorAt(x, y);

  // Detect surrounding building cells so we can render proper corners,
  // gables, and "this is the front of the building" details. A door tile
  // is always the front; the cell above the door becomes the gable; roof
  // cells in the corners get pointed edges.
  const isAboveDoor = !!doorAt(x, y + 1);
  const isWindow = !door && !isRoof && !isAboveDoor && v !== 0;

  // Z-index: roofs above neighbouring grass, doors above roofs (so the
  // awning isn't clipped), gable above roof.
  const z = door ? 4 : isAboveDoor ? 3 : isRoof ? 2 : 2;

  return (
    <div
      style={{
        position: "absolute",
        left, top, width: TILE, height: TILE,
        zIndex: z,
      }}
    >
      {isRoof ? (
        <Roof palette={palette} cornerLeft={!isBuilding(x - 1, y)} cornerRight={!isBuilding(x + 1, y)} />
      ) : door ? (
        <Door palette={palette} icon={door.icon} />
      ) : isAboveDoor ? (
        <Gable palette={palette} />
      ) : (
        <Wall palette={palette} window={isWindow} />
      )}
    </div>
  );
}

function Roof({ palette, cornerLeft, cornerRight }: { palette: BuildingPaletteLite; cornerLeft: boolean; cornerRight: boolean }) {
  // Sloped roof drawn with a darker top half (shadow side) and lighter
  // bottom (sun side), plus horizontal shingle lines. Corner cells round
  // outward to suggest a pitched roof end.
  return (
    <div
      style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(180deg, ${palette.roof} 0%, ${palette.roof} 50%, ${shade(palette.roof, -15)} 50%, ${shade(palette.roof, -25)} 100%)`,
        borderRadius: `${cornerLeft ? "6px" : "0"} ${cornerRight ? "6px" : "0"} 0 0`,
        boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.4), 0 2px 0 rgba(0,0,0,0.25)",
      }}
    >
      {/* Shingle row dividers */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 9, height: 1, background: "rgba(0,0,0,0.3)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 19, height: 1, background: "rgba(0,0,0,0.3)" }} />
      {/* Shingle staggered ticks */}
      <div style={{ position: "absolute", left: 8, top: 4, width: 1, height: 4, background: "rgba(0,0,0,0.25)" }} />
      <div style={{ position: "absolute", left: 24, top: 4, width: 1, height: 4, background: "rgba(0,0,0,0.25)" }} />
      <div style={{ position: "absolute", left: 16, top: 14, width: 1, height: 4, background: "rgba(0,0,0,0.25)" }} />
    </div>
  );
}

function Wall({ palette, window }: { palette: BuildingPaletteLite; window: boolean }) {
  // Stucco wall with a faint brick pattern via repeating gradient + a
  // soft inner shadow for depth. Optional window cluster.
  return (
    <div
      style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(180deg, ${shade(palette.wall, 10)} 0%, ${palette.wall} 100%)`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -2px 0 rgba(0,0,0,0.25)",
      }}
    >
      {/* Brick courses — faint horizontal lines + offset half-brick marks */}
      <BrickPattern />
      {window && <Window palette={palette} />}
    </div>
  );
}

function BrickPattern() {
  // Pure-CSS brick: horizontal lines every 5px, offset half-brick lines
  // alternating per row. Subtle so it doesn't compete with the windows.
  return (
    <div
      style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage:
          "linear-gradient(0deg, rgba(0,0,0,0.18) 1px, transparent 1px), " +
          "linear-gradient(90deg, rgba(0,0,0,0.18) 1px, transparent 1px)",
        backgroundSize: "11px 6px",
        backgroundPosition: "0 0, 0 0",
        opacity: 0.5,
      }}
    />
  );
}

function Window({ palette }: { palette: BuildingPaletteLite }) {
  // Framed window with sill, shutters, and a warm glow inside. The glow
  // stays consistent at all hours; day/night tint reads it as cooler at
  // night which sells the "lit window" feel.
  return (
    <>
      {/* Sill */}
      <div style={{ position: "absolute", left: 4, top: 21, right: 4, height: 2, background: shade(palette.wall, -30), boxShadow: "0 1px 0 rgba(0,0,0,0.4)" }} />
      {/* Window frame */}
      <div
        style={{
          position: "absolute", left: 6, top: 7, width: TILE - 12, height: 14,
          background: "linear-gradient(180deg, #fde68a 0%, #fcd34d 100%)",
          border: "1.5px solid #1f2937",
          borderRadius: 1,
          boxShadow: "inset 0 0 4px rgba(254,243,199,0.8), 0 0 3px rgba(252,211,77,0.7)",
        }}
      >
        {/* Mullion cross */}
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, marginLeft: -0.5, background: "#1f2937" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, marginTop: -0.5, background: "#1f2937" }} />
      </div>
      {/* Shutters */}
      <div style={{ position: "absolute", left: 2, top: 7, width: 3, height: 14, background: shade(palette.roof, -20), borderRadius: 1, boxShadow: "inset -1px 0 0 rgba(0,0,0,0.3)" }} />
      <div style={{ position: "absolute", right: 2, top: 7, width: 3, height: 14, background: shade(palette.roof, -20), borderRadius: 1, boxShadow: "inset 1px 0 0 rgba(0,0,0,0.3)" }} />
    </>
  );
}

function Gable({ palette }: { palette: BuildingPaletteLite }) {
  // The cell directly above the door. Acts as the building's "facade
  // detail" tile — gets a wood-trim, a hanging sign placeholder and the
  // brick wall behind it.
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Wall palette={palette} window={false} />
      {/* Roof trim strip */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 3, background: palette.roof, boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.4)" }} />
      {/* Hanging sign */}
      <div style={{ position: "absolute", left: "50%", top: 6, marginLeft: -8, width: 16, height: 12, background: "linear-gradient(180deg, #d4a574, #a8895a)", border: "1.5px solid #5b3a1d", borderRadius: 1, boxShadow: "0 2px 2px rgba(0,0,0,0.4)" }}>
        <div style={{ position: "absolute", left: 1, top: 1, right: 1, bottom: 1, background: shade(palette.roof, 0), borderRadius: 1 }} />
      </div>
      {/* Sign chains */}
      <div style={{ position: "absolute", left: "50%", top: 3, marginLeft: -7, width: 1, height: 4, background: "#1f2937" }} />
      <div style={{ position: "absolute", left: "50%", top: 3, marginLeft: 6, width: 1, height: 4, background: "#1f2937" }} />
    </div>
  );
}

function Door({ palette, icon }: { palette: BuildingPaletteLite; icon: string }) {
  // The door tile is the player's interaction target. It needs to stand
  // out from afar — bright awning above, dark wooden door with panels,
  // welcome mat on the path below.
  return (
    <div
      style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(180deg, ${shade(palette.wall, 10)} 0%, ${palette.wall} 100%)`,
        boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.3)",
      }}
    >
      {/* Awning — striped fabric overhang */}
      <div
        style={{
          position: "absolute", left: 1, right: 1, top: 0, height: 6,
          background: `repeating-linear-gradient(90deg, ${palette.roof} 0 4px, ${shade(palette.roof, 15)} 4px 8px)`,
          borderBottom: "1.5px solid #1f2937",
          boxShadow: "0 2px 2px rgba(0,0,0,0.3)",
        }}
      />
      {/* Doorway frame */}
      <div
        style={{
          position: "absolute", left: 6, top: 8, width: TILE - 12, height: 22,
          background: "#2a1810",
          border: "1.5px solid #1f2937",
          borderRadius: "6px 6px 0 0",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1)",
        }}
      >
        {/* Door panel — wood grain effect with two panels */}
        <div style={{ position: "absolute", left: 2, top: 2, right: 2, bottom: 0, background: "linear-gradient(180deg, #5b3a1d 0%, #4a2f1a 100%)", borderRadius: "5px 5px 0 0" }}>
          <div style={{ position: "absolute", left: 2, top: 2, right: 2, height: 7, border: "1px solid #2a1810", borderRadius: 1, background: "linear-gradient(180deg, rgba(255,255,255,0.05), transparent)" }} />
          <div style={{ position: "absolute", left: 2, top: 11, right: 2, height: 7, border: "1px solid #2a1810", borderRadius: 1, background: "linear-gradient(180deg, rgba(255,255,255,0.05), transparent)" }} />
        </div>
        {/* Knob */}
        <div style={{ position: "absolute", right: 4, top: 11, width: 2, height: 2, background: "#fbbf24", borderRadius: "50%", boxShadow: "0 0 1px #d97706" }} />
      </div>
      {/* Building icon over the door */}
      <div
        style={{
          position: "absolute", left: "50%", top: 9, marginLeft: -7, width: 14, height: 7,
          background: shade(palette.roof, 0), border: "1px solid rgba(0,0,0,0.4)", borderRadius: 1,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 7, lineHeight: "7px",
        }}
      >
        {icon}
      </div>
    </div>
  );
}

// Lite alias matching the part of the palette we use inside Cells.
type BuildingPaletteLite = { wall: string; roof: string; door: string };

// Lighten / darken a hex colour by `pct` percent (-100..100). Used so every
// tile can derive shading from its building palette without us having to
// store separate "wall-lit" + "wall-shadow" colours in PALETTES.
function shade(hex: string, pct: number): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const f = pct / 100;
  const adj = (n: number) => Math.max(0, Math.min(255, Math.round(n + (f > 0 ? (255 - n) * f : n * f))));
  return `rgb(${adj(r)}, ${adj(g)}, ${adj(b)})`;
}

// -- Tile backgrounds ----------------------------------------------------

function Grass({ v }: { v: number }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(circle at 30% 40%, #6ec265 0%, #4f9c47 70%), #4a9242",
      }}
    >
      {/* Grass tufts — short dark blades scattered in a deterministic pattern.
          Three variants so neighbouring tiles look different. */}
      {v === 0 && (
        <>
          <Tuft x={6} y={20} h={5} />
          <Tuft x={20} y={8} h={4} />
          <Tuft x={14} y={26} h={6} />
        </>
      )}
      {v === 1 && (
        <>
          <Tuft x={4} y={6} h={4} />
          <Tuft x={22} y={22} h={5} />
          <Pebble x={16} y={14} />
        </>
      )}
      {v === 2 && (
        <>
          <Tuft x={10} y={4} h={4} />
          <Tuft x={2} y={24} h={5} />
          <Tuft x={26} y={18} h={4} />
        </>
      )}
    </div>
  );
}

function Tuft({ x, y, h }: { x: number; y: number; h: number }) {
  return (
    <>
      <div style={{ position: "absolute", left: x, top: y, width: 1, height: h, background: "#2f6b30", borderRadius: 1 }} />
      <div style={{ position: "absolute", left: x + 2, top: y - 1, width: 1, height: h + 1, background: "#2f6b30", borderRadius: 1 }} />
      <div style={{ position: "absolute", left: x + 4, top: y, width: 1, height: h, background: "#2f6b30", borderRadius: 1 }} />
    </>
  );
}

function Pebble({ x, y }: { x: number; y: number }) {
  return (
    <div
      style={{
        position: "absolute", left: x, top: y, width: 4, height: 3,
        background: "#9ca3af", borderRadius: "50%",
        boxShadow: "inset -1px -1px 0 rgba(0,0,0,0.3), 0 1px 0 rgba(0,0,0,0.2)",
      }}
    />
  );
}

function Path({ v }: { v: number }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "linear-gradient(180deg, #cba37a 0%, #b58b5e 100%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.18)",
      }}
    >
      {/* Cobblestone-ish speckles. Different placement per variant so the
          path doesn't look uniformly tiled. */}
      {v === 0 && (
        <>
          <Speckle x={6} y={8} c="#8c6435" />
          <Speckle x={20} y={14} c="#8c6435" />
          <Speckle x={12} y={22} c="#7a572d" />
          <Speckle x={26} y={4} c="#7a572d" />
        </>
      )}
      {v === 1 && (
        <>
          <Speckle x={4} y={20} c="#8c6435" />
          <Speckle x={22} y={6} c="#7a572d" />
          <Speckle x={14} y={14} c="#7a572d" />
        </>
      )}
      {v === 2 && (
        <>
          <Speckle x={8} y={4} c="#8c6435" />
          <Speckle x={24} y={22} c="#7a572d" />
          <Speckle x={2} y={12} c="#8c6435" />
          <Speckle x={18} y={26} c="#7a572d" />
        </>
      )}
    </div>
  );
}

function Speckle({ x, y, c }: { x: number; y: number; c: string }) {
  return (
    <div
      style={{
        position: "absolute", left: x, top: y, width: 3, height: 2,
        background: c, borderRadius: "50%",
      }}
    />
  );
}

function Tree({ v }: { v: number }) {
  // Three-tone canopy: dark base, mid body, light highlight. The light
  // disc sits on the upper-left to suggest a sun-lit dome.
  const palette = v === 0
    ? { d: "#1b5e20", m: "#2e7d32", l: "#4caf50" }
    : v === 1
    ? { d: "#1a4d2e", m: "#2a6b3f", l: "#3f9c55" }
    : { d: "#0f3f1f", m: "#1f5530", l: "#36844a" };
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {/* Shadow on grass */}
      <div style={{ position: "absolute", left: 6, top: 24, width: 20, height: 5, background: "rgba(0,0,0,0.35)", borderRadius: "50%", filter: "blur(1px)" }} />
      {/* Trunk */}
      <div style={{ position: "absolute", left: 13, top: 20, width: 6, height: 8, background: "#6b4423", borderRadius: "1px", boxShadow: "inset -1px 0 0 #4a2f1a" }} />
      {/* Canopy — three stacked discs for depth */}
      <div style={{ position: "absolute", left: 1, top: 4, width: 30, height: 22, background: palette.d, borderRadius: "50%" }} />
      <div style={{ position: "absolute", left: 3, top: 2, width: 26, height: 20, background: palette.m, borderRadius: "50%" }} />
      <div style={{ position: "absolute", left: 6, top: 3, width: 14, height: 10, background: palette.l, borderRadius: "50%" }} />
      {/* Hint of leaves at bottom edge */}
      <div style={{ position: "absolute", left: 4, top: 18, width: 4, height: 3, background: palette.m, borderRadius: "50%" }} />
      <div style={{ position: "absolute", left: 24, top: 17, width: 4, height: 3, background: palette.m, borderRadius: "50%" }} />
    </div>
  );
}

function Fence() {
  // Wood-plank fence. Grass behind, then two horizontal rails plus three
  // upright posts so the lattice reads even at this small size.
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Grass v={0} />
      {/* Horizontal rails */}
      <div style={{ position: "absolute", left: 0, top: 9, width: TILE, height: 4, background: "linear-gradient(180deg, #b8895a 0%, #8c6435 100%)", boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.3)" }} />
      <div style={{ position: "absolute", left: 0, top: 20, width: TILE, height: 4, background: "linear-gradient(180deg, #b8895a 0%, #8c6435 100%)", boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.3)" }} />
      {/* Posts — pointed tops */}
      <Post x={4} />
      <Post x={14} />
      <Post x={24} />
    </div>
  );
}

function Post({ x }: { x: number }) {
  return (
    <>
      <div style={{ position: "absolute", left: x, top: 4, width: 4, height: 24, background: "linear-gradient(90deg, #5b3a1d 0%, #7a5b30 50%, #5b3a1d 100%)" }} />
      <div style={{ position: "absolute", left: x, top: 4, width: 4, height: 2, background: "#5b3a1d", clipPath: "polygon(0 100%, 50% 0, 100% 100%)" }} />
    </>
  );
}

function Water({ v }: { v: number }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "linear-gradient(180deg, #4ea0e8 0%, #2563eb 60%, #1e40af 100%)",
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.3), inset 1px 1px 0 rgba(255,255,255,0.15)",
      }}
    >
      {/* Ripples — animated horizontal highlights. Three variants offset the
          pattern so a 2×2 pond doesn't look like a tiled repeat. */}
      {v === 0 && (
        <>
          <Ripple x={4} y={8} w={10} />
          <Ripple x={16} y={20} w={8} delay={0.5} />
        </>
      )}
      {v === 1 && (
        <>
          <Ripple x={8} y={14} w={12} delay={0.3} />
          <Ripple x={2} y={22} w={6} />
        </>
      )}
      {v === 2 && (
        <>
          <Ripple x={14} y={6} w={8} delay={0.7} />
          <Ripple x={6} y={18} w={10} delay={0.2} />
        </>
      )}
      <style jsx>{`
        @keyframes rippleSlide {
          0%, 100% { transform: translateX(0); opacity: 0.6; }
          50% { transform: translateX(3px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function Ripple({ x, y, w, delay = 0 }: { x: number; y: number; w: number; delay?: number }) {
  return (
    <div
      style={{
        position: "absolute", left: x, top: y, width: w, height: 1,
        background: "rgba(255,255,255,0.7)", borderRadius: 1,
        animation: `rippleSlide 2.4s ease-in-out ${delay}s infinite`,
      }}
    />
  );
}

function Fountain() {
  return (
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", overflow: "visible" }}>
      {/* Plinth base */}
      <div style={{ position: "absolute", left: 10, top: 14, width: 12, height: 10, background: "#a8895a", border: "1.5px solid #5b3a1d", borderRadius: 2 }} />
      {/* Spout column */}
      <div style={{ position: "absolute", left: 14, top: 6, width: 4, height: 12, background: "#cbd5e1", border: "1px solid #475569" }} />
      {/* Top spray */}
      <div style={{ position: "absolute", left: 11, top: -2, width: 10, height: 8, background: "#7dd3fc", borderRadius: "50% 50% 30% 30%", boxShadow: "0 0 4px #38bdf8" }} />
      {/* Splash droplets, animated */}
      <div style={{ position: "absolute", left: 6, top: 4, width: 3, height: 3, background: "#bae6fd", borderRadius: "50%", animation: "spray 1.4s ease-in-out infinite" }} />
      <div style={{ position: "absolute", left: 22, top: 8, width: 3, height: 3, background: "#bae6fd", borderRadius: "50%", animation: "spray 1.4s ease-in-out infinite 0.4s" }} />
      <style jsx>{`
        @keyframes spray {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function Flowers({ v }: { v: number }) {
  // 5-petal flowers in three colour-mix palettes. Each tile has a tight
  // cluster of 3 blooms with a yellow centre and stems trailing down.
  const palette = v === 0
    ? ["#ef4444", "#ec4899", "#fb923c"]
    : v === 1
    ? ["#fbbf24", "#facc15", "#fde047"]
    : ["#a855f7", "#c084fc", "#60a5fa"];
  const positions = [
    { x: 6, y: 6, c: palette[0] },
    { x: 18, y: 10, c: palette[1] },
    { x: 11, y: 20, c: palette[2] },
  ];
  return (
    <>
      {positions.map((p, i) => (
        <Bloom key={i} x={p.x} y={p.y} color={p.c} />
      ))}
    </>
  );
}

function Bloom({ x, y, color }: { x: number; y: number; color: string }) {
  // 5-petal flower drawn as 4 outer petals + center disc.
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 8, height: 8 }}>
      {/* Stem */}
      <div style={{ position: "absolute", left: 3, top: 6, width: 1, height: 4, background: "#2f6b30" }} />
      {/* Petals */}
      <div style={{ position: "absolute", left: 2, top: 0, width: 3, height: 3, background: color, borderRadius: "50%" }} />
      <div style={{ position: "absolute", left: 0, top: 2, width: 3, height: 3, background: color, borderRadius: "50%" }} />
      <div style={{ position: "absolute", left: 4, top: 2, width: 3, height: 3, background: color, borderRadius: "50%" }} />
      <div style={{ position: "absolute", left: 1, top: 4, width: 3, height: 3, background: color, borderRadius: "50%" }} />
      <div style={{ position: "absolute", left: 3, top: 4, width: 3, height: 3, background: color, borderRadius: "50%" }} />
      {/* Center */}
      <div style={{ position: "absolute", left: 2, top: 2, width: 3, height: 3, background: "#fef3c7", borderRadius: "50%" }} />
    </div>
  );
}

function Sign() {
  // Wooden plaque on a post with text-line scratches and shading.
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Grass v={2} />
      {/* Post */}
      <div style={{ position: "absolute", left: 14, top: 16, width: 4, height: 14, background: "linear-gradient(90deg, #5b3a1d, #7a5b30, #5b3a1d)" }} />
      {/* Plaque */}
      <div
        style={{
          position: "absolute", left: 4, top: 4, width: 24, height: 14,
          background: "linear-gradient(180deg, #d4a574, #a8895a)",
          border: "1.5px solid #5b3a1d", borderRadius: 2,
          boxShadow: "0 2px 0 rgba(0,0,0,0.3)",
        }}
      >
        {/* Text scratches */}
        <div style={{ position: "absolute", left: 3, top: 3, width: 18, height: 1, background: "#5b3a1d" }} />
        <div style={{ position: "absolute", left: 3, top: 6, width: 14, height: 1, background: "#5b3a1d" }} />
        <div style={{ position: "absolute", left: 3, top: 9, width: 16, height: 1, background: "#5b3a1d" }} />
      </div>
      {/* Nail heads */}
      <div style={{ position: "absolute", left: 6, top: 5, width: 2, height: 2, background: "#4a2f1a", borderRadius: "50%" }} />
      <div style={{ position: "absolute", left: 24, top: 5, width: 2, height: 2, background: "#4a2f1a", borderRadius: "50%" }} />
    </div>
  );
}

// Floating per-door label so the player can read where each building leads
// before they walk in. Rendered as a flat group above the building. Keeps
// the map self-documenting. When a questTarget is provided, the matching
// door also gets a bouncing arrow + amber glow so the player can see at a
// glance where the next objective sends them.
function DoorLabels({ questTarget }: { questTarget: string | null }) {
  const doors = useMemo(() => {
    const out: { x: number; y: number; sym: string; door: DoorInfo }[] = [];
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const sym = tileAt(x, y);
        const d = DOORS[sym];
        if (d) out.push({ x, y, sym, door: d });
      }
    }
    return out;
  }, []);
  return (
    <>
      {doors.map(({ x, y, sym, door }) => {
        const hot = sym === questTarget;
        return (
          <div
            key={door.id}
            style={{
              position: "absolute",
              left: x * TILE - TILE * 1.5,
              top: y * TILE - 38,
              width: TILE * 4,
              textAlign: "center",
              pointerEvents: "none",
              zIndex: 5,
            }}
          >
            {hot && (
              <div
                style={{
                  fontSize: 18,
                  color: "#fbbf24",
                  textShadow: "0 0 6px #fbbf24, 0 1px 2px #000",
                  animation: "questBob 1s ease-in-out infinite",
                  marginBottom: -2,
                }}
              >
                ▼
              </div>
            )}
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: hot ? "#fde68a" : "white",
                textShadow: "0 1px 2px rgba(0,0,0,0.9)",
              }}
            >
              {door.label}
            </div>
          </div>
        );
      })}
      <style jsx>{`
        @keyframes questBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(6px); }
        }
      `}</style>
    </>
  );
}
