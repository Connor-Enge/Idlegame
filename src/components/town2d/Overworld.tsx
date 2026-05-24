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
  const [px, setPx] = useState(SPAWN.x); // tile-x at rest
  const [py, setPy] = useState(SPAWN.y);
  const [facing, setFacing] = useState<Dir>("down");
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

  // Background ground tile — always rendered first so building bottoms have
  // something behind them.
  const baseGround = sym === "," ? "#a16207" : sym === "f" ? "#65a30d" : "#3f7d3a";

  // Buildings: render as solid coloured blocks with a roof accent on the
  // topmost row of the building and small window detailing on mid-tier
  // walls so each building reads as more than a flat rectangle.
  if (isBuilding(x, y)) {
    const palette = buildingPaletteAt(x, y)!;
    const roof = isRoofCell(x, y);
    const door = doorAt(x, y);
    const window = !door && !roof && variant(x, y) !== 0; // ~2/3 of mid cells
    return (
      <div
        style={{
          position: "absolute",
          left,
          top,
          width: TILE,
          height: TILE,
          background: door ? palette.door : palette.wall,
          borderTop: roof ? `5px solid ${palette.roof}` : undefined,
          boxShadow: door ? "inset 0 0 0 2px rgba(0,0,0,0.4)" : "inset 0 0 0 1px rgba(0,0,0,0.25)",
          zIndex: 1,
        }}
      >
        {roof && (
          // Roof shingle pattern — a darker strip beneath the accent line
          // so the roof reads as thickness rather than a single border.
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: 9,
              background: "rgba(0,0,0,0.25)",
            }}
          />
        )}
        {window && (
          <div
            style={{
              position: "absolute",
              left: 8,
              top: 9,
              width: TILE - 16,
              height: 11,
              background: "#facc15",
              border: "1.5px solid #1f2937",
              borderRadius: 2,
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.4)",
            }}
          >
            <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "#1f2937" }} />
            <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, background: "#1f2937" }} />
          </div>
        )}
        {door && (
          <>
            {/* Awning stripe to make the door pop */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                height: 4,
                background: palette.roof,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 5,
                right: 5,
                top: 7,
                bottom: 4,
                borderRadius: "4px 4px 1px 1px",
                background: "rgba(0,0,0,0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
              }}
            >
              {door.icon}
            </div>
          </>
        )}
      </div>
    );
  }

  // Decorative / decorative-blocker tiles drawn on top of grass.
  const decor = (() => {
    switch (sym) {
      case "t":
        return <Tree v={variant(x, y)} />;
      case "F":
        return <Fence />;
      case "w":
        return <Water />;
      case "f":
        return <Flowers v={variant(x, y)} />;
      case "s":
        return <Sign />;
      default:
        return null;
    }
  })();

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: TILE,
        height: TILE,
        background: baseGround,
      }}
    >
      {/* Subtle ground noise so identical tiles don't look like a tiled image. */}
      {sym === "." && variant(x, y) === 0 && (
        <div style={{ position: "absolute", left: 6, top: 10, width: 4, height: 2, background: "rgba(0,0,0,0.18)", borderRadius: 1 }} />
      )}
      {sym === "," && (
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(rgba(0,0,0,0.04), rgba(0,0,0,0.12))" }} />
      )}
      {decor}
    </div>
  );
}

function Tree({ v }: { v: number }) {
  const trunk = "#5b3a1d";
  const leafA = "#15803d";
  const leafB = "#166534";
  const leaf = v === 0 ? leafA : v === 1 ? leafB : "#14532d";
  return (
    <>
      <div style={{ position: "absolute", left: 13, top: 18, width: 6, height: 10, background: trunk }} />
      <div style={{ position: "absolute", left: 2, top: 0, width: 28, height: 22, background: leaf, borderRadius: "50%", boxShadow: "inset -3px -3px 0 rgba(0,0,0,0.25)" }} />
    </>
  );
}

function Fence() {
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: "#3f7d3a" }} />
      <div style={{ position: "absolute", left: 0, top: 8, width: TILE, height: 4, background: "#a8895a" }} />
      <div style={{ position: "absolute", left: 0, top: 20, width: TILE, height: 4, background: "#a8895a" }} />
      <div style={{ position: "absolute", left: 6, top: 2, width: 4, height: TILE - 4, background: "#7a5b30" }} />
      <div style={{ position: "absolute", left: TILE - 10, top: 2, width: 4, height: TILE - 4, background: "#7a5b30" }} />
    </>
  );
}

function Water() {
  return <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }} />;
}

function Flowers({ v }: { v: number }) {
  const col = v === 0 ? "#f43f5e" : v === 1 ? "#fbbf24" : "#a855f7";
  return (
    <>
      <div style={{ position: "absolute", left: 7, top: 8, width: 5, height: 5, background: col, borderRadius: "50%" }} />
      <div style={{ position: "absolute", left: 18, top: 14, width: 5, height: 5, background: col, borderRadius: "50%" }} />
      <div style={{ position: "absolute", left: 12, top: 22, width: 5, height: 5, background: col, borderRadius: "50%" }} />
    </>
  );
}

function Sign() {
  return (
    <>
      <div style={{ position: "absolute", left: 14, top: 14, width: 4, height: 14, background: "#5b3a1d" }} />
      <div style={{ position: "absolute", left: 6, top: 4, width: 20, height: 12, background: "#a8895a", border: "1px solid #5b3a1d", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>📜</div>
    </>
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
