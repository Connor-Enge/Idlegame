"use client";

import { money } from "@/lib/format";

export default function WagerInput({
  wager,
  setWager,
  cash,
  disabled,
}: {
  wager: number;
  setWager: (n: number) => void;
  cash: number;
  disabled?: boolean;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(Math.floor(cash), Math.floor(n)));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
        <span>Bet amount</span>
        <span>Balance {money(cash)}</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={wager}
          min={1}
          disabled={disabled}
          onChange={(e) => setWager(Math.max(1, Number(e.target.value) || 0))}
          className="w-full rounded-lg bg-white/5 px-3 py-2 text-lg font-bold outline-none disabled:opacity-60"
        />
        <button
          disabled={disabled}
          onClick={() => setWager(Math.max(1, Math.floor(wager / 2)))}
          className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold active:bg-white/20 disabled:opacity-50"
        >
          ½
        </button>
        <button
          disabled={disabled}
          onClick={() => setWager(clamp(wager * 2) || 1)}
          className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold active:bg-white/20 disabled:opacity-50"
        >
          2×
        </button>
        <button
          disabled={disabled}
          onClick={() => setWager(clamp(cash) || 1)}
          className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold active:bg-white/20 disabled:opacity-50"
        >
          Max
        </button>
      </div>
    </div>
  );
}
