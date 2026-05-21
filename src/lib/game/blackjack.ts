// Self-contained blackjack engine. The component drives state; this module is
// pure logic (deck, hand values, dealer policy, settlement).

export interface Card {
  rank: string; // "A","2".."10","J","Q","K"
  suit: "♠" | "♥" | "♦" | "♣";
}

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS: Card["suit"][] = ["♠", "♥", "♦", "♣"];

export function freshShoe(decks = 4): Card[] {
  const shoe: Card[] = [];
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) for (const rank of RANKS) shoe.push({ rank, suit });
  }
  // Fisher–Yates shuffle.
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

export function cardValue(rank: string): number {
  if (rank === "A") return 11;
  if (rank === "K" || rank === "Q" || rank === "J") return 10;
  return parseInt(rank, 10);
}

// Best hand total, demoting aces from 11→1 as needed.
export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c.rank);
    if (c.rank === "A") aces++;
  }
  let soft = aces > 0;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  soft = aces > 0 && total <= 21;
  return { total, soft };
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

export function isBust(cards: Card[]): boolean {
  return handValue(cards).total > 21;
}

// Dealer draws to 17 (stands on soft 17).
export function dealerShouldHit(cards: Card[]): boolean {
  const { total } = handValue(cards);
  return total < 17;
}

export type BlackjackOutcome = "win" | "lose" | "push" | "blackjack";

export function settle(player: Card[], dealer: Card[]): BlackjackOutcome {
  const p = handValue(player).total;
  const d = handValue(dealer).total;
  const pBJ = isBlackjack(player);
  const dBJ = isBlackjack(dealer);
  if (pBJ && dBJ) return "push";
  if (pBJ) return "blackjack";
  if (dBJ) return "lose";
  if (p > 21) return "lose";
  if (d > 21) return "win";
  if (p > d) return "win";
  if (p < d) return "lose";
  return "push";
}

// Payout multiplier on the original wager (total returned, incl. stake).
export function payoutMultiplier(outcome: BlackjackOutcome): number {
  switch (outcome) {
    case "blackjack":
      return 2.5; // 3:2
    case "win":
      return 2;
    case "push":
      return 1;
    case "lose":
      return 0;
  }
}
