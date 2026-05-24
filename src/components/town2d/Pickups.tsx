"use client";

import { useEffect, useMemo, useState } from "react";
import { TILE, MAP_W, MAP_H, tileAt, isWalkable, isBuilding } from "./map";
import { useGame } from "@/lib/store";

// Cash bills that periodically spawn on walkable grass tiles. Stepping onto
// a tile that has one collects it: direct cash bump (skips the action layer
// and its toast — these are decorative juice, not a balance-critical reward
// path) plus a floating "+$X" indicator.

const MAX_ACTIVE = 5;
const SPAWN_EVERY_MS = 11_000;
const LIFETIME_MS = 26_000;
const PICKUP_COOLDOWN_MS = 250; // tiny grace so step-onto doesn't fire twice

interface Pickup {
  id: number;
  x: number;
  y: number;
  amount: number;
  spawnedAt: number;
}

function bumpCash(amount: number) {
  if (amount <= 0) return;
  useGame.setState((s) => {
    if (!s.state) return s;
    return {
      state: {
        ...s.state,
        stats: {
          ...s.state.stats,
          cash: s.state.stats.cash + amount,
          netWorth: s.state.stats.netWorth + amount,
        },
      },
    };
  });
}

export default function Pickups({
  playerTile,
  onCollect,
}: {
  playerTile: { x: number; y: number };
  onCollect: (amount: number, x: number, y: number) => void;
}) {
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const lastCollect = useMemo(() => ({ at: 0 }), []);

  // Pre-compute all spawnable tiles (grass only, never on paths so they're
  // visible in the open and don't clutter walkways).
  const spawnTiles = useMemo(() => {
    const out: { x: number; y: number }[] = [];
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (tileAt(x, y) === "." && isWalkable(x, y) && !isBuilding(x, y)) {
          out.push({ x, y });
        }
      }
    }
    return out;
  }, []);

  // Spawn loop.
  useEffect(() => {
    const t = setInterval(() => {
      setPickups((cur) => {
        const now = Date.now();
        // Drop expired.
        const live = cur.filter((p) => now - p.spawnedAt < LIFETIME_MS);
        if (live.length >= MAX_ACTIVE) return live;
        // Try a few tiles until we find one with no existing pickup.
        for (let tries = 0; tries < 8; tries++) {
          const cell = spawnTiles[Math.floor(Math.random() * spawnTiles.length)];
          if (!cell) break;
          if (live.some((p) => p.x === cell.x && p.y === cell.y)) continue;
          // Don't spawn on the player's own tile.
          if (cell.x === playerTile.x && cell.y === playerTile.y) continue;
          const level = useGame.getState().state?.progression.level ?? 1;
          const amount = 40 + Math.floor(Math.random() * 60) + level * 20;
          return [...live, { id: now + tries, x: cell.x, y: cell.y, amount, spawnedAt: now }];
        }
        return live;
      });
    }, SPAWN_EVERY_MS);
    return () => clearInterval(t);
  }, [playerTile.x, playerTile.y, spawnTiles]);

  // Collect on overlap.
  useEffect(() => {
    setPickups((cur) => {
      const now = Date.now();
      if (now - lastCollect.at < PICKUP_COOLDOWN_MS) return cur;
      const hit = cur.find((p) => p.x === playerTile.x && p.y === playerTile.y);
      if (!hit) return cur;
      lastCollect.at = now;
      bumpCash(hit.amount);
      onCollect(hit.amount, hit.x, hit.y);
      return cur.filter((p) => p.id !== hit.id);
    });
  }, [playerTile.x, playerTile.y, lastCollect, onCollect]);

  // Expire stale visuals every second so they fade out without waiting for
  // the next collect/spawn.
  useEffect(() => {
    const t = setInterval(() => {
      setPickups((cur) => {
        const now = Date.now();
        const live = cur.filter((p) => now - p.spawnedAt < LIFETIME_MS);
        return live.length === cur.length ? cur : live;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      {pickups.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: p.x * TILE,
            top: p.y * TILE,
            width: TILE,
            height: TILE,
            zIndex: p.y + 1,
            animation: "billBob 1.4s ease-in-out infinite",
            pointerEvents: "none",
          }}
        >
          {/* Shadow that grows/shrinks with the bob so the bill feels grounded */}
          <div
            style={{
              position: "absolute",
              left: 8,
              top: TILE - 5,
              width: TILE - 16,
              height: 3,
              background: "rgba(0,0,0,0.4)",
              borderRadius: "50%",
              filter: "blur(1px)",
              animation: "billShadow 1.4s ease-in-out infinite",
            }}
          />
          {/* Dollar bill — stylized with border, denomination corners, and a portrait oval */}
          <div
            style={{
              position: "absolute",
              left: 4,
              top: 9,
              width: TILE - 8,
              height: 14,
              background:
                "linear-gradient(180deg, #4ade80 0%, #16a34a 100%)",
              border: "1.5px solid #14532d",
              borderRadius: 2,
              boxShadow:
                "inset 0 0 0 1px rgba(255,255,255,0.3), 0 1px 2px rgba(0,0,0,0.5)",
              transform: "rotate(-6deg)",
            }}
          >
            {/* Inner border */}
            <div
              style={{
                position: "absolute",
                inset: 2,
                border: "1px dashed rgba(255,255,255,0.45)",
                borderRadius: 1,
              }}
            />
            {/* Portrait oval */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: 3,
                marginLeft: -3,
                width: 6,
                height: 6,
                background: "#bbf7d0",
                border: "1px solid #14532d",
                borderRadius: "50%",
              }}
            />
            {/* $ in corners */}
            <div style={{ position: "absolute", left: 1, top: 0, fontSize: 6, fontWeight: 900, color: "#dcfce7", lineHeight: "8px" }}>$</div>
            <div style={{ position: "absolute", right: 1, bottom: 0, fontSize: 6, fontWeight: 900, color: "#dcfce7", lineHeight: "8px" }}>$</div>
          </div>
        </div>
      ))}
      <style jsx>{`
        @keyframes billBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes billShadow {
          0%, 100% { transform: scaleX(1); opacity: 0.4; }
          50% { transform: scaleX(0.7); opacity: 0.2; }
        }
      `}</style>
    </>
  );
}
