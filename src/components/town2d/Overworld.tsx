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
import MapCanvas from "./MapCanvas";

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
  if (sun < 0.2) return "rgba(12, 21, 48, 0.40)";       // deep night
  if (sun < 0.4) return "rgba(255, 138, 64, 0.15)";     // dawn / dusk
  if (sun < 0.7) return "rgba(253, 230, 138, 0.04)";    // morning
  return "rgba(0, 0, 0, 0)";                            // clear day
}

// Day/night lives in its own component so its tick doesn't drag the rest
// of the overworld through a re-render every interval.
function DayNightOverlay() {
  const [tod, setTod] = useState(0.5);
  useEffect(() => {
    const t = setInterval(() => setTod((c) => (c + 5 / 300) % 1), 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: dayTint(tod),
        pointerEvents: "none",
        zIndex: 70,
        transition: "background 1200ms linear",
      }}
    />
  );
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

  // Day-night now lives in its own component (DayNightOverlay) so the
  // 5-second tick doesn't trigger Overworld re-renders.

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
        <MapCanvas />
        <FountainOverlay />

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

      {/* Day/night tint — isolated component so its tick stays off the
          Overworld's render path. */}
      <DayNightOverlay />

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

// --- Fountain overlay -----------------------------------------------------
// The fountain has an animated spout, so the bowl is drawn into the static
// canvas but the spout is a tiny absolutely-positioned div on top. We
// locate the fountain tile once at module load by scanning the map.

const FOUNTAIN_POS: { x: number; y: number } | null = (() => {
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (tileAt(x, y) === "W") return { x, y };
    }
  }
  return null;
})();

function FountainOverlay() {
  if (!FOUNTAIN_POS) return null;
  const left = FOUNTAIN_POS.x * TILE;
  const top = FOUNTAIN_POS.y * TILE;
  return (
    <div style={{ position: "absolute", left, top, width: TILE, height: TILE, pointerEvents: "none" }}>
      {/* Plinth */}
      <div style={{ position: "absolute", left: 8, top: 18, width: 16, height: 6, background: "#737373", border: "1.5px solid #404040", borderRadius: 2 }} />
      <div style={{ position: "absolute", left: 11, top: 13, width: 10, height: 6, background: "#a1a1aa", border: "1.5px solid #404040", borderRadius: "3px 3px 1px 1px" }} />
      <div style={{ position: "absolute", left: 13, top: 8, width: 6, height: 6, background: "#94a3b8", border: "1.5px solid #404040", borderRadius: "3px 3px 1px 1px" }} />
      {/* Spout — only animated element on the entire static map */}
      <div style={{ position: "absolute", left: 15, top: 2, width: 2, height: 6, background: "#7dd3fc", borderRadius: 1, animation: "fSpout 1.6s ease-in-out infinite", transformOrigin: "center bottom" }} />
      <style jsx>{`
        @keyframes fSpout { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(1.4); } }
      `}</style>
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
