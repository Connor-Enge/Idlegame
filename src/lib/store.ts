"use client";

import { create } from "zustand";
import * as actions from "@/lib/game/actions";
import { advance, createInitialState } from "@/lib/game/engine";
import type { GambleResult, GameState } from "@/lib/game/types";

const LS_KEY = "gp:save";
const LS_PLAYER = "gp:playerId";
const TICK_INTERVAL_MS = 1000;
const SAVE_INTERVAL_MS = 15000;
const MAX_OFFLINE_TICKS = 8 * 60 * 60; // cap offline progress at 8h

function getPlayerId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem(LS_PLAYER);
  if (!id) {
    id = "p_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(LS_PLAYER, id);
  }
  return id;
}

interface GameStore {
  state: GameState | null;
  toast: string | null;
  lastGamble: GambleResult | null;
  ticking: boolean;

  init: () => void;
  setState: (s: GameState) => void;
  run: (result: actions.ActionResult) => void;
  tick: () => void;
  save: () => Promise<void>;
  setToast: (msg: string | null) => void;
}

let tickTimer: ReturnType<typeof setInterval> | null = null;
let saveTimer: ReturnType<typeof setInterval> | null = null;

export const useGame = create<GameStore>((set, get) => ({
  state: null,
  toast: null,
  lastGamble: null,
  ticking: false,

  init: () => {
    if (get().state) return;
    const playerId = getPlayerId();
    let state: GameState | null = null;

    // 1. Hydrate from localStorage for instant play.
    const raw = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
    if (raw) {
      try {
        state = JSON.parse(raw) as GameState;
      } catch {
        state = null;
      }
    }
    if (!state) state = createInitialState(playerId);

    // 2. Apply offline progress based on elapsed real time.
    const elapsedMs = Date.now() - (state.stats.lastTick || Date.now());
    const offlineTicks = Math.min(MAX_OFFLINE_TICKS, Math.floor(elapsedMs / TICK_INTERVAL_MS));
    if (offlineTicks > 0) state = advance(state, offlineTicks);

    set({ state });

    // 3. Pull authoritative server save in the background (cross-device).
    fetch(`/api/state?playerId=${encodeURIComponent(playerId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.state && data.state.stats.netWorth > (get().state?.stats.netWorth ?? 0)) {
          set({ state: data.state });
        }
      })
      .catch(() => {});

    // 4. Start loops.
    if (!tickTimer) tickTimer = setInterval(() => get().tick(), TICK_INTERVAL_MS);
    if (!saveTimer) saveTimer = setInterval(() => get().save(), SAVE_INTERVAL_MS);
    set({ ticking: true });
  },

  setState: (s) => set({ state: s }),

  run: (result) => {
    set({ state: result.state, toast: result.message, lastGamble: result.gamble ?? get().lastGamble });
    persistLocal(result.state);
  },

  tick: () => {
    const s = get().state;
    if (!s) return;
    const next = advance(s, 1);
    set({ state: next });
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
}));

function persistLocal(s: GameState) {
  if (typeof window !== "undefined") localStorage.setItem(LS_KEY, JSON.stringify(s));
}

// Re-export action creators bound to the store for ergonomic use in components.
export const gameActions = actions;
