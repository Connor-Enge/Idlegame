"use client";

import { useState } from "react";
import { SLOT_GAMES, SLOT_THEMES } from "@/lib/game/slots/games";
import SlotMachine from "./SlotMachine";

export default function SlotsHub() {
  const [openId, setOpenId] = useState<string | null>(null);
  const game = SLOT_GAMES.find((g) => g.id === openId) ?? null;

  if (game) {
    return (
      <div className="space-y-3">
        <button onClick={() => setOpenId(null)} className="text-sm text-muted active:text-white">
          ← Slots lobby
        </button>
        <SlotMachine game={game} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">Ten machines, each its own style. Tap to play.</p>
      <div className="grid grid-cols-2 gap-3">
        {SLOT_GAMES.map((g) => {
          const t = SLOT_THEMES[g.id];
          return (
            <button
              key={g.id}
              onClick={() => setOpenId(g.id)}
              className="overflow-hidden rounded-xl text-left active:scale-[0.98]"
              style={{ background: t.pageBg }}
            >
              <div className="flex items-center justify-between px-3 pt-3">
                <span className="text-3xl">{g.icon}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                  style={{ background: t.accent, color: t.accentText }}
                >
                  {g.style}
                </span>
              </div>
              <div className="px-3 pb-3 pt-2">
                <div className="text-sm font-black leading-tight text-white">{g.name}</div>
                <div className="mt-0.5 text-[10px] text-white/60">{g.blurb}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
