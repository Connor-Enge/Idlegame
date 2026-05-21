import { NextResponse } from "next/server";
import { leaderboard } from "@/lib/db/players";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await leaderboard(25);
    return NextResponse.json({ leaderboard: rows });
  } catch (err) {
    console.error("[api/leaderboard] failed", err);
    return NextResponse.json({ error: "Failed to load leaderboard" }, { status: 500 });
  }
}
