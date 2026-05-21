"use client";

import { useRef, useState } from "react";
import { useGame } from "@/lib/store";
import { commitGamble } from "@/lib/game/actions";
import {
  freshShoe,
  handValue,
  isBlackjack,
  isBust,
  dealerShouldHit,
  settle,
  payoutMultiplier,
  type BlackjackOutcome,
  type Card,
} from "@/lib/game/blackjack";
import { money } from "@/lib/format";
import { Button } from "@/components/ui";
import WagerInput from "./WagerInput";

type Phase = "bet" | "player" | "dealer" | "done";

export default function Blackjack() {
  const state = useGame((s) => s.state)!;
  const run = useGame((s) => s.run);
  const [wager, setWager] = useState(50);
  const [phase, setPhase] = useState<Phase>("bet");
  const [player, setPlayer] = useState<Card[]>([]);
  const [dealer, setDealer] = useState<Card[]>([]);
  const [hideHole, setHideHole] = useState(true);
  const [doubled, setDoubled] = useState(false);
  const [outcome, setOutcome] = useState<BlackjackOutcome | null>(null);
  const shoe = useRef<Card[]>([]);

  const cash = state.stats.cash;

  function draw(): Card {
    if (shoe.current.length < 15) shoe.current = freshShoe(4);
    return shoe.current.pop()!;
  }

  function deal() {
    if (wager <= 0 || wager > cash) return;
    if (shoe.current.length < 15) shoe.current = freshShoe(4);
    const p = [draw(), draw()];
    const d = [draw(), draw()];
    setPlayer(p);
    setDealer(d);
    setHideHole(true);
    setDoubled(false);
    setOutcome(null);
    if (isBlackjack(p) || isBlackjack(d)) {
      finish(p, d, wager);
    } else {
      setPhase("player");
    }
  }

  function hit() {
    if (phase !== "player") return;
    const p = [...player, draw()];
    setPlayer(p);
    if (isBust(p)) finish(p, dealer, doubled ? wager * 2 : wager);
  }

  function stand() {
    if (phase !== "player") return;
    dealerTurn(player, doubled ? wager * 2 : wager);
  }

  function double() {
    if (phase !== "player" || player.length !== 2) return;
    const staked = wager * 2;
    if (staked > cash) return;
    setDoubled(true);
    const p = [...player, draw()];
    setPlayer(p);
    if (isBust(p)) finish(p, dealer, staked);
    else dealerTurn(p, staked);
  }

  function dealerTurn(p: Card[], staked: number) {
    setPhase("dealer");
    setHideHole(false);
    const d = [...dealer];
    while (dealerShouldHit(d)) d.push(draw());
    setDealer(d);
    finish(p, d, staked);
  }

  function finish(p: Card[], d: Card[], staked: number) {
    setHideHole(false);
    const out = settle(p, d);
    setOutcome(out);
    setPhase("done");
    const mult = payoutMultiplier(out);
    const payout = Math.floor(staked * mult);
    run(
      commitGamble(useGame.getState().state!, {
        game: "blackjack",
        wager: staked,
        payout,
        net: payout - staked,
        won: out === "win" || out === "blackjack",
        detail: outcomeLabel(out),
      }),
      { silent: true },
    );
  }

  const pv = handValue(player).total;
  const dv = hideHole ? handValue(dealer.slice(0, 1)).total : handValue(dealer).total;
  const canDouble = phase === "player" && player.length === 2 && wager * 2 <= cash;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-emerald-900/40 to-black/40 p-4">
        {/* Dealer */}
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
            <span>Dealer</span>
            <span>{phase === "bet" ? "" : dv}</span>
          </div>
          <Hand cards={dealer} hideHole={hideHole} placeholder={phase === "bet"} />
        </div>
        {/* Player */}
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
            <span>You {doubled && "(doubled)"}</span>
            <span>{phase === "bet" ? "" : pv}</span>
          </div>
          <Hand cards={player} placeholder={phase === "bet"} />
        </div>
      </div>

      {phase === "done" && outcome && (
        <div
          className={`rounded-xl border p-3 text-center ${
            outcome === "win" || outcome === "blackjack"
              ? "border-accent-2/50 flash-win"
              : outcome === "push"
                ? "border-white/20"
                : "border-danger/50"
          }`}
        >
          <span
            className={`text-lg font-bold ${
              outcome === "win" || outcome === "blackjack"
                ? "text-accent-2"
                : outcome === "push"
                  ? "text-white"
                  : "text-danger"
            }`}
          >
            {outcomeLabel(outcome)}
          </span>
        </div>
      )}

      {phase === "bet" || phase === "done" ? (
        <>
          <WagerInput wager={wager} setWager={setWager} cash={cash} />
          <Button className="w-full" disabled={wager > cash || wager <= 0} onClick={deal}>
            Deal ({money(wager)})
          </Button>
        </>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <Button variant="secondary" disabled={phase !== "player"} onClick={hit}>
            Hit
          </Button>
          <Button variant="secondary" disabled={phase !== "player"} onClick={stand}>
            Stand
          </Button>
          <Button variant="secondary" disabled={!canDouble} onClick={double}>
            Double
          </Button>
        </div>
      )}
      <div className="text-center text-[11px] text-muted">Blackjack pays 3:2 · dealer stands on 17</div>
    </div>
  );
}

function outcomeLabel(o: BlackjackOutcome): string {
  return o === "blackjack" ? "Blackjack! 🎉" : o === "win" ? "You win" : o === "push" ? "Push" : "Dealer wins";
}

function Hand({ cards, hideHole, placeholder }: { cards: Card[]; hideHole?: boolean; placeholder?: boolean }) {
  if (placeholder || cards.length === 0) {
    return (
      <div className="flex gap-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-20 w-14 rounded-lg border border-dashed border-white/15" />
        ))}
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      {cards.map((c, i) => (
        <CardView key={i} card={c} faceDown={hideHole && i === 1} delay={i * 0.08} />
      ))}
    </div>
  );
}

function CardView({ card, faceDown, delay }: { card: Card; faceDown?: boolean; delay: number }) {
  const red = card.suit === "♥" || card.suit === "♦";
  if (faceDown) {
    return (
      <div
        className="card-deal flex h-20 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-700 to-indigo-900 text-xl"
        style={{ animationDelay: `${delay}s` }}
      >
        🂠
      </div>
    );
  }
  return (
    <div
      className="card-deal flex h-20 w-14 flex-col justify-between rounded-lg bg-white p-1.5 shadow"
      style={{ animationDelay: `${delay}s` }}
    >
      <span className={`text-sm font-bold leading-none ${red ? "text-red-600" : "text-black"}`}>{card.rank}</span>
      <span className={`self-center text-2xl leading-none ${red ? "text-red-600" : "text-black"}`}>{card.suit}</span>
      <span className={`self-end text-sm font-bold leading-none ${red ? "text-red-600" : "text-black"}`}>{card.rank}</span>
    </div>
  );
}
