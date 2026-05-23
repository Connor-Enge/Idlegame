"use client";

import { create } from "zustand";
import * as actions from "@/lib/game/actions";
import { evaluateAchievements } from "@/lib/game/achievements";
import { advance, createInitialState, normalizeState } from "@/lib/game/engine";
import type { Achievement, GameState, OfflineReport } from "@/lib/game/types";

const LS_KEY = "gp:save";
const LS_PLAYER = "gp:playerId";
const TICK_INTERVAL_MS = 1000;
const MARKET_SYNC_MS = 1000; // pull the shared market every tick
const SAVE_INTERVAL_MS = 15000;
const MAX_OFFLINE_TICKS = 8 * 60 * 60; // cap offline progress at 8h
const OFFLINE_MIN_TICKS = 60; // only show a report after ~1 min away

export interface Account {
  id: string;
  email: string;
}

function newAnonId(): string {
  return "p_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// "Most progressed" comparator used when reconciling local vs server saves.
// Net worth alone is wrong for a prestige game — a freshly-reborn life with
// $500 cash and 5 legacy points is MORE progress than the same player's
// pre-death save with $1M and zero legacy. Sort by (legacy, retirements,
// netWorth) so post-prestige state always wins reconciliation.
function progressScore(s: GameState | null | undefined): number {
  if (!s) return -1;
  const legacy = s.progression?.legacyPoints ?? 0;
  const reborn = s.progression?.retirements ?? 0;
  const nw = s.stats?.netWorth ?? 0;
  return legacy * 1e12 + reborn * 1e9 + nw;
}

function getStoredPlayerId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem(LS_PLAYER);
  if (!id) {
    id = newAnonId();
    localStorage.setItem(LS_PLAYER, id);
  }
  return id;
}

function loadLocal(): GameState | null {
  const raw = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
  if (!raw) return null;
  try {
    return normalizeState(JSON.parse(raw) as GameState);
  } catch {
    return null;
  }
}

// Apply elapsed real-time as offline ticks and summarize what was earned.
function applyOffline(state: GameState): { state: GameState; report: OfflineReport | null } {
  const elapsedMs = Date.now() - (state.stats.lastTick || Date.now());
  const ticks = Math.min(MAX_OFFLINE_TICKS, Math.floor(elapsedMs / TICK_INTERVAL_MS));
  if (ticks <= 0) return { state, report: null };

  const before = {
    cash: state.stats.cash,
    netWorth: state.stats.netWorth,
    xp: state.progression.xp,
    level: state.progression.level,
  };
  const next = advance(state, ticks);
  const report: OfflineReport | null =
    ticks >= OFFLINE_MIN_TICKS
      ? {
          ticks,
          cash: next.stats.cash - before.cash,
          netWorth: next.stats.netWorth - before.netWorth,
          xp: next.progression.xp - before.xp + (next.progression.level - before.level) * 1000,
          levels: next.progression.level - before.level,
        }
      : null;
  return { state: next, report };
}

interface GameStore {
  state: GameState | null;
  account: Account | null;
  toast: string | null;
  lastGamble: actions.ActionResult["gamble"] | null;
  offlineReport: OfflineReport | null;
  recentAchievement: Achievement | null;
  ticking: boolean;

  init: () => void;
  setState: (s: GameState) => void;
  run: (result: actions.ActionResult, opts?: { silent?: boolean }) => void;
  tick: () => void;
  save: () => Promise<void>;
  setToast: (msg: string | null) => void;
  dismissOffline: () => void;
  dismissAchievement: () => void;
  dismissDeath: () => void;
  applyAuth: (account: Account | null) => Promise<void>;
  resetGame: () => Promise<void>;
}

let tickTimer: ReturnType<typeof setInterval> | null = null;
let saveTimer: ReturnType<typeof setInterval> | null = null;
let marketTimer: ReturnType<typeof setInterval> | null = null;

// Pull the shared market (prices + economy + history) from the server. Every
// connected client polls the same endpoint, so everyone sees identical prices.
// If holdings reference an asset that's been replaced (bankruptcy → new IPO),
// the stale holding is dropped so the portfolio doesn't carry zombie shares.
async function syncMarket(): Promise<void> {
  try {
    const res = await fetch("/api/market", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const cur = useGame.getState().state;
    if (!cur) return;
    const ids = new Set<string>(data.assets.map((a: { id: string }) => a.id));
    const holdings = cur.holdings.filter((h) => ids.has(h.assetId));
    useGame.setState({
      state: { ...cur, assets: data.assets, economy: data.economy, holdings },
    });
  } catch {
    // network blip — try again next interval
  }
}

export const useGame = create<GameStore>((set, get) => ({
  state: null,
  account: null,
  toast: null,
  lastGamble: null,
  offlineReport: null,
  recentAchievement: null,
  ticking: false,

  init: () => {
    if (get().state) return;
    const playerId = getStoredPlayerId();

    let state = loadLocal() ?? createInitialState(playerId);
    if (state.playerId !== playerId) state.playerId = playerId;

    const { state: withOffline, report } = applyOffline(state);
    state = withOffline;

    set({ state, offlineReport: report });

    // Background: reconcile with the authoritative server save.
    fetch(`/api/state?playerId=${encodeURIComponent(playerId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const cur = get().state;
        if (data?.state && progressScore(data.state) > progressScore(cur)) {
          set({ state: normalizeState(data.state) });
        }
      })
      .catch(() => {});

    // Background: check for an existing logged-in session.
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) get().applyAuth(data.user);
      })
      .catch(() => {});

    // Pull the market once immediately so the first frame shows live prices,
    // then keep polling on the tick interval.
    syncMarket();
    if (!marketTimer) marketTimer = setInterval(syncMarket, MARKET_SYNC_MS);
    if (!tickTimer) tickTimer = setInterval(() => get().tick(), TICK_INTERVAL_MS);
    if (!saveTimer) saveTimer = setInterval(() => get().save(), SAVE_INTERVAL_MS);
    set({ ticking: true });
  },

  setState: (s) => set({ state: s }),

  run: (result, opts) => {
    const prev = get().state;
    const newly = evaluateAchievements(result.state);
    // Casino games render their own in-view result, so they commit silently —
    // only achievement toasts still surface. Other actions keep their toast.
    set({
      state: result.state,
      toast: newly[0] ? `🏆 ${newly[0].name}` : opts?.silent ? null : result.message,
      lastGamble: result.gamble ?? get().lastGamble,
      recentAchievement: newly[0] ?? get().recentAchievement,
    });
    persistLocal(result.state);
    // Prestige action just fired (retirements bumped). Force a server save so
    // the new life can't get clobbered by a reload reading stale server state.
    if ((result.state.progression.retirements ?? 0) > (prev?.progression.retirements ?? 0)) {
      void get().save();
    }
  },

  tick: () => {
    const s = get().state;
    if (!s) return;
    const next = advance(s, 1);
    // Death just happened (retirements counter ticked up this frame): force
    // an immediate server save so a refresh in the next few seconds can't
    // resurrect the previous life from a stale server snapshot.
    if (next.progression.retirements > s.progression.retirements) {
      void get().save();
    }
    const newly = evaluateAchievements(next);
    set({
      state: next,
      ...(newly[0] ? { toast: `🏆 ${newly[0].name}`, recentAchievement: newly[0] } : {}),
    });
    persistLocal(next);
  },

  save: async () => {
    const s = get().state;
    if (!s) return;
    persistLocal(s);
    try {
      await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: s }),
      });
    } catch {
      // offline — localStorage already has it.
    }
  },

  setToast: (msg) => set({ toast: msg }),
  dismissOffline: () => set({ offlineReport: null }),
  dismissAchievement: () => set({ recentAchievement: null }),

  // Acknowledge a death recap: clear the report so the modal closes. The new
  // life (legacy credits, generation bump) is already live in state.
  dismissDeath: () => {
    const s = get().state;
    if (!s) return;
    const next = { ...s, life: { ...s.life, deathReport: null } };
    set({ state: next });
    persistLocal(next);
  },

  // Hard reset: wipe all progress (including prestige) back to a fresh start,
  // keeping the same player/account id so the server save is overwritten.
  // Distinct from retire(), which keeps Legacy Points.
  resetGame: async () => {
    const playerId = get().state?.playerId ?? getStoredPlayerId();
    const fresh = createInitialState(playerId);
    set({ state: fresh, offlineReport: null, recentAchievement: null, lastGamble: null, toast: "Progress reset" });
    persistLocal(fresh);
    await get().save();
  },

  // Reconcile local play with a logged-in account (or reset on logout).
  applyAuth: async (account) => {
    if (!account) {
      // Logout: start a fresh anonymous identity so the next user is isolated.
      const id = newAnonId();
      if (typeof window !== "undefined") {
        localStorage.setItem(LS_PLAYER, id);
        localStorage.removeItem(LS_KEY);
      }
      const fresh = createInitialState(id);
      set({ account: null, state: fresh, offlineReport: null });
      persistLocal(fresh);
      return;
    }

    set({ account });
    if (typeof window !== "undefined") localStorage.setItem(LS_PLAYER, account.id);

    const local = get().state;
    let serverState: GameState | null = null;
    try {
      const r = await fetch(`/api/state?playerId=${encodeURIComponent(account.id)}`);
      if (r.ok) serverState = normalizeState((await r.json()).state);
    } catch {
      /* offline */
    }

    // Adopt whichever save has more progress; migrate local anon progress up.
    let chosen: GameState;
    if (serverState && local && progressScore(serverState) >= progressScore(local)) {
      chosen = serverState;
    } else if (local) {
      chosen = { ...local, playerId: account.id };
    } else {
      chosen = serverState ?? createInitialState(account.id);
    }
    chosen.playerId = account.id;
    set({ state: chosen });
    persistLocal(chosen);
    get().save();
  },
}));

function persistLocal(s: GameState) {
  if (typeof window !== "undefined") localStorage.setItem(LS_KEY, JSON.stringify(s));
}

export const gameActions = actions;
