import { NextResponse } from "next/server";
import { getMarket } from "@/lib/market/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Shared market snapshot. Every player polls this to keep prices in sync —
// it's the single source of truth for asset prices, history and the macro
// economy. Client-side ticks no longer simulate either.
export async function GET() {
  const m = await getMarket();
  return NextResponse.json(m, { headers: { "Cache-Control": "no-store" } });
}
