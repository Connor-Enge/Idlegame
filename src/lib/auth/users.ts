import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/ensure";
import { users } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "./session";

export interface PublicUser {
  id: string;
  email: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCredentials(email: string, password: string): string | null {
  if (!email || !EMAIL_RE.test(email)) return "Enter a valid email";
  if (!password || password.length < 8) return "Password must be at least 8 characters";
  return null;
}

export async function registerUser(email: string, password: string): Promise<PublicUser> {
  await ensureSchema();
  const normalized = email.trim().toLowerCase();
  const existing = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  if (existing.length > 0) throw new Error("An account with that email already exists");

  const { hash, salt } = await hashPassword(password);
  const id = "u_" + crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  await db.insert(users).values({ id, email: normalized, passwordHash: hash, salt });
  return { id, email: normalized };
}

export async function authenticateUser(email: string, password: string): Promise<PublicUser> {
  await ensureSchema();
  const normalized = email.trim().toLowerCase();
  const rows = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  const user = rows[0];
  if (!user) throw new Error("Invalid email or password");
  const ok = await verifyPassword(password, user.salt, user.passwordHash);
  if (!ok) throw new Error("Invalid email or password");
  return { id: user.id, email: user.email };
}
