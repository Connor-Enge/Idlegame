import { desc, eq } from "drizzle-orm";
import { db } from "./index";
import { players } from "./schema";
import { createInitialState } from "@/lib/game/engine";
import type { GameState } from "@/lib/game/types";

export async function loadOrCreatePlayer(playerId: string): Promise<GameState> {
  const rows = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (rows.length > 0) return rows[0].state;

  const state = createInitialState(playerId);
  await db.insert(players).values({
    id: playerId,
    cash: state.stats.cash,
    netWorth: state.stats.netWorth,
    state,
  });
  return state;
}

export async function savePlayer(state: GameState): Promise<void> {
  await db
    .insert(players)
    .values({
      id: state.playerId,
      cash: state.stats.cash,
      netWorth: state.stats.netWorth,
      state,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: players.id,
      set: {
        cash: state.stats.cash,
        netWorth: state.stats.netWorth,
        state,
        updatedAt: new Date(),
      },
    });
}

export async function leaderboard(limit = 25) {
  return db
    .select({
      id: players.id,
      displayName: players.displayName,
      netWorth: players.netWorth,
      cash: players.cash,
    })
    .from(players)
    .orderBy(desc(players.netWorth))
    .limit(limit);
}
