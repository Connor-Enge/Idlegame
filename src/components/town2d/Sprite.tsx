"use client";

import { TILE } from "./map";

export type Dir = "up" | "down" | "left" | "right";

// Character sprite — built from styled divs at sub-pixel positions. The
// walk cycle is driven by a CSS keyframe that runs while the `walking`
// prop is true, so the parent doesn't need to push per-frame state into
// this component (much cheaper than a rAF-driven swing prop).

export interface SpritePalette {
  skin: string;
  shirt: string;
  shirtTrim: string;
  pants: string;
  shoes: string;
  hair: string;
  hat?: string;
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

export function PlayerSprite(props: { facing: Dir; walking: boolean; palette?: Partial<SpritePalette> }) {
  return <Character facing={props.facing} walking={props.walking} palette={{ ...DEFAULT, ...props.palette }} />;
}

export function NPCSprite(props: {
  facing?: Dir;
  shirt: string;
  hair?: string;
  pants?: string;
  walking?: boolean;
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
  return <Character facing={props.facing ?? "down"} walking={!!props.walking} palette={palette} />;
}

function Character({ facing, walking, palette }: { facing: Dir; walking: boolean; palette: SpritePalette }) {
  const isUp = facing === "up";
  const isDown = facing === "down";
  const isLeft = facing === "left";
  const isRight = facing === "right";

  // Walk class drives the leg/arm keyframes via CSS, no React updates.
  const cls = walking ? "t2d-char t2d-char-walk" : "t2d-char";

  return (
    <div
      className={cls}
      style={{
        position: "absolute",
        width: TILE,
        height: TILE,
        pointerEvents: "none",
      }}
    >
      {/* Shadow */}
      <div
        style={{
          position: "absolute",
          left: 5, top: TILE - 5,
          width: TILE - 10, height: 4,
          background: "rgba(0,0,0,0.35)",
          borderRadius: "50%",
          filter: "blur(1.5px)",
        }}
      />

      {/* Legs */}
      <Leg side="left" facing={facing} palette={palette} />
      <Leg side="right" facing={facing} palette={palette} />

      {/* Body */}
      <div
        style={{
          position: "absolute",
          left: 7, top: 15, width: 18, height: 11,
          background: `linear-gradient(180deg, ${palette.shirt} 0%, ${shade(palette.shirt, -10)} 100%)`,
          border: `1px solid ${palette.shirtTrim}`,
          borderRadius: "3px 3px 1px 1px",
        }}
      >
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

      {/* Arms */}
      <Arm side="left" facing={facing} palette={palette} />
      <Arm side="right" facing={facing} palette={palette} />

      {/* Head */}
      <div
        style={{
          position: "absolute",
          left: 9, top: 4, width: 14, height: 12,
          background: `linear-gradient(180deg, ${palette.skin} 0%, ${shade(palette.skin, -15)} 100%)`,
          border: "1px solid rgba(0,0,0,0.45)",
          borderRadius: "6px 6px 5px 5px",
        }}
      >
        {!isUp && <Eyes facing={facing} />}
        {isDown && <div style={{ position: "absolute", left: 6, top: 7, width: 3, height: 1, background: "#7c2d12", borderRadius: 1 }} />}
        {isLeft && <div style={{ position: "absolute", left: 2, top: 7, width: 2, height: 1, background: "#7c2d12", borderRadius: 1 }} />}
        {isRight && <div style={{ position: "absolute", right: 2, top: 7, width: 2, height: 1, background: "#7c2d12", borderRadius: 1 }} />}
      </div>

      <Hair palette={palette} facing={facing} />
      {palette.hat && <Cap palette={palette} facing={facing} />}
    </div>
  );
}

function Leg({ side, facing, palette }: { side: "left" | "right"; facing: Dir; palette: SpritePalette }) {
  const isLeft = side === "left";
  const isProfile = facing === "left" || facing === "right";
  const onFarSide = isProfile && ((facing === "left") === !isLeft);
  const width = onFarSide ? 3 : 4;
  const xBase = isLeft ? 11 : 17;
  return (
    <>
      <div
        className={`t2d-leg t2d-leg-${side}`}
        style={{
          position: "absolute",
          left: xBase, top: 24,
          width, height: 6,
          background: palette.pants,
          borderRadius: "1px 1px 0 0",
        }}
      />
      <div
        className={`t2d-shoe t2d-leg-${side}`}
        style={{
          position: "absolute",
          left: xBase - 0.5, top: 29,
          width: width + 1, height: 2,
          background: palette.shoes,
          borderRadius: 1,
        }}
      />
    </>
  );
}

function Arm({ side, facing, palette }: { side: "left" | "right"; facing: Dir; palette: SpritePalette }) {
  const isLeft = side === "left";
  const isProfile = facing === "left" || facing === "right";
  if (isProfile && ((facing === "left") === !isLeft)) return null;
  const xBase = isLeft ? 5 : 23;
  return (
    <>
      <div
        className={`t2d-arm t2d-arm-${side}`}
        style={{
          position: "absolute",
          left: xBase, top: 16,
          width: 3, height: 8,
          background: `linear-gradient(180deg, ${palette.shirt} 0%, ${shade(palette.shirt, -15)} 100%)`,
          border: `1px solid ${palette.shirtTrim}`,
          borderRadius: 1,
        }}
      />
      <div
        className={`t2d-arm t2d-arm-${side}`}
        style={{
          position: "absolute",
          left: xBase, top: 22,
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
      <div style={{ position: "absolute", left: 3, top: 5, width: 2, height: 2, background: "#1f2937", borderRadius: "50%" }} />
    );
  }
  if (facing === "right") {
    return (
      <div style={{ position: "absolute", right: 3, top: 5, width: 2, height: 2, background: "#1f2937", borderRadius: "50%" }} />
    );
  }
  return (
    <>
      <div style={{ position: "absolute", left: 3, top: 5, width: 2, height: 2, background: "#1f2937", borderRadius: "50%" }} />
      <div style={{ position: "absolute", right: 3, top: 5, width: 2, height: 2, background: "#1f2937", borderRadius: "50%" }} />
    </>
  );
}

function Hair({ palette, facing }: { palette: SpritePalette; facing: Dir }) {
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
  );
}

function Cap({ palette, facing }: { palette: SpritePalette; facing: Dir }) {
  const showBrim = facing !== "up";
  const brimX = facing === "left" ? 4 : facing === "right" ? 19 : 12;
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
        }}
      />
      {showBrim && (
        <div
          style={{
            position: "absolute",
            left: brimX, top: 6,
            width: brimW, height: 1.5,
            background: palette.hatBrim,
            borderRadius: 1,
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
