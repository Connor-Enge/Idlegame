import type { GambleGame, GambleResult, RouletteBet } from "./types";

// House edges are intentionally player-unfriendly long-run — it's the point.
// `luck` gently shifts win probability within a small, capped band so it can
// never make a game meaningfully +EV for the player.

function luckBand(luck: number): number {
  return Math.min(0.04, Math.max(0, luck) * 0.0004);
}

// ----------------------------- Coin flip -----------------------------

export function coinflip(wager: number, luck: number, callHeads: boolean): GambleResult {
  const winProb = 0.485 + luckBand(luck); // < 0.5 → house edge
  const won = Math.random() < winProb;
  // The visible face always matches the outcome so the animation can't lie.
  const calledSide: "heads" | "tails" = callHeads ? "heads" : "tails";
  const otherSide: "heads" | "tails" = callHeads ? "tails" : "heads";
  const coin = won ? calledSide : otherSide;
  const payout = won ? Math.floor(wager * 1.96) : 0; // ~2x minus edge
  return {
    game: "coinflip",
    wager,
    payout,
    net: payout - wager,
    won,
    detail: `Landed on ${coin}`,
    outcome: { coin, multiplier: 1.96 },
  };
}

// ------------------------------- Dice --------------------------------
// Stake-style: roll 0.00–100.00, win if roll < target. Fair multiplier is
// 100/target; we shave ~1% for the house.

export const DICE_HOUSE_EDGE = 0.01;

export function diceMultiplier(target: number): number {
  const t = Math.min(98, Math.max(2, target));
  return Math.max(1.01, (100 / t) * (1 - DICE_HOUSE_EDGE));
}

export function dice(wager: number, luck: number, target: number): GambleResult {
  const t = Math.min(98, Math.max(2, target));
  let roll = Math.random() * 100;
  // Luck nudges a near-miss into a win occasionally.
  if (roll >= t && roll - t < 3 && Math.random() < luckBand(luck) * 4) roll = t - 0.01;
  roll = Math.round(roll * 100) / 100;
  const won = roll < t;
  const mult = diceMultiplier(t);
  const payout = won ? Math.floor(wager * mult) : 0;
  return {
    game: "dice",
    wager,
    payout,
    net: payout - wager,
    won,
    detail: `Rolled ${roll.toFixed(2)} (under ${t})`,
    outcome: { diceRoll: roll, target: t, multiplier: mult },
  };
}

// ------------------------------- Slots -------------------------------

export const SLOT_SYMBOLS = ["🍒", "🍋", "🔔", "💎", "7️⃣"] as const;
// Weighted reel: rarer symbols pay more.
const SLOT_WEIGHTS: Record<string, number> = { "🍒": 5, "🍋": 4, "🔔": 3, "💎": 2, "7️⃣": 1 };
const SLOT_PAYOUT: Record<string, number> = { "🍒": 4, "🍋": 8, "🔔": 14, "💎": 30, "7️⃣": 60 };

function spinReel(luck: number): string {
  const entries = Object.entries(SLOT_WEIGHTS);
  // A little luck tilts toward higher symbols.
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [sym, w] of entries) {
    r -= w;
    if (r <= 0) return sym;
  }
  return entries[0][0];
}

export function slots(wager: number, luck: number): GambleResult {
  const reels = [spinReel(luck), spinReel(luck), spinReel(luck)];
  const allSame = reels[0] === reels[1] && reels[1] === reels[2];
  const twoSame = reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2];
  let mult = 0;
  if (allSame) mult = SLOT_PAYOUT[reels[0]];
  else if (twoSame) mult = 1.2;
  const payout = Math.floor(wager * mult);
  return {
    game: "slots",
    wager,
    payout,
    net: payout - wager,
    won: payout > 0,
    detail: reels.join(" "),
    outcome: { reels, multiplier: mult },
  };
}

// ----------------------------- Roulette ------------------------------

export const RED_POCKETS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
// Standard European single-zero wheel order, clockwise from 0.
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14,
  31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

export function pocketColor(n: number): "red" | "black" | "green" {
  if (n === 0) return "green";
  return RED_POCKETS.has(n) ? "red" : "black";
}

function rouletteWins(bet: RouletteBet, pocket: number): { won: boolean; mult: number } {
  if (pocket === 0 && bet.type !== "number") return { won: false, mult: 0 };
  switch (bet.type) {
    case "number":
      return { won: pocket === bet.number, mult: 36 };
    case "red":
      return { won: pocketColor(pocket) === "red", mult: 2 };
    case "black":
      return { won: pocketColor(pocket) === "black", mult: 2 };
    case "even":
      return { won: pocket % 2 === 0, mult: 2 };
    case "odd":
      return { won: pocket % 2 === 1, mult: 2 };
    case "low":
      return { won: pocket >= 1 && pocket <= 18, mult: 2 };
    case "high":
      return { won: pocket >= 19 && pocket <= 36, mult: 2 };
    case "dozen":
      return { won: Math.ceil(pocket / 12) === bet.which, mult: 3 };
    case "column":
      return { won: pocket % 3 === (bet.which === 3 ? 0 : bet.which), mult: 3 };
  }
}

export function roulette(wager: number, luck: number, bet: RouletteBet): GambleResult {
  let pocket = Math.floor(Math.random() * 37);
  // Luck: occasionally re-roll a losing zero on even-money bets.
  if (pocket === 0 && bet.type !== "number" && Math.random() < luckBand(luck) * 3) {
    pocket = 1 + Math.floor(Math.random() * 36);
  }
  const { won, mult } = rouletteWins(bet, pocket);
  const payout = won ? wager * mult : 0;
  return {
    game: "roulette",
    wager,
    payout,
    net: payout - wager,
    won,
    detail: `Ball in ${pocket} (${pocketColor(pocket)})`,
    outcome: { pocket, multiplier: mult },
  };
}

// ----------------------------- Dispatch ------------------------------

export function playGamble(
  game: GambleGame,
  wager: number,
  luck: number,
  opts: Record<string, unknown> = {},
): GambleResult {
  switch (game) {
    case "coinflip":
      return coinflip(wager, luck, (opts.callHeads as boolean) ?? true);
    case "dice":
      return dice(wager, luck, (opts.target as number) ?? 50);
    case "slots":
      return slots(wager, luck);
    case "roulette":
      return roulette(wager, luck, (opts.bet as RouletteBet) ?? { type: "red" });
    default:
      return slots(wager, luck);
  }
}
