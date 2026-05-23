import { desc, eq, sql } from "drizzle-orm";
import { db } from "./index";
import { ensureSchema } from "./ensure";
import { players, users } from "./schema";
import { createInitialState } from "@/lib/game/engine";
import type { GameState } from "@/lib/game/types";

export async function loadOrCreatePlayer(playerId: string): Promise<GameState> {
  await ensureSchema();
  const rows = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (rows.length > 0) return rows[0].state;

  const state = createInitialState(playerId);
  await db.insert(players).values({
    id: playerId,
    cash: state.stats.cash,
    netWorth: state.stats.netWorth,
    peakNetWorth: state.stats.netWorth,
    state,
  });
  return state;
}

export async function savePlayer(state: GameState): Promise<void> {
  await ensureSchema();
  const nw = state.stats.netWorth;
  await db
    .insert(players)
    .values({
      id: state.playerId,
      cash: state.stats.cash,
      netWorth: nw,
      peakNetWorth: nw,
      state,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: players.id,
      set: {
        cash: state.stats.cash,
        netWorth: nw,
        // peak only ever climbs — death / prestige resets net_worth but the
        // best you've ever reached stays on record for the leaderboard.
        peakNetWorth: sql`GREATEST(${players.peakNetWorth}, ${nw})`,
        state,
        updatedAt: new Date(),
      },
    });
}

// Leaderboard rows: registered users only (anonymous players have no
// username to display), ordered by their all-time peak net worth.
export async function leaderboard(limit = 25) {
  await ensureSchema();
  return db
    .select({
      id: players.id,
      email: users.email,
      peakNetWorth: players.peakNetWorth,
      netWorth: players.netWorth,
    })
    .from(players)
    .innerJoin(users, eq(users.id, players.id))
    .orderBy(desc(players.peakNetWorth))
    .limit(limit);
}
