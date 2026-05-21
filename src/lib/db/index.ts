import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Neon's HTTP driver is serverless-friendly (no persistent socket), which is
// ideal for Vercel functions. DATABASE_URL should be the *pooled* connection
// string from Neon / the Vercel-Neon integration.
//
// The client is created lazily so that importing this module during the build
// (page-data collection) doesn't require a real connection string.
let _db: NeonHttpDatabase<typeof schema> | null = null;

function getDb(): NeonHttpDatabase<typeof schema> {
  if (_db) return _db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add your Neon pooled connection string to the environment.",
    );
  }
  _db = drizzle(neon(connectionString), { schema });
  return _db;
}

// Proxy so callers can keep using `db.select()` etc. while construction stays lazy.
export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
