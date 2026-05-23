import { sql } from "drizzle-orm";
import {
  bigint,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { GameState } from "@/lib/game/types";

// One row per player. The full game save lives in `state` (JSONB) for fast
// iteration; cash / net worth are denormalized into columns so we can build
// leaderboards and query without deserializing every save.
export const players = pgTable(
  "players",
  {
    id: text("id").primaryKey(),
    displayName: text("display_name"),
    cash: doublePrecision("cash").notNull().default(0),
    netWorth: doublePrecision("net_worth").notNull().default(0),
    // Lifetime high-water mark for net worth. `net_worth` is overwritten every
    // save (and resets on death/prestige), so the leaderboard ranks by this
    // monotonically-increasing column instead.
    peakNetWorth: doublePrecision("peak_net_worth").notNull().default(0),
    state: jsonb("state").$type<GameState>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    netWorthIdx: index("players_net_worth_idx").on(t.netWorth),
    peakIdx: index("players_peak_net_worth_idx").on(t.peakNetWorth),
  }),
);

// Optional append-only log of notable game events (big wins, promotions,
// market crashes the player lived through) for an activity feed.
export const events = pgTable(
  "events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    playerId: text("player_id").notNull(),
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    playerIdx: index("events_player_idx").on(t.playerId),
  }),
);

// Registered accounts. A user's id doubles as their player save id, so a
// player row keyed by the same id holds their game state.
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  salt: text("salt").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PlayerRow = typeof players.$inferSelect;
export type NewPlayerRow = typeof players.$inferInsert;
export type UserRow = typeof users.$inferSelect;
