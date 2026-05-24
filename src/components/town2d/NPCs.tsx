"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { TILE, isWalkable, isBuilding } from "./map";
import { NPCSprite, type Dir } from "./Sprite";

interface NPCDef {
  id: string;
  home: { x: number; y: number };
  shirt: string;
  hair?: string;
  pants?: string;
  // Half-width of the wander box. NPC won't step outside this many tiles
  // from home. Keeps NPCs from drifting onto critical paths or off-screen.
  range: number;
  name: string;
  // Lines shown when the player bumps into them.
  lines: string[];
}

const NPCS: NPCDef[] = [
  {
    id: "mentor",
    home: { x: 10, y: 14 },
    shirt: "#e5e7eb",
    hair: "#6b7280",
    pants: "#374151",
    range: 1,
    name: "Mayor Sal",
    lines: [
      "Ah, a new face in Paradise!",
      "Walk into any building's door to step inside. The doors are the bright tiles at the front of each building.",
      "Tap a sign to read it. Bump into a townsfolk to chat.",
      "Make your fortune — and when you've made enough, retire to bank Legacy Points for your next life.",
    ],
  },
  {
    id: "n1",
    home: { x: 4, y: 6 },
    shirt: "#f87171",
    hair: "#7c2d12",
    range: 2,
    name: "Devvy",
    lines: [
      "Hey, new in town?",
      "The Career Office up the path is the fastest way to earn your first cash.",
    ],
  },
  {
    id: "n2",
    home: { x: 21, y: 6 },
    shirt: "#60a5fa",
    hair: "#1e3a8a",
    range: 2,
    name: "Marla",
    lines: [
      "I just sold a chain of bakeries for half a million.",
      "Open a business when you've got the cash — managers run them while you're off doing other things.",
    ],
  },
  {
    id: "n3",
    home: { x: 4, y: 13 },
    shirt: "#fbbf24",
    hair: "#92400e",
    range: 2,
    name: "Hank",
    lines: [
      "The market's wild today — half the tickers I watch are up double digits.",
      "Stocks here are shared across all players. Same prices, same momentum.",
    ],
  },
  {
    id: "n4",
    home: { x: 21, y: 13 },
    shirt: "#a78bfa",
    hair: "#4c1d95",
    range: 2,
    name: "Iris",
    lines: [
      "City Hall keeps the books on the global economy.",
      "When inflation spikes everything you own feels less valuable. Worth checking now and then.",
    ],
  },
  {
    id: "n5",
    home: { x: 4, y: 19 },
    shirt: "#34d399",
    hair: "#065f46",
    range: 2,
    name: "Otis",
    lines: [
      "Real estate's a slow burn but it pays rent every tick.",
      "Resort properties are gold once you can afford them.",
    ],
  },
  {
    id: "n6",
    home: { x: 21, y: 19 },
    shirt: "#f472b6",
    hair: "#831843",
    range: 2,
    name: "Pip",
    lines: [
      "The casino! Slot machines, dice, roulette… all 98% RTP.",
      "House still wins long-term. But sometimes you spike. Sometimes.",
    ],
  },
];

const DIRS: Record<Dir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export interface NPCsHandle {
  // Query the NPC currently occupying (x, y), if any. Used by Overworld at
  // the moment of a bump — reading state imperatively means a moving NPC
  // doesn't need to trigger Overworld re-renders.
  npcAt: (x: number, y: number) => NPCDef | null;
}

const NPCs = forwardRef<NPCsHandle, object>(function NPCs(_, ref) {
  // Track positions in a ref so the imperative handle stays consistent
  // even between renders. The render uses a parallel state object for the
  // actual DOM updates.
  const positionsRef = useRef<Record<string, { x: number; y: number }>>(
    Object.fromEntries(NPCS.map((n) => [n.id, { ...n.home }])),
  );

  useImperativeHandle(ref, () => ({
    npcAt(x, y) {
      for (const def of NPCS) {
        const p = positionsRef.current[def.id];
        if (p.x === x && p.y === y) return def;
      }
      return null;
    },
  }));

  return (
    <>
      {NPCS.map((n) => (
        <NPC key={n.id} def={n} onMove={(p) => { positionsRef.current[n.id] = p; }} />
      ))}
    </>
  );
});
export default NPCs;

function NPC({ def, onMove }: { def: NPCDef; onMove: (p: { x: number; y: number }) => void }) {
  const [pos, setPos] = useState(def.home);
  const [facing, setFacing] = useState<Dir>("down");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function schedule() {
      timer = setTimeout(tick, 1500 + Math.random() * 2500);
    }
    function tick() {
      // 60/40 walk/idle so they aren't constantly moving.
      if (Math.random() < 0.6) {
        const dirs: Dir[] = ["up", "down", "left", "right"];
        const dir = dirs[Math.floor(Math.random() * dirs.length)];
        const { dx, dy } = DIRS[dir];
        setFacing(dir);
        setPos((p) => {
          const nx = p.x + dx;
          const ny = p.y + dy;
          if (Math.abs(nx - def.home.x) > def.range) return p;
          if (Math.abs(ny - def.home.y) > def.range) return p;
          if (!isWalkable(nx, ny) || isBuilding(nx, ny)) return p;
          const next = { x: nx, y: ny };
          onMove(next);
          return next;
        });
      }
      schedule();
    }
    schedule();
    return () => clearTimeout(timer);
  }, [def.home.x, def.home.y, def.range, onMove]);

  return (
    <div
      style={{
        position: "absolute",
        left: pos.x * TILE,
        top: pos.y * TILE,
        width: TILE,
        height: TILE,
        transition: "left 320ms ease-out, top 320ms ease-out",
        zIndex: pos.y + 2,
      }}
    >
      <NPCSprite facing={facing} shirt={def.shirt} hair={def.hair} pants={def.pants} />
    </div>
  );
}
