"use client";

import { useEffect, useRef } from "react";
import {
  TILE,
  MAP_W,
  MAP_H,
  tileAt,
  doorAt,
  buildingPaletteAt,
  isBuilding,
  isRoofCell,
  variant,
  type BuildingPalette,
} from "./map";

// The entire static map (grass, paths, fences, trees, flowers, signs,
// buildings) renders into a single <canvas> exactly once at mount. Drawing
// 700 tiles into one bitmap is dramatically cheaper than 700 absolutely-
// positioned divs for both layout and paint. After mount the canvas is
// effectively a single static image the GPU composites for free.

export default function MapCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1); // cap at 2× to keep texture small
    const w = MAP_W * TILE;
    const h = MAP_H * TILE;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;
    // We draw everything as solid fillRect pixel-art so disable anti-alias.
    ctx.translate(0.5, 0.5); // half-pixel offset for crisp 1-px lines on some browsers
    ctx.translate(-0.5, -0.5);

    // Pass 1: ground (grass / paths / water beds)
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        drawGround(ctx, x, y);
      }
    }

    // Pass 2: decoration that sits on the ground (trees, flowers, signs,
    // fence, fountain, water ripples). Drawing after ground means tree
    // canopies overlap onto neighbour grass naturally.
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        drawDecor(ctx, x, y);
      }
    }

    // Pass 3: buildings — walls under roofs under door awnings.
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (!isBuilding(x, y)) continue;
        drawBuilding(ctx, x, y);
      }
    }
  }, []);

  return (
    <canvas
      ref={ref}
      style={{
        position: "absolute",
        left: 0, top: 0,
        imageRendering: "pixelated",
        pointerEvents: "none",
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Palette — kept warm + cohesive so the grass↔path seam reads as a soft edge.

const C = {
  grass:      "#5b9b51",
  grassDark:  "#3d7338",
  grassLight: "#73b069",
  path:       "#b88a5b",
  pathLight:  "#cca57a",
  pathDark:   "#8a6638",
  pathEdge:   "#7d8b56", // grass-tinted halo around path tiles for blending
  fenceWood:  "#7a5b30",
  fenceRail:  "#a8895a",
  water:      "#2e7ad1",
  waterDeep:  "#1e3a8a",
  waterFoam:  "#bae6fd",
  trunk:      "#5b3a1d",
  trunkShade: "#3f2811",
  shadow:     "rgba(0,0,0,0.28)",
  signWood:   "#d4a574",
  signFrame:  "#5b3a1d",
  signLine:   "#5b3a1d",
};

// Deterministic blue-noise-ish offsets per tile so identical tile types
// don't look like a repeating texture.
function rng(x: number, y: number, salt = 0): number {
  let h = x * 374761393 + y * 668265263 + salt * 982451653;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}

// ---------------------------------------------------------------------------
// Ground pass

function drawGround(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const sym = tileAt(x, y);
  const px = x * TILE;
  const py = y * TILE;

  // Buildings get drawn separately in pass 3 but they need grass behind
  // them in case the roof corners are transparent.
  if (isBuilding(x, y)) {
    drawGrassTile(ctx, px, py, x, y);
    return;
  }

  if (sym === ",") {
    drawPathTile(ctx, px, py, x, y);
  } else if (sym === "w" || sym === "W") {
    drawWaterTile(ctx, px, py, x, y);
  } else {
    drawGrassTile(ctx, px, py, x, y);
  }
}

function drawGrassTile(ctx: CanvasRenderingContext2D, px: number, py: number, x: number, y: number) {
  // Base
  ctx.fillStyle = C.grass;
  ctx.fillRect(px, py, TILE, TILE);
  // Subtle banding so the field isn't a flat colour
  ctx.fillStyle = C.grassLight;
  for (let i = 0; i < TILE; i += 8) ctx.fillRect(px, py + i, TILE, 1);
  // Tufts — three short dark blades per tile in a deterministic pattern.
  ctx.fillStyle = C.grassDark;
  const r = rng(x, y);
  const tx1 = (r & 0x1f) % (TILE - 6) + 2;
  const ty1 = ((r >>> 5) & 0x1f) % (TILE - 6) + 2;
  const tx2 = ((r >>> 10) & 0x1f) % (TILE - 6) + 2;
  const ty2 = ((r >>> 15) & 0x1f) % (TILE - 6) + 2;
  // Tuft = vertical pixel cluster (3 blades, 1 px wide, 3-4 px tall)
  ctx.fillRect(px + tx1,     py + ty1,     1, 3);
  ctx.fillRect(px + tx1 + 2, py + ty1 - 1, 1, 4);
  ctx.fillRect(px + tx1 + 4, py + ty1,     1, 3);
  ctx.fillRect(px + tx2,     py + ty2,     1, 3);
  ctx.fillRect(px + tx2 + 2, py + ty2 - 1, 1, 4);
}

function drawPathTile(ctx: CanvasRenderingContext2D, px: number, py: number, x: number, y: number) {
  // Soft green-tinted edge so path tiles bleed into adjacent grass instead
  // of forming a hard rectangle. The edge ring lives outside the path
  // interior; only the centre is the warm tan.
  ctx.fillStyle = C.pathEdge;
  ctx.fillRect(px, py, TILE, TILE);
  // Dirt interior — slightly inset
  ctx.fillStyle = C.path;
  ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
  // Lighter highlight strip across the top
  ctx.fillStyle = C.pathLight;
  ctx.fillRect(px + 1, py + 1, TILE - 2, 2);
  // Pebbles — five small darker rocks per tile, deterministic placement.
  ctx.fillStyle = C.pathDark;
  const r = rng(x, y, 7);
  for (let i = 0; i < 5; i++) {
    const dx = ((r >>> (i * 5)) & 0x1f) % (TILE - 4) + 2;
    const dy = ((r >>> (i * 5 + 1)) & 0x1f) % (TILE - 4) + 2;
    ctx.fillRect(px + dx, py + dy, 2, 1);
    ctx.fillRect(px + dx, py + dy + 1, 1, 1);
  }
}

function drawWaterTile(ctx: CanvasRenderingContext2D, px: number, py: number, x: number, y: number) {
  // Two-tone water with a darker bottom edge and a lighter top to suggest
  // shallow depth. Plus a couple of foam lines.
  ctx.fillStyle = C.waterDeep;
  ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = C.water;
  ctx.fillRect(px, py, TILE, TILE - 4);
  // Foam lines (static — animation lives in the DOM overlay if any)
  ctx.fillStyle = C.waterFoam;
  const r = rng(x, y, 11);
  ctx.fillRect(px + (r & 0xf) + 2, py + 6, 8, 1);
  ctx.fillRect(px + ((r >>> 8) & 0xf) + 2, py + 18, 6, 1);
}

// ---------------------------------------------------------------------------
// Decoration pass

function drawDecor(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const sym = tileAt(x, y);
  const px = x * TILE;
  const py = y * TILE;
  switch (sym) {
    case "t": drawTree(ctx, px, py, variant(x, y)); break;
    case "f": drawFlowers(ctx, px, py, variant(x, y)); break;
    case "F": drawFence(ctx, px, py); break;
    case "s": drawSign(ctx, px, py); break;
    // Fountain is animated, drawn in DOM. We leave the water beneath it.
  }
}

function drawTree(ctx: CanvasRenderingContext2D, px: number, py: number, v: number) {
  const palette =
    v === 0 ? { d: "#1b5e20", m: "#2e7d32", l: "#4caf50" } :
    v === 1 ? { d: "#1a4d2e", m: "#2a6b3f", l: "#3f9c55" } :
              { d: "#0f3f1f", m: "#1f5530", l: "#36844a" };
  // Shadow under the tree
  fillEllipse(ctx, px + 6, py + 24, 20, 5, C.shadow);
  // Trunk
  ctx.fillStyle = C.trunk;
  ctx.fillRect(px + 13, py + 18, 6, 10);
  ctx.fillStyle = C.trunkShade;
  ctx.fillRect(px + 17, py + 18, 2, 10);
  // Canopy: 3 stacked discs for depth
  fillRound(ctx, px + 2, py + 4, 28, 18, 8, palette.d);
  fillRound(ctx, px + 4, py + 3, 24, 16, 7, palette.m);
  fillRound(ctx, px + 6, py + 4, 12, 9, 5, palette.l);
}

function drawFlowers(ctx: CanvasRenderingContext2D, px: number, py: number, v: number) {
  const palette =
    v === 0 ? ["#ef4444", "#ec4899", "#fb923c"] :
    v === 1 ? ["#facc15", "#fde047", "#fbbf24"] :
              ["#a855f7", "#c084fc", "#60a5fa"];
  const cluster = [
    { x: 6, y: 8, c: palette[0] },
    { x: 20, y: 12, c: palette[1] },
    { x: 12, y: 22, c: palette[2] },
  ];
  for (const f of cluster) drawBloom(ctx, px + f.x, py + f.y, f.c);
}

function drawBloom(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  // Stem
  ctx.fillStyle = "#2f6b30";
  ctx.fillRect(cx, cy + 3, 1, 4);
  // 4 petals + center
  ctx.fillStyle = color;
  ctx.fillRect(cx - 2, cy,     2, 2);
  ctx.fillRect(cx + 1, cy,     2, 2);
  ctx.fillRect(cx - 2, cy + 2, 2, 2);
  ctx.fillRect(cx + 1, cy + 2, 2, 2);
  ctx.fillStyle = "#fef3c7";
  ctx.fillRect(cx, cy + 1, 1, 1);
}

function drawFence(ctx: CanvasRenderingContext2D, px: number, py: number) {
  // Grass background was already drawn. Now lay the wood on top.
  // Two horizontal rails
  ctx.fillStyle = C.fenceRail;
  ctx.fillRect(px, py + 9, TILE, 4);
  ctx.fillRect(px, py + 20, TILE, 4);
  // Rail bottom-shadow line
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(px, py + 12, TILE, 1);
  ctx.fillRect(px, py + 23, TILE, 1);
  // Three uprights with pointed tops
  for (const ux of [4, 14, 24]) {
    ctx.fillStyle = C.fenceWood;
    ctx.fillRect(px + ux, py + 4, 4, 24);
    // Pointed top — single dark pixel cap
    ctx.fillStyle = "#5b3a1d";
    ctx.fillRect(px + ux + 1, py + 3, 2, 1);
  }
}

function drawSign(ctx: CanvasRenderingContext2D, px: number, py: number) {
  // Post
  ctx.fillStyle = C.signFrame;
  ctx.fillRect(px + 14, py + 16, 4, 14);
  // Plaque background
  ctx.fillStyle = C.signWood;
  ctx.fillRect(px + 4, py + 4, 24, 14);
  // Plaque border
  ctx.strokeStyle = C.signFrame;
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 4.5, py + 4.5, 23, 13);
  // Scratched text lines
  ctx.fillStyle = C.signLine;
  ctx.fillRect(px + 7, py + 7, 18, 1);
  ctx.fillRect(px + 7, py + 10, 14, 1);
  ctx.fillRect(px + 7, py + 13, 16, 1);
  // Nail heads
  ctx.fillStyle = "#3f2811";
  ctx.fillRect(px + 6, py + 6, 2, 2);
  ctx.fillRect(px + 24, py + 6, 2, 2);
}

// ---------------------------------------------------------------------------
// Building pass

function drawBuilding(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const palette = buildingPaletteAt(x, y)!;
  const px = x * TILE;
  const py = y * TILE;
  const isRoof = isRoofCell(x, y);
  const door = doorAt(x, y);
  const isAboveDoor = !!doorAt(x, y + 1);

  if (isRoof) drawRoofCell(ctx, px, py, palette, !isBuilding(x - 1, y), !isBuilding(x + 1, y));
  else if (door) drawDoorCell(ctx, px, py, palette, door.icon);
  else if (isAboveDoor) drawGableCell(ctx, px, py, palette);
  else drawWallCell(ctx, px, py, palette, variant(x, y) !== 0);
}

function drawRoofCell(ctx: CanvasRenderingContext2D, px: number, py: number, p: BuildingPalette, _cornerL: boolean, _cornerR: boolean) {
  const top = p.roof;
  const bot = shadeRGB(p.roof, -28);
  // Top half of roof (lit side)
  ctx.fillStyle = top;
  ctx.fillRect(px, py, TILE, TILE / 2);
  // Bottom half (shadow side)
  ctx.fillStyle = bot;
  ctx.fillRect(px, py + TILE / 2, TILE, TILE / 2);
  // Shingle rows — thin darker bands
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(px, py + 8, TILE, 1);
  ctx.fillRect(px, py + 18, TILE, 1);
  ctx.fillRect(px, py + TILE - 2, TILE, 2); // eave shadow line
  // Shingle stagger marks
  ctx.fillRect(px + 6, py + 3, 1, 4);
  ctx.fillRect(px + 22, py + 3, 1, 4);
  ctx.fillRect(px + 14, py + 12, 1, 4);
  ctx.fillRect(px + 24, py + 22, 1, 4);
}

function drawWallCell(ctx: CanvasRenderingContext2D, px: number, py: number, p: BuildingPalette, withWindow: boolean) {
  // Wall gradient — lighter top, darker bottom
  for (let i = 0; i < TILE; i++) {
    const t = i / TILE;
    ctx.fillStyle = lerpHex(shadeRGB(p.wall, 12), p.wall, t);
    ctx.fillRect(px, py + i, TILE, 1);
  }
  // Subtle brick texture: faint horizontal seams every 6 px
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  for (let i = 6; i < TILE; i += 6) ctx.fillRect(px, py + i, TILE, 1);
  // Offset vertical seams alternating per row
  for (let i = 0; i < TILE; i += 12) {
    ctx.fillRect(px + 11, py + i, 1, 6);
    ctx.fillRect(px + 22, py + i + 6, 1, 6);
  }
  if (withWindow) drawWindow(ctx, px, py);
}

function drawWindow(ctx: CanvasRenderingContext2D, px: number, py: number) {
  // Sill
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(px + 4, py + 21, TILE - 8, 2);
  // Frame
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(px + 5, py + 7, TILE - 10, 14);
  // Glass with warm glow
  ctx.fillStyle = "#fde68a";
  ctx.fillRect(px + 6, py + 8, TILE - 12, 12);
  // Mullions
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(px + TILE / 2, py + 8, 1, 12);
  ctx.fillRect(px + 6, py + 13, TILE - 12, 1);
  // Light pulse highlight
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillRect(px + 7, py + 9, 3, 2);
}

function drawGableCell(ctx: CanvasRenderingContext2D, px: number, py: number, p: BuildingPalette) {
  drawWallCell(ctx, px, py, p, false);
  // Trim strip
  ctx.fillStyle = p.roof;
  ctx.fillRect(px, py, TILE, 3);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(px, py + 3, TILE, 1);
  // Hanging sign plaque
  ctx.fillStyle = shadeRGB(p.roof, -10);
  ctx.fillRect(px + 8, py + 7, 16, 12);
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 8.5, py + 7.5, 15, 11);
  // Chains
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(px + 10, py + 4, 1, 4);
  ctx.fillRect(px + 21, py + 4, 1, 4);
}

function drawDoorCell(ctx: CanvasRenderingContext2D, px: number, py: number, p: BuildingPalette, icon: string) {
  // Wall background
  for (let i = 0; i < TILE; i++) {
    const t = i / TILE;
    ctx.fillStyle = lerpHex(shadeRGB(p.wall, 12), p.wall, t);
    ctx.fillRect(px, py + i, TILE, 1);
  }
  // Striped awning
  for (let i = 1; i < TILE - 1; i += 4) {
    ctx.fillStyle = p.roof;
    ctx.fillRect(px + i, py, 2, 6);
    ctx.fillStyle = shadeRGB(p.roof, 15);
    ctx.fillRect(px + i + 2, py, 2, 6);
  }
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(px + 1, py + 5, TILE - 2, 2);
  // Door frame
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(px + 5, py + 8, TILE - 10, 24);
  // Door panel
  const doorGrad = ["#5b3a1d", "#4a2f1a"];
  for (let i = 0; i < 22; i++) {
    ctx.fillStyle = lerpHex(doorGrad[0], doorGrad[1], i / 22);
    ctx.fillRect(px + 7, py + 9 + i, TILE - 14, 1);
  }
  // Door panels (raised inserts)
  ctx.strokeStyle = "#2a1810";
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 9.5, py + 11.5, 11, 7);
  ctx.strokeRect(px + 9.5, py + 20.5, 11, 7);
  // Knob
  ctx.fillStyle = "#fbbf24";
  ctx.fillRect(px + TILE - 9, py + 19, 2, 2);
  // Building icon plaque above the door
  ctx.fillStyle = p.roof;
  ctx.fillRect(px + 9, py + 8, 14, 7);
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 9.5, py + 8.5, 13, 6);
  ctx.font = "bold 7px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000";
  ctx.fillText(icon, px + TILE / 2, py + 12);
}

// ---------------------------------------------------------------------------
// Helpers

function fillEllipse(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

function fillRound(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, _r: number, color: string) {
  fillEllipse(ctx, x, y, w, h, color);
}

function shadeRGB(hex: string, pct: number): string {
  const c = hex.replace("#", "");
  if (c.length < 6) return hex;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const f = pct / 100;
  const adj = (n: number) => Math.max(0, Math.min(255, Math.round(n + (f > 0 ? (255 - n) * f : n * f))));
  return `rgb(${adj(r)}, ${adj(g)}, ${adj(b)})`;
}

function lerpHex(a: string, b: string, t: number): string {
  const pa = parseColor(a);
  const pb = parseColor(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

function parseColor(c: string): [number, number, number] {
  if (c.startsWith("rgb")) {
    const m = c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (m) return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
  }
  const h = c.replace("#", "");
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}
