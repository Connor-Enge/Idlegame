import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const uid = await verifySession(token);
  if (!uid) return NextResponse.json({ user: null });

  try {
    const rows = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, uid)).limit(1);
    return NextResponse.json({ user: rows[0] ?? null });
  } catch {
    return NextResponse.json({ user: null });
  }
}
