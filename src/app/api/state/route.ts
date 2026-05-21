import { NextResponse } from "next/server";
import { loadOrCreatePlayer, savePlayer } from "@/lib/db/players";
import type { GameState } from "@/lib/game/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/state?playerId=xxx — load (or create) a player's save.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const playerId = searchParams.get("playerId");
  if (!playerId) return NextResponse.json({ error: "playerId required" }, { status: 400 });

  try {
    const state = await loadOrCreatePlayer(playerId);
    return NextResponse.json({ state });
  } catch (err) {
    console.error("[api/state] load failed", err);
    return NextResponse.json({ error: "Failed to load state" }, { status: 500 });
  }
}

// POST /api/state — persist a save. Body: { state: GameState }
export async function POST(req: Request) {
  let body: { state?: GameState };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.state?.playerId) {
    return NextResponse.json({ error: "state.playerId required" }, { status: 400 });
  }

  try {
    await savePlayer(body.state);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/state] save failed", err);
    return NextResponse.json({ error: "Failed to save state" }, { status: 500 });
  }
}
