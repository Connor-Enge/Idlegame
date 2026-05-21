import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/ensure";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Open <your-deploy-url>/api/health in a browser to confirm wiring end-to-end.
// Reports whether DATABASE_URL is present, whether the schema bootstrap ran,
// and how many players have been saved. No secrets are returned.
export async function GET() {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
  const result: Record<string, unknown> = {
    app: "ok",
    hasDatabaseUrl,
    db: "unknown",
    playerCount: null,
    checkedAt: new Date().toISOString(),
  };

  if (!hasDatabaseUrl) {
    result.db = "no DATABASE_URL set in this environment";
    return NextResponse.json(result, { status: 200 });
  }

  try {
    await ensureSchema();
    const rows = await db.execute<{ count: number }>(
      sql`SELECT count(*)::int AS count FROM players`,
    );
    // neon-http returns an array-like result; normalize the first row.
    const first = Array.isArray(rows) ? rows[0] : (rows as { rows?: unknown[] }).rows?.[0];
    result.db = "connected";
    result.playerCount = (first as { count?: number })?.count ?? 0;
    result.tablesReady = true;
  } catch (err) {
    result.db = "error";
    result.error = err instanceof Error ? err.message : String(err);
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result, { status: 200 });
}
