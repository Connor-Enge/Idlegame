import { sql } from "drizzle-orm";
import { db } from "./index";

// Idempotent schema bootstrap. Runs once per serverless instance the first time
// the DB is touched, so the deployed app provisions its own tables without a
// separate migration step (handy when you can't run `drizzle-kit push` locally).
// Mirrors drizzle/0000_*.sql — keep in sync, or switch to real migrations later.
let ensured: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!ensured) ensured = run();
  return ensured;
}

async function run(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "players" (
      "id" text PRIMARY KEY NOT NULL,
      "display_name" text,
      "cash" double precision DEFAULT 0 NOT NULL,
      "net_worth" double precision DEFAULT 0 NOT NULL,
      "state" jsonb NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "events" (
      "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "player_id" text NOT NULL,
      "kind" text NOT NULL,
      "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "users" (
      "id" text PRIMARY KEY NOT NULL,
      "email" text NOT NULL UNIQUE,
      "password_hash" text NOT NULL,
      "salt" text NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "players_net_worth_idx" ON "players" USING btree ("net_worth")`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "events_player_idx" ON "events" USING btree ("player_id")`);
}
