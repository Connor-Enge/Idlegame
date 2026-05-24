"use client";

import { useEffect, useState } from "react";
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
  // Optional one-liner shown by the renderer above their head; a future
  // pass can swap this for a real dialog box on bump.
  line?: string;
}

const NPCS: NPCDef[] = [
  { id: "n1", home: { x: 4, y: 6 }, shirt: "#f87171", hair: "#7c2d12", range: 2 },
  { id: "n2", home: { x: 21, y: 6 }, shirt: "#60a5fa", hair: "#1e3a8a", range: 2 },
  { id: "n3", home: { x: 4, y: 13 }, shirt: "#fbbf24", hair: "#92400e", range: 2 },
  { id: "n4", home: { x: 21, y: 13 }, shirt: "#a78bfa", hair: "#4c1d95", range: 2 },
  { id: "n5", home: { x: 4, y: 19 }, shirt: "#34d399", hair: "#065f46", range: 2 },
  { id: "n6", home: { x: 21, y: 19 }, shirt: "#f472b6", hair: "#831843", range: 2 },
];

const DIRS: Record<Dir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export default function NPCs() {
  return (
    <>
      {NPCS.map((n) => (
        <NPC key={n.id} def={n} />
      ))}
    </>
  );
}

function NPC({ def }: { def: NPCDef }) {
  const [pos, setPos] = useState(def.home);
  const [facing, setFacing] = useState<Dir>("down");

  // Stagger NPC ticks so they don't all move at the same moment, which would
  // look mechanical. Tick interval randomises per cycle too.
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
          // Block on buildings too — door tiles aren't walkable, but neither
          // is the door interaction meaningful for NPCs.
          if (!isWalkable(nx, ny) || isBuilding(nx, ny)) return p;
          return { x: nx, y: ny };
        });
      }
      schedule();
    }
    schedule();
    return () => clearTimeout(timer);
  }, [def.home.x, def.home.y, def.range]);

  return (
    <div
      style={{
        position: "absolute",
        left: pos.x * TILE,
        top: pos.y * TILE,
        width: TILE,
        height: TILE,
        // CSS transition gives NPCs a smooth slide between tiles without
        // needing a per-frame rAF loop. Matches the player's step duration.
        transition: "left 320ms ease-out, top 320ms ease-out",
        zIndex: pos.y + 2,
      }}
    >
      <NPCSprite facing={facing} shirt={def.shirt} hair={def.hair} pants={def.pants} />
    </div>
  );
}
