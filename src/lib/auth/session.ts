// Auth primitives built on the Web Crypto API only — no native modules, so it
// runs on Vercel's Node runtime without extra dependencies.
//
// Set AUTH_SECRET in the environment for stable, secure sessions. The fallback
// keeps local/dev working but is NOT safe for production.
const SECRET = process.env.AUTH_SECRET || "dev-insecure-secret-change-me";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_COOKIE = "gp_session";

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return new Uint8Array(sig);
}

// ---- Sessions (signed token, stored in an httpOnly cookie) ----

export async function createSession(userId: string): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ uid: userId, exp: Date.now() + SESSION_TTL_MS })));
  const sig = b64url(await hmac(payload));
  return `${payload}.${sig}`;
}

export async function verifySession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = b64url(await hmac(payload));
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as { uid: string; exp: number };
    if (Date.now() > data.exp) return null;
    return data.uid;
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = Math.floor(SESSION_TTL_MS / 1000);

// ---- Password hashing (PBKDF2-SHA256) ----

export async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltHex ? fromB64url(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 120_000, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return { hash: toHex(new Uint8Array(bits)), salt: b64url(salt) };
}

export async function verifyPassword(password: string, saltHex: string, expectedHash: string): Promise<boolean> {
  const { hash } = await hashPassword(password, saltHex);
  return timingSafeEqual(hash, expectedHash);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
