"use client";

import { TILE } from "./map";

export type Dir = "up" | "down" | "left" | "right";

// Player character — a tiny CSS sprite sized to one tile. Built from divs so
// it doesn't need an asset pipeline. Facing is shown by the hair / cap stripe
// and the orientation of the eyes; the legs swing while walking so motion
// reads even at this scale.
export function PlayerSprite({
  facing,
  walking,
  phase,
  skin = "#fde2b3",
  shirt = "#22d3ee",
  hair = "#1f2937",
  pants = "#1e3a8a",
}: {
  facing: Dir;
  walking: boolean;
  phase: number; // 0..1 within a step
  skin?: string;
  shirt?: string;
  hair?: string;
  pants?: string;
}) {
  // Two-frame walk cycle: swap legs at the midpoint of each step.
  const swing = walking ? (phase < 0.5 ? 1 : -1) : 0;
  const bob = walking ? -Math.abs(Math.sin(phase * Math.PI)) * 1.5 : 0;
  // Eyes shift toward the direction the player is facing.
  const eyeShift =
    facing === "left" ? { x: -1.5, y: 0 } : facing === "right" ? { x: 1.5, y: 0 } : { x: 0, y: 0 };
  // Hide eyes when facing up (back of head).
  const showEyes = facing !== "up";
  return (
    <div
      style={{
        position: "absolute",
        width: TILE,
        height: TILE,
        transform: `translateY(${bob}px)`,
        pointerEvents: "none",
      }}
    >
      {/* Shadow */}
      <div
        style={{
          position: "absolute",
          left: 6,
          top: TILE - 6,
          width: TILE - 12,
          height: 4,
          background: "rgba(0,0,0,0.35)",
          borderRadius: "50%",
          filter: "blur(1px)",
        }}
      />
      {/* Legs */}
      <div
        style={{
          position: "absolute",
          left: 9,
          top: TILE - 12,
          width: 5,
          height: 8,
          background: pants,
          borderRadius: 2,
          transform: `translateY(${swing > 0 ? -1 : 0}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: TILE - 14,
          top: TILE - 12,
          width: 5,
          height: 8,
          background: pants,
          borderRadius: 2,
          transform: `translateY(${swing < 0 ? -1 : 0}px)`,
        }}
      />
      {/* Body / shirt */}
      <div
        style={{
          position: "absolute",
          left: 6,
          top: 13,
          width: TILE - 12,
          height: 11,
          background: shirt,
          borderRadius: 3,
          border: "1px solid rgba(0,0,0,0.25)",
        }}
      />
      {/* Head */}
      <div
        style={{
          position: "absolute",
          left: 8,
          top: 3,
          width: TILE - 16,
          height: 13,
          background: skin,
          borderRadius: 6,
          border: "1px solid rgba(0,0,0,0.3)",
        }}
      />
      {/* Hair / cap top */}
      <div
        style={{
          position: "absolute",
          left: 7,
          top: 2,
          width: TILE - 14,
          height: 5,
          background: hair,
          borderRadius: "6px 6px 2px 2px",
        }}
      />
      {/* Eyes */}
      {showEyes && (
        <>
          <div
            style={{
              position: "absolute",
              left: 11 + eyeShift.x,
              top: 9 + eyeShift.y,
              width: 2,
              height: 2,
              background: "#111",
              borderRadius: "50%",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: TILE - 13 + eyeShift.x,
              top: 9 + eyeShift.y,
              width: 2,
              height: 2,
              background: "#111",
              borderRadius: "50%",
            }}
          />
        </>
      )}
    </div>
  );
}

// Lightweight NPC variant — same body plan, different palette, optional
// bob if they're treated as walking. Kept inside this file so all character
// rendering lives in one place.
export function NPCSprite({
  facing = "down",
  shirt,
  hair = "#1f2937",
  pants = "#1e293b",
  walking = false,
  phase = 0,
}: {
  facing?: Dir;
  shirt: string;
  hair?: string;
  pants?: string;
  walking?: boolean;
  phase?: number;
}) {
  return <PlayerSprite facing={facing} walking={walking} phase={phase} shirt={shirt} hair={hair} pants={pants} />;
}
