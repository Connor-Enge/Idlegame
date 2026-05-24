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

const STEP_MS = 180; // duration of one tile step (matches CSS transition)

const DIRS: Record<Dir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

// Camera viewport.
const VIEW_W = 13;
const VIEW_H = 17;
const VIEW_PX_W = VIEW_W * TILE;
const VIEW_PX_H = VIEW_H * TILE;

const POS_KEY = "town2d:pos";

interface SavedPos { x: number; y: number; facing: Dir }

function readSavedPos(): SavedPos {
  if (typeof window === "undefined") return { x: SPAWN.x, y: SPAWN.y, facing: "down" };
  try {
    const raw = window.localStorage.getItem(POS_KEY);
    if (!raw) return { x: SPAWN.x, y: SPAWN.y, facing: "down" };
    const parsed = JSON.parse(raw);
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

// Day-night palette using a soft rgba overlay (no mix-blend-mode — that's
// expensive and tends to crush contrast on tile art). tod is 0..1.
function dayTint(tod: number): string {
  const sun = Math.max(0, Math.sin(tod * Math.PI * 2 - Math.PI / 2) + 1) / 2;
  if (sun < 0.2) return "rgba(12, 21, 48, 0.45)";       // deep night
  if (sun < 0.4) return "rgba(255, 138, 64, 0.18)";     // dawn / dusk
  if (sun < 0.7) return "rgba(253, 230, 138, 0.05)";    // morning
  return "rgba(0, 0, 0, 0)";                            // clear day
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
  questTarget: string | null;
}) {
  const npcsRef = useRef<NPCsHandle>(null);
  const initial = useMemo(readSavedPos, []);
  const [px, setPx] = useState(initial.x);
  const [py, setPy] = useState(initial.y);
  const [facing, setFacing] = useState<Dir>(initial.facing);
  const [walking, setWalking] = useState(false);

  const heldRef = useRef<Dir | null>(heldDir);
  heldRef.current = heldDir;

  // Step machine — runs as a setTimeout loop. While idle, polls held
  // direction every 60 ms and starts a step if one is held. While stepping,
  // waits STEP_MS for the CSS transition to finish, then evaluates the
  // next step. Zero rAF, zero per-frame React re-renders.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let posX = px;
    let posY = py;
    let live = true;

    function tryStep() {
      if (!live) return;
      const dir = heldRef.current;
      if (!dir) {
        setWalking(false);
        timer = setTimeout(tryStep, 60);
        return;
      }
      setFacing(dir);
      const { dx, dy } = DIRS[dir];
      const tx = posX + dx;
      const ty = posY + dy;

      const door = doorAt(tx, ty);
      if (door) { heldRef.current = null; setWalking(false); onEnterDoor(door); timer = setTimeout(tryStep, 60); return; }
      const sign = signAt(tx, ty);
      if (sign) { heldRef.current = null; setWalking(false); onDialog({ lines: sign }); timer = setTimeout(tryStep, 60); return; }
      const npc = npcsRef.current?.npcAt(tx, ty);
      if (npc) { heldRef.current = null; setWalking(false); onDialog({ who: npc.name, lines: npc.lines }); timer = setTimeout(tryStep, 60); return; }
      if (!isWalkable(tx, ty)) { setWalking(false); timer = setTimeout(tryStep, 80); return; }

      // Commit the step: CSS transition animates from old to new position
      // over STEP_MS. Schedule the next decision for when the animation
      // completes.
      setWalking(true);
      posX = tx;
      posY = ty;
      setPx(tx);
      setPy(ty);
      writeSavedPos({ x: tx, y: ty, facing: dir });
      timer = setTimeout(tryStep, STEP_MS);
    }

    tryStep();
    return () => { live = false; clearTimeout(timer); };
  }, [onEnterDoor, onDialog]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard input.
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

  // Day-night — tick once per second, not every 200 ms. The eye can't
  // discriminate at that resolution anyway.
  const [tod, setTod] = useState(0.5);
  useEffect(() => {
    const t = setInterval(() => setTod((c) => (c + 1 / 300) % 1), 1000);
    return () => clearInterval(t);
  }, []);
  const tintColor = dayTint(tod);

  // Camera position — clamped to map edges, lerps via CSS transition that
  // matches the step duration so the camera stays glued to the player.
  const camX = Math.max(0, Math.min(MAP_W * TILE - VIEW_PX_W, px * TILE + TILE / 2 - VIEW_PX_W / 2));
  const camY = Math.max(0, Math.min(MAP_H * TILE - VIEW_PX_H, py * TILE + TILE / 2 - VIEW_PX_H / 2));

  // Pickup collection floaters.
  const [floats, setFloats] = useState<{ id: number; x: number; y: number; amount: number }[]>([]);
  const onCashCollect = useCallback((amount: number, x: number, y: number) => {
    const id = Date.now() + Math.random();
    setFloats((f) => [...f, { id, x, y, amount }]);
    setTimeout(() => setFloats((f) => f.filter((it) => it.id !== id)), 1200);
  }, []);

  return (
    <div
      className="relative mx-auto overflow-hidden"
      style={{
        width: VIEW_PX_W,
        height: VIEW_PX_H,
        background: "#3f7d3a",
        contain: "layout paint",
        imageRendering: "pixelated",
      }}
    >
      {/* World layer — sits inside the viewport, translated by the camera.
          translate3d engages the GPU compositor so the camera move is
          essentially free per frame. */}
      <div
        style={{
          position: "absolute",
          left: 0, top: 0,
          width: MAP_W * TILE,
          height: MAP_H * TILE,
          transform: `translate3d(${-camX}px, ${-camY}px, 0)`,
          transition: walking ? `transform ${STEP_MS}ms linear` : "none",
          willChange: "transform",
        }}
      >
        <StaticTiles />

        <Pickups playerTile={{ x: px, y: py }} onCollect={onCashCollect} />
        <NPCs ref={npcsRef} />

        {/* Player — CSS transition animates between tile positions. The
            walk cycle is driven by a CSS keyframe via the `walking` class
            on the sprite. */}
        <div
          style={{
            position: "absolute",
            left: 0, top: 0,
            width: TILE,
            height: TILE,
            transform: `translate3d(${px * TILE}px, ${py * TILE}px, 0)`,
            transition: walking ? `transform ${STEP_MS}ms linear` : "none",
            willChange: "transform",
            zIndex: py + 5,
          }}
        >
          <PlayerSprite facing={facing} walking={walking} />
        </div>

        <DoorLabels questTarget={questTarget} />

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
              zIndex: 80,
              animation: "cashPop 1.2s ease-out forwards",
            }}
          >
            +${f.amount}
          </div>
        ))}
      </div>

      {/* Day/night tint — single rgba overlay over the viewport. No
          mix-blend-mode (expensive). 600 ms transition between tints. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: tintColor,
          pointerEvents: "none",
          zIndex: 70,
          transition: "background 600ms linear",
        }}
      />

      {/* Walk-cycle keyframes + cash floater keyframes. */}
      <style jsx global>{`
        @keyframes t2dLegL { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-1.5px); } }
        @keyframes t2dLegR { 0%, 100% { transform: translateY(-1.5px); } 50% { transform: translateY(0); } }
        @keyframes t2dArmL { 0%, 100% { transform: translateY(0.5px); } 50% { transform: translateY(-0.5px); } }
        @keyframes t2dArmR { 0%, 100% { transform: translateY(-0.5px); } 50% { transform: translateY(0.5px); } }
        @keyframes t2dBob  { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-1px); } }
        .t2d-char-walk .t2d-leg-left  { animation: t2dLegL ${STEP_MS * 2}ms linear infinite; }
        .t2d-char-walk .t2d-leg-right { animation: t2dLegR ${STEP_MS * 2}ms linear infinite; }
        .t2d-char-walk .t2d-arm-left  { animation: t2dArmL ${STEP_MS * 2}ms linear infinite; }
        .t2d-char-walk .t2d-arm-right { animation: t2dArmR ${STEP_MS * 2}ms linear infinite; }
        .t2d-char-walk { animation: t2dBob ${STEP_MS * 2}ms linear infinite; }
        @keyframes cashPop {
          0% { opacity: 0; transform: translateY(4px) scale(0.85); }
          15% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-22px) scale(1); }
        }
      `}</style>
    </div>
  );
}

// --- Static tile rendering -------------------------------------------------
// Every static tile (grass, path, fence, tree, flower, sign, water, fountain,
// building cells) is rendered exactly once at mount inside a memoised group.
// Background imagery uses pre-computed SVG data URIs that the browser caches
// per-variant, so 200 grass tiles cost the same as 3 (one image per variant).

const StaticTiles = (function () {
  let cached: React.ReactNode | null = null;
  return function StaticTiles() {
    if (!cached) {
      const out: React.ReactNode[] = [];
      for (let y = 0; y < MAP_H; y++) {
        for (let x = 0; x < MAP_W; x++) {
          out.push(<Cell key={`${x},${y}`} x={x} y={y} />);
        }
      }
      cached = <>{out}</>;
    }
    return cached;
  };
})();

function Cell({ x, y }: { x: number; y: number }) {
  const sym = tileAt(x, y);
  const left = x * TILE;
  const top = y * TILE;
  const v = variant(x, y);

  if (isBuilding(x, y)) {
    return <BuildingCell x={x} y={y} left={left} top={top} v={v} />;
  }

  // Pick the right background image for the tile type. Decorations like
  // trees/flowers/sign overlay onto a grass base so they tile cleanly with
  // neighbouring grass.
  let bg: string;
  switch (sym) {
    case ",": bg = PATH_URIS[v]; break;
    case "F": bg = FENCE_URI; break;
    case "w": bg = WATER_URIS[v]; break;
    case "W": return <FountainTile left={left} top={top} />;
    case "s": return <SignTile left={left} top={top} v={v} />;
    case "t": return <DecorTile left={left} top={top} v={v} url={TREE_URIS[v]} />;
    case "f": return <DecorTile left={left} top={top} v={v} url={FLOWER_URIS[v]} />;
    default:  bg = GRASS_URIS[v];
  }

  return (
    <div
      style={{
        position: "absolute",
        left, top,
        width: TILE, height: TILE,
        backgroundImage: `url("${bg}")`,
        backgroundSize: "100% 100%",
      }}
    />
  );
}

function DecorTile({ left, top, v, url }: { left: number; top: number; v: number; url: string }) {
  return (
    <div
      style={{
        position: "absolute",
        left, top,
        width: TILE, height: TILE,
        backgroundImage: `url("${url}"), url("${GRASS_URIS[v]}")`,
        backgroundSize: "100% 100%, 100% 100%",
      }}
    />
  );
}

function SignTile({ left, top, v }: { left: number; top: number; v: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left, top,
        width: TILE, height: TILE,
        backgroundImage: `url("${SIGN_URI}"), url("${GRASS_URIS[v]}")`,
        backgroundSize: "100% 100%, 100% 100%",
      }}
    />
  );
}

function FountainTile({ left, top }: { left: number; top: number }) {
  // Fountain spout is animated, so keep it as a small DOM cluster on top
  // of the static water sprite. Only one tile in the map; cost is trivial.
  return (
    <div
      style={{
        position: "absolute",
        left, top,
        width: TILE, height: TILE,
        backgroundImage: `url("${WATER_URIS[0]}")`,
        backgroundSize: "100% 100%",
      }}
    >
      <div style={{ position: "absolute", left: 8, top: 18, width: 16, height: 6, background: "#737373", border: "1.5px solid #404040", borderRadius: 2 }} />
      <div style={{ position: "absolute", left: 11, top: 13, width: 10, height: 6, background: "#a1a1aa", border: "1.5px solid #404040", borderRadius: "3px 3px 1px 1px" }} />
      <div style={{ position: "absolute", left: 13, top: 8, width: 6, height: 6, background: "#94a3b8", border: "1.5px solid #404040", borderRadius: "3px 3px 1px 1px" }} />
      <div style={{ position: "absolute", left: 15, top: 2, width: 2, height: 6, background: "#7dd3fc", borderRadius: 1, animation: "fSpout 1.6s ease-in-out infinite" }} />
      <style jsx>{`
        @keyframes fSpout {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.3); }
        }
      `}</style>
    </div>
  );
}

// --- Buildings -------------------------------------------------------------

function BuildingCell({
  x, y, left, top, v,
}: { x: number; y: number; left: number; top: number; v: number }) {
  const palette = buildingPaletteAt(x, y)!;
  const isRoof = isRoofCell(x, y);
  const door = doorAt(x, y);
  const isAboveDoor = !!doorAt(x, y + 1);
  const isWindow = !door && !isRoof && !isAboveDoor && v !== 0;
  const z = door ? 4 : isAboveDoor ? 3 : 2;

  return (
    <div style={{ position: "absolute", left, top, width: TILE, height: TILE, zIndex: z }}>
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

type BuildingPaletteLite = { wall: string; roof: string; door: string };

function Roof({ palette, cornerLeft, cornerRight }: { palette: BuildingPaletteLite; cornerLeft: boolean; cornerRight: boolean }) {
  return (
    <div
      style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(180deg, ${palette.roof} 0%, ${palette.roof} 50%, ${shadeHex(palette.roof, -20)} 50%, ${shadeHex(palette.roof, -30)} 100%)`,
        borderRadius: `${cornerLeft ? "6px" : "0"} ${cornerRight ? "6px" : "0"} 0 0`,
        boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.4)",
      }}
    />
  );
}

function Wall({ palette, window }: { palette: BuildingPaletteLite; window: boolean }) {
  return (
    <div
      style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(180deg, ${shadeHex(palette.wall, 10)} 0%, ${palette.wall} 100%)`,
      }}
    >
      {window && (
        <div
          style={{
            position: "absolute", left: 6, top: 9, right: 6, height: 14,
            background: "#fde68a",
            border: "1.5px solid #1f2937",
            borderRadius: 1,
            boxShadow: "inset 0 0 3px rgba(252,211,77,0.7)",
          }}
        >
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, marginLeft: -0.5, background: "#1f2937" }} />
          <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, marginTop: -0.5, background: "#1f2937" }} />
        </div>
      )}
    </div>
  );
}

function Gable({ palette }: { palette: BuildingPaletteLite }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: palette.wall }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 3, background: palette.roof }} />
      <div
        style={{
          position: "absolute", left: "50%", top: 7, marginLeft: -8,
          width: 16, height: 12,
          background: shadeHex(palette.roof, -10),
          border: "1.5px solid #1f2937",
          borderRadius: 1,
        }}
      />
    </div>
  );
}

function Door({ palette, icon }: { palette: BuildingPaletteLite; icon: string }) {
  return (
    <div
      style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(180deg, ${shadeHex(palette.wall, 10)} 0%, ${palette.wall} 100%)`,
      }}
    >
      <div
        style={{
          position: "absolute", left: 1, right: 1, top: 0, height: 6,
          background: `repeating-linear-gradient(90deg, ${palette.roof} 0 4px, ${shadeHex(palette.roof, 15)} 4px 8px)`,
          borderBottom: "1.5px solid #1f2937",
        }}
      />
      <div
        style={{
          position: "absolute", left: 6, top: 8, right: 6, bottom: 0,
          background: "linear-gradient(180deg, #5b3a1d 0%, #4a2f1a 100%)",
          border: "1.5px solid #1f2937",
          borderRadius: "5px 5px 0 0",
        }}
      >
        <div style={{ position: "absolute", right: 3, top: 9, width: 2, height: 2, background: "#fbbf24", borderRadius: "50%" }} />
      </div>
      <div
        style={{
          position: "absolute", left: "50%", top: 9, marginLeft: -7,
          width: 14, height: 7,
          background: palette.roof,
          border: "1px solid rgba(0,0,0,0.4)",
          borderRadius: 1,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 7, lineHeight: "7px",
        }}
      >
        {icon}
      </div>
    </div>
  );
}

// --- Door labels + quest target -------------------------------------------

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
              zIndex: 6,
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

// --- Tile sprite generators -----------------------------------------------
// Each function returns an SVG data URI for one TILE-sized cell. Computed
// once at module load and reused as background-image — the browser caches
// the URI so repeated tiles share GPU texture memory.

function uri(svg: string): string {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

const T = TILE;

// Cohesive palette — grass tones and earth tones share warm undertones so
// the seam between grass and path is much softer than before.
const GRASS_BASE = "#5e9e54";
const GRASS_MID  = "#4d8a44";
const GRASS_DARK = "#3d7338";
const PATH_BASE  = "#c9a87c";
const PATH_MID   = "#b8946a";
const PATH_DARK  = "#a17e58";
const PATH_EDGE  = "#7a9764"; // grass-tinted edge for soft tile blending

function svgGrass(v: number): string {
  // Soft grass with edge feathering so adjacent grass tiles read as a
  // single field rather than a grid.
  const tufts =
    v === 0 ? `<circle cx='8' cy='20' r='1' fill='${GRASS_DARK}'/><circle cx='22' cy='10' r='1' fill='${GRASS_DARK}'/><circle cx='16' cy='26' r='1' fill='${GRASS_DARK}'/>` :
    v === 1 ? `<circle cx='6' cy='8' r='1' fill='${GRASS_DARK}'/><circle cx='24' cy='22' r='1' fill='${GRASS_DARK}'/><circle cx='14' cy='14' r='0.8' fill='#9ca3af'/>` :
              `<circle cx='12' cy='6' r='1' fill='${GRASS_DARK}'/><circle cx='4' cy='26' r='1' fill='${GRASS_DARK}'/><circle cx='28' cy='18' r='1' fill='${GRASS_DARK}'/>`;
  return uri(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${T}' height='${T}'>` +
    `<defs><radialGradient id='g${v}' cx='50%' cy='50%' r='75%'><stop offset='0%' stop-color='${GRASS_BASE}'/><stop offset='100%' stop-color='${GRASS_MID}'/></radialGradient></defs>` +
    `<rect width='${T}' height='${T}' fill='url(#g${v})'/>` +
    tufts +
    `</svg>`
  );
}

function svgPath(v: number): string {
  // Path with a green-tinted feather around the rim so the brown edges
  // blend into surrounding grass instead of cutting a hard rectangle.
  const speckles =
    v === 0 ? `<circle cx='8' cy='10' r='1' fill='${PATH_DARK}'/><circle cx='22' cy='16' r='1' fill='${PATH_DARK}'/><circle cx='14' cy='24' r='1' fill='${PATH_DARK}'/>` :
    v === 1 ? `<circle cx='6' cy='22' r='1' fill='${PATH_DARK}'/><circle cx='24' cy='8' r='1' fill='${PATH_DARK}'/><circle cx='16' cy='14' r='1' fill='${PATH_DARK}'/>` :
              `<circle cx='10' cy='6' r='1' fill='${PATH_DARK}'/><circle cx='26' cy='24' r='1' fill='${PATH_DARK}'/><circle cx='4' cy='14' r='1' fill='${PATH_DARK}'/>`;
  return uri(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${T}' height='${T}'>` +
    `<rect width='${T}' height='${T}' fill='${PATH_EDGE}'/>` + // outer feather ring
    `<rect x='2' y='2' width='${T - 4}' height='${T - 4}' fill='${PATH_BASE}'/>` +
    `<rect x='2' y='2' width='${T - 4}' height='${T - 4}' fill='url(#pg${v})' fill-opacity='1'/>` +
    `<defs><linearGradient id='pg${v}' x1='0' y1='0' x2='0' y2='1'><stop offset='0%' stop-color='${PATH_BASE}'/><stop offset='100%' stop-color='${PATH_MID}'/></linearGradient></defs>` +
    speckles +
    `</svg>`
  );
}

function svgFence(): string {
  return uri(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${T}' height='${T}'>` +
    `<rect width='${T}' height='${T}' fill='${GRASS_MID}'/>` +
    `<rect y='9' width='${T}' height='4' fill='#a8895a'/>` +
    `<rect y='20' width='${T}' height='4' fill='#a8895a'/>` +
    `<rect x='4' y='4' width='4' height='24' fill='#7a5b30'/>` +
    `<rect x='14' y='4' width='4' height='24' fill='#7a5b30'/>` +
    `<rect x='24' y='4' width='4' height='24' fill='#7a5b30'/>` +
    `</svg>`
  );
}

function svgWater(v: number): string {
  const ripples =
    v === 0 ? `<rect x='4' y='8' width='10' height='1' fill='rgba(255,255,255,0.55)'/><rect x='16' y='20' width='8' height='1' fill='rgba(255,255,255,0.35)'/>` :
    v === 1 ? `<rect x='8' y='14' width='12' height='1' fill='rgba(255,255,255,0.45)'/><rect x='2' y='22' width='6' height='1' fill='rgba(255,255,255,0.35)'/>` :
              `<rect x='14' y='6' width='8' height='1' fill='rgba(255,255,255,0.4)'/><rect x='6' y='18' width='10' height='1' fill='rgba(255,255,255,0.5)'/>`;
  return uri(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${T}' height='${T}'>` +
    `<defs><linearGradient id='w${v}' x1='0' y1='0' x2='0' y2='1'><stop offset='0%' stop-color='#4ea0e8'/><stop offset='100%' stop-color='#1e40af'/></linearGradient></defs>` +
    `<rect width='${T}' height='${T}' fill='url(#w${v})'/>` +
    ripples +
    `</svg>`
  );
}

function svgTree(v: number): string {
  const palette =
    v === 0 ? { d: "#1b5e20", m: "#2e7d32", l: "#4caf50" } :
    v === 1 ? { d: "#1a4d2e", m: "#2a6b3f", l: "#3f9c55" } :
              { d: "#0f3f1f", m: "#1f5530", l: "#36844a" };
  return uri(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${T}' height='${T}'>` +
    `<ellipse cx='16' cy='28' rx='10' ry='2.5' fill='rgba(0,0,0,0.3)'/>` +
    `<rect x='13' y='20' width='6' height='8' fill='#6b4423'/>` +
    `<rect x='17' y='20' width='1' height='8' fill='#4a2f1a'/>` +
    `<circle cx='16' cy='14' r='12' fill='${palette.d}'/>` +
    `<circle cx='16' cy='13' r='11' fill='${palette.m}'/>` +
    `<circle cx='13' cy='10' r='6' fill='${palette.l}'/>` +
    `</svg>`
  );
}

function svgFlowers(v: number): string {
  const palette =
    v === 0 ? ["#ef4444", "#ec4899", "#fb923c"] :
    v === 1 ? ["#fbbf24", "#facc15", "#fde047"] :
              ["#a855f7", "#c084fc", "#60a5fa"];
  // 3 blooms with stems + petals
  const bloom = (cx: number, cy: number, c: string) =>
    `<line x1='${cx}' y1='${cy + 2}' x2='${cx}' y2='${cy + 6}' stroke='#2f6b30' stroke-width='1'/>` +
    `<circle cx='${cx - 2}' cy='${cy}' r='2' fill='${c}'/>` +
    `<circle cx='${cx + 2}' cy='${cy}' r='2' fill='${c}'/>` +
    `<circle cx='${cx}' cy='${cy - 2}' r='2' fill='${c}'/>` +
    `<circle cx='${cx}' cy='${cy + 2}' r='2' fill='${c}'/>` +
    `<circle cx='${cx}' cy='${cy}' r='1.5' fill='#fef3c7'/>`;
  return uri(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${T}' height='${T}'>` +
    bloom(9, 9, palette[0]) +
    bloom(22, 13, palette[1]) +
    bloom(14, 23, palette[2]) +
    `</svg>`
  );
}

function svgSign(): string {
  return uri(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${T}' height='${T}'>` +
    `<rect x='14' y='16' width='4' height='14' fill='#5b3a1d'/>` +
    `<rect x='4' y='4' width='24' height='14' fill='#d4a574' stroke='#5b3a1d' stroke-width='1.5' rx='2'/>` +
    `<rect x='7' y='7' width='18' height='1' fill='#5b3a1d'/>` +
    `<rect x='7' y='10' width='14' height='1' fill='#5b3a1d'/>` +
    `<rect x='7' y='13' width='16' height='1' fill='#5b3a1d'/>` +
    `<circle cx='6' cy='6' r='1' fill='#4a2f1a'/>` +
    `<circle cx='26' cy='6' r='1' fill='#4a2f1a'/>` +
    `</svg>`
  );
}

const GRASS_URIS  = [svgGrass(0), svgGrass(1), svgGrass(2)];
const PATH_URIS   = [svgPath(0), svgPath(1), svgPath(2)];
const WATER_URIS  = [svgWater(0), svgWater(1), svgWater(2)];
const TREE_URIS   = [svgTree(0), svgTree(1), svgTree(2)];
const FLOWER_URIS = [svgFlowers(0), svgFlowers(1), svgFlowers(2)];
const FENCE_URI   = svgFence();
const SIGN_URI    = svgSign();

function shadeHex(hex: string, pct: number): string {
  const c = hex.replace("#", "");
  if (c.length < 6) return hex;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const f = pct / 100;
  const adj = (n: number) => Math.max(0, Math.min(255, Math.round(n + (f > 0 ? (255 - n) * f : n * f))));
  return `rgb(${adj(r)}, ${adj(g)}, ${adj(b)})`;
}
