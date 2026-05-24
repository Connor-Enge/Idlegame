"use client";

import { TILE } from "./map";

export type Dir = "up" | "down" | "left" | "right";

// Character sprite — built from styled divs at sub-pixel positions to give
// a 32-px character much more shape than a plain head/body/legs stack. Each
// part is parametrised by palette so NPCs can share the build with their
// own colours.
//
// Walk animation: a per-step phase 0..1 drives a smooth leg + arm swing
// plus a tiny head bob, so motion reads even at this tile size without
// needing a multi-frame sprite sheet.

export interface SpritePalette {
  skin: string;
  shirt: string;
  shirtTrim: string;
  pants: string;
  shoes: string;
  hair: string;
  hat?: string; // optional baseball cap; renders over the front of the hair
  hatBrim?: string;
}

const DEFAULT: SpritePalette = {
  skin: "#fcd9b6",
  shirt: "#0ea5e9",
  shirtTrim: "#0c4a6e",
  pants: "#1e3a8a",
  shoes: "#451a03",
  hair: "#1f2937",
  hat: "#ef4444",
  hatBrim: "#7f1d1d",
};

export function PlayerSprite(props: {
  facing: Dir;
  walking: boolean;
  phase: number;
  palette?: Partial<SpritePalette>;
}) {
  return <Character {...props} palette={{ ...DEFAULT, ...props.palette }} />;
}

// NPC is just a re-export with no default hat so the colour swatches read
// as "regular townsfolk" instead of "another player character".
export function NPCSprite(props: {
  facing?: Dir;
  shirt: string;
  hair?: string;
  pants?: string;
  walking?: boolean;
  phase?: number;
}) {
  const palette: SpritePalette = {
    ...DEFAULT,
    shirt: props.shirt,
    shirtTrim: shade(props.shirt, -25),
    hair: props.hair ?? DEFAULT.hair,
    pants: props.pants ?? "#374151",
    hat: undefined,
    hatBrim: undefined,
  };
  return (
    <Character
      facing={props.facing ?? "down"}
      walking={!!props.walking}
      phase={props.phase ?? 0}
      palette={palette}
    />
  );
}

// ----------------------------------------------------------------------
// Internals

function Character({
  facing,
  walking,
  phase,
  palette,
}: {
  facing: Dir;
  walking: boolean;
  phase: number;
  palette: SpritePalette;
}) {
  // Leg/arm swing: two-frame cycle per step. Positive swing = left limb
  // forward, negative = right limb forward.
  const swing = walking ? (phase < 0.5 ? 1 : -1) : 0;
  // Tiny head bob to sell motion.
  const bob = walking ? -Math.abs(Math.sin(phase * Math.PI)) * 1.5 : 0;
  // Whole-sprite rocking — Pokemon characters rock side-to-side a touch.
  const rock = walking ? Math.sin(phase * Math.PI * 2) * 0.6 : 0;

  const isUp = facing === "up";
  const isDown = facing === "down";
  const isLeft = facing === "left";
  const isRight = facing === "right";

  return (
    <div
      style={{
        position: "absolute",
        width: TILE,
        height: TILE,
        transform: `translate(${rock}px, ${bob}px)`,
        pointerEvents: "none",
        imageRendering: "pixelated",
      }}
    >
      {/* Shadow — a soft ellipse beneath the feet, anchored to the tile. */}
      <div
        style={{
          position: "absolute",
          left: 5, top: TILE - 5,
          width: TILE - 10, height: 4,
          background: "rgba(0,0,0,0.4)",
          borderRadius: "50%",
          filter: "blur(1.5px)",
          transform: `translateY(${-bob}px)`,
        }}
      />

      {/* Legs — drawn first so the body covers their tops cleanly. */}
      <Leg side="left" facing={facing} palette={palette} offset={swing} />
      <Leg side="right" facing={facing} palette={palette} offset={-swing} />

      {/* Body — shirt with side trim that hints at sleeves wrapping. */}
      <div
        style={{
          position: "absolute",
          left: 7, top: 15, width: 18, height: 11,
          background: `linear-gradient(180deg, ${palette.shirt} 0%, ${shade(palette.shirt, -10)} 100%)`,
          border: `1px solid ${palette.shirtTrim}`,
          borderRadius: "3px 3px 1px 1px",
          boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.25)",
        }}
      >
        {/* V-collar / back-of-shirt detail */}
        {!isUp && (
          <div
            style={{
              position: "absolute",
              left: 6, top: -1, width: 6, height: 3,
              background: palette.skin,
              borderRadius: "0 0 3px 3px",
              border: `1px solid ${palette.shirtTrim}`,
              borderTop: "none",
            }}
          />
        )}
      </div>

      {/* Arms with hands at the tip. Swing opposite the legs. */}
      <Arm side="left" facing={facing} palette={palette} offset={-swing} />
      <Arm side="right" facing={facing} palette={palette} offset={swing} />

      {/* Head — skin oval with hair on top + ear hint on the visible side. */}
      <div
        style={{
          position: "absolute",
          left: 9, top: 4, width: 14, height: 12,
          background: `linear-gradient(180deg, ${palette.skin} 0%, ${shade(palette.skin, -15)} 100%)`,
          border: "1px solid rgba(0,0,0,0.45)",
          borderRadius: "6px 6px 5px 5px",
        }}
      >
        {/* Ears */}
        {(isLeft || isDown || isRight) && (
          <div style={{ position: "absolute", left: -2, top: 5, width: 2, height: 3, background: palette.skin, border: "1px solid rgba(0,0,0,0.35)", borderRadius: "50%" }} />
        )}
        {(isRight || isDown || isLeft) && (
          <div style={{ position: "absolute", right: -2, top: 5, width: 2, height: 3, background: palette.skin, border: "1px solid rgba(0,0,0,0.35)", borderRadius: "50%" }} />
        )}
        {/* Eyes — directional. Hide entirely when facing up (back of head). */}
        {!isUp && <Eyes facing={facing} />}
        {/* Mouth */}
        {isDown && (
          <div style={{ position: "absolute", left: 6, top: 7, width: 3, height: 1, background: "#7c2d12", borderRadius: 1 }} />
        )}
        {isLeft && (
          <div style={{ position: "absolute", left: 2, top: 7, width: 2, height: 1, background: "#7c2d12", borderRadius: 1 }} />
        )}
        {isRight && (
          <div style={{ position: "absolute", right: 2, top: 7, width: 2, height: 1, background: "#7c2d12", borderRadius: 1 }} />
        )}
      </div>

      {/* Hair — three patches that wrap differently per facing so the back
          of the head reads as a single mound when facing up. */}
      <Hair palette={palette} facing={facing} />

      {/* Optional cap on top of the hair. */}
      {palette.hat && <Cap palette={palette} facing={facing} />}
    </div>
  );
}

function Leg({ side, facing, palette, offset }: { side: "left" | "right"; facing: Dir; palette: SpritePalette; offset: number }) {
  const isLeft = side === "left";
  // When facing left/right the visible leg is the one on that side; the
  // far leg gets squished narrower to suggest perspective.
  const isProfile = facing === "left" || facing === "right";
  const onFarSide = isProfile && ((facing === "left") === !isLeft);
  const width = onFarSide ? 3 : 4;
  const xBase = isLeft ? 11 : 17;
  const yOffset = offset > 0 ? -1 : 0;
  return (
    <>
      {/* Pants */}
      <div
        style={{
          position: "absolute",
          left: xBase, top: 24 + yOffset,
          width, height: 6,
          background: palette.pants,
          borderRadius: "1px 1px 0 0",
          boxShadow: "inset -1px 0 0 rgba(0,0,0,0.3)",
        }}
      />
      {/* Shoes */}
      <div
        style={{
          position: "absolute",
          left: xBase - 0.5, top: 29 + yOffset,
          width: width + 1, height: 2,
          background: palette.shoes,
          borderRadius: "1px",
          boxShadow: "inset -1px 0 0 rgba(0,0,0,0.35)",
        }}
      />
    </>
  );
}

function Arm({ side, facing, palette, offset }: { side: "left" | "right"; facing: Dir; palette: SpritePalette; offset: number }) {
  const isLeft = side === "left";
  const isProfile = facing === "left" || facing === "right";
  // In profile, the far arm is hidden behind the body.
  if (isProfile && ((facing === "left") === !isLeft)) return null;
  const xBase = isLeft ? 5 : 23;
  // Slight forward swing during step.
  const yOffset = offset > 0 ? -0.5 : 0.5;
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: xBase, top: 16 + yOffset,
          width: 3, height: 8,
          background: `linear-gradient(180deg, ${palette.shirt} 0%, ${shade(palette.shirt, -15)} 100%)`,
          border: `1px solid ${palette.shirtTrim}`,
          borderRadius: 1,
        }}
      />
      {/* Hand */}
      <div
        style={{
          position: "absolute",
          left: xBase, top: 22 + yOffset,
          width: 3, height: 2,
          background: palette.skin,
          border: "1px solid rgba(0,0,0,0.4)",
          borderRadius: 1,
        }}
      />
    </>
  );
}

function Eyes({ facing }: { facing: Dir }) {
  if (facing === "left") {
    return (
      <div style={{ position: "absolute", left: 2, top: 5, width: 3, height: 2, background: "#ffffff", border: "0.5px solid #000", borderRadius: "50%" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 1.5, height: 2, background: "#1f2937", borderRadius: "50%" }} />
      </div>
    );
  }
  if (facing === "right") {
    return (
      <div style={{ position: "absolute", right: 2, top: 5, width: 3, height: 2, background: "#ffffff", border: "0.5px solid #000", borderRadius: "50%" }}>
        <div style={{ position: "absolute", right: 0, top: 0, width: 1.5, height: 2, background: "#1f2937", borderRadius: "50%" }} />
      </div>
    );
  }
  return (
    <>
      <div style={{ position: "absolute", left: 2, top: 5, width: 3, height: 2, background: "#ffffff", border: "0.5px solid #000", borderRadius: "50%" }}>
        <div style={{ position: "absolute", left: 0.5, top: 0, width: 1.5, height: 2, background: "#1f2937", borderRadius: "50%" }} />
      </div>
      <div style={{ position: "absolute", right: 2, top: 5, width: 3, height: 2, background: "#ffffff", border: "0.5px solid #000", borderRadius: "50%" }}>
        <div style={{ position: "absolute", left: 0.5, top: 0, width: 1.5, height: 2, background: "#1f2937", borderRadius: "50%" }} />
      </div>
    </>
  );
}

function Hair({ palette, facing }: { palette: SpritePalette; facing: Dir }) {
  // Cap-piece on top of the head + side wisps. Facing-up shows a fuller
  // back-of-head shape so the silhouette doesn't look bald from behind.
  if (facing === "up") {
    return (
      <div
        style={{
          position: "absolute",
          left: 8, top: 3, width: 16, height: 10,
          background: palette.hair,
          border: "1px solid rgba(0,0,0,0.5)",
          borderRadius: "7px 7px 4px 4px",
        }}
      />
    );
  }
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 8, top: 3, width: 16, height: 5,
          background: palette.hair,
          borderRadius: "7px 7px 1px 1px",
          border: "1px solid rgba(0,0,0,0.5)",
          borderBottom: "none",
        }}
      />
      {/* Front fringe */}
      <div style={{ position: "absolute", left: 10, top: 6, width: 4, height: 2, background: palette.hair, borderRadius: 1 }} />
      <div style={{ position: "absolute", left: 17, top: 6, width: 3, height: 2, background: palette.hair, borderRadius: 1 }} />
    </>
  );
}

function Cap({ palette, facing }: { palette: SpritePalette; facing: Dir }) {
  // Baseball cap: crown over the head + a brim that points in the facing
  // direction. Brim hides on facing-up since the wearer's back faces us.
  const showBrim = facing !== "up";
  const brimX = facing === "left" ? 4 : facing === "right" ? 19 : 12;
  const brimY = 6;
  const brimW = facing === "down" ? 8 : facing === "left" || facing === "right" ? 5 : 0;
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 8, top: 1, width: 16, height: 6,
          background: `linear-gradient(180deg, ${palette.hat} 0%, ${shade(palette.hat!, -15)} 100%)`,
          border: "1px solid rgba(0,0,0,0.5)",
          borderRadius: "8px 8px 1px 1px",
          boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.3)",
        }}
      />
      {/* Logo dot */}
      <div style={{ position: "absolute", left: 15, top: 3, width: 2, height: 2, background: "#ffffff", borderRadius: "50%" }} />
      {showBrim && (
        <div
          style={{
            position: "absolute",
            left: brimX, top: brimY,
            width: brimW, height: 1.5,
            background: palette.hatBrim,
            borderRadius: "1px",
            boxShadow: "0 0.5px 0 rgba(0,0,0,0.4)",
          }}
        />
      )}
    </>
  );
}

function shade(hex: string, pct: number): string {
  const c = hex.replace("#", "");
  if (c.length < 6) return hex;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const f = pct / 100;
  const adj = (n: number) => Math.max(0, Math.min(255, Math.round(n + (f > 0 ? (255 - n) * f : n * f))));
  return `rgb(${adj(r)}, ${adj(g)}, ${adj(b)})`;
}
