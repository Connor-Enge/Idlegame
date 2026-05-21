import { NextResponse } from "next/server";
import { registerUser, validateCredentials } from "@/lib/auth/users";
import { createSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { email = "", password = "" } = body;
  const invalid = validateCredentials(email, password);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  try {
    const user = await registerUser(email, password);
    const token = await createSession(user.id);
    const res = NextResponse.json({ user });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Registration failed";
    const status = msg.includes("already exists") ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
