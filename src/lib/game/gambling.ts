import type { GambleGame, GambleResult } from "./types";

// House edges are intentionally player-unfriendly long-run — it's the point.
// `luck` gently shifts win probability within a small, capped band so it can
// never make a game +EV for the player.

function luckBand(luck: number): number {
  // luck 0..100 -> up to +0.04 win-prob shift
  return Math.min(0.04, Math.max(0, luck) * 0.0004);
}

export function coinflip(wager: number, luck: number, callHeads: boolean): GambleResult {
  const winProb = 0.48 + luckBand(luck); // <0.5 house edge
  const heads = Math.random() < 0.5;
  const won = (heads === callHeads) && Math.random() < winProb / 0.5;
  const payout = won ? wager * 2 : 0;
  return {
    game: "coinflip",
    wager,
    payout,
    net: payout - wager,
    won,
    detail: `Landed ${heads ? "Heads" : "Tails"} — you called ${callHeads ? "Heads" : "Tails"}`,
  };
}

export function dice(wager: number, luck: number, target: number): GambleResult {
  // Roll under `target` (2..12) on 2d6. Payout scales with difficulty.
  const roll = 1 + Math.floor(Math.random() * 6) + (1 + Math.floor(Math.random() * 6));
  const baseWin = roll < target;
  const won = baseWin && Math.random() < 0.93 + luckBand(luck); // shave edge
  const odds = oddsUnder(target);
  const payout = won ? Math.floor(wager * (1 / odds) * 0.92) : 0; // 8% house cut
  return {
    game: "dice",
    wager,
    payout,
    net: payout - wager,
    won,
    detail: `Rolled ${roll}, needed under ${target}`,
  };
}

export function slots(wager: number, luck: number): GambleResult {
  const symbols = ["🍒", "🍋", "🔔", "⭐", "7️⃣"];
  const reels = [0, 0, 0].map(() => symbols[Math.floor(Math.random() * symbols.length)]);
  const allSame = reels[0] === reels[1] && reels[1] === reels[2];
  const twoSame = reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2];
  let mult = 0;
  if (allSame) mult = reels[0] === "7️⃣" ? 50 : 12;
  else if (twoSame) mult = 1.5;
  // luck barely nudges a re-roll of one losing reel
  if (mult === 0 && Math.random() < luckBand(luck) * 2) mult = 1.5;
  const payout = Math.floor(wager * mult);
  return {
    game: "slots",
    wager,
    payout,
    net: payout - wager,
    won: payout > 0,
    detail: reels.join(" "),
  };
}

export function roulette(
  wager: number,
  luck: number,
  bet: { type: "red" | "black" | "number"; number?: number },
): GambleResult {
  const pocket = Math.floor(Math.random() * 37); // 0..36, 0 is house (green)
  const isRed = RED_POCKETS.has(pocket);
  let won = false;
  let mult = 0;
  if (bet.type === "number") {
    won = pocket === bet.number;
    mult = 36;
  } else {
    won = pocket !== 0 && (bet.type === "red" ? isRed : !isRed);
    mult = 2;
  }
  // luck only matters on the green-zero coin-toss edge
  if (!won && pocket === 0 && Math.random() < luckBand(luck) * 3) {
    won = true;
    mult = bet.type === "number" ? 36 : 2;
  }
  const payout = won ? wager * mult : 0;
  return {
    game: "roulette",
    wager,
    payout,
    net: payout - wager,
    won,
    detail: `Ball in ${pocket}${pocket === 0 ? " (green)" : isRed ? " (red)" : " (black)"}`,
  };
}

const RED_POCKETS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

function oddsUnder(target: number): number {
  // probability that 2d6 < target
  let count = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b < target) count++;
  return Math.max(0.01, count / 36);
}

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
      return dice(wager, luck, (opts.target as number) ?? 7);
    case "slots":
      return slots(wager, luck);
    case "roulette":
      return roulette(wager, luck, (opts.bet as { type: "red" | "black" | "number"; number?: number }) ?? { type: "red" });
    default:
      return slots(wager, luck);
  }
}
