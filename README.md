# Gambler's Paradise

An incremental, **mobile-only** web game. Start broke, then gamble, take jobs and
climb the corporate ladder, invest in a simulated global economy, buy and rent
real estate, and build a business empire.

Built with **Next.js (App Router) + TypeScript + Tailwind CSS v4**, persisted to
**Neon Postgres** via **Drizzle ORM**, and deployed on **Vercel**.

## Features (scaffolded)

| Area | Where | What's in |
| --- | --- | --- |
| 🎰 Gambling | `/gambling` | Coin flip, dice, slots, roulette — each with a built-in house edge |
| 💼 Career | `/jobs` | Timed shift mini-game, 6 trainable skills, side gigs, projects, raises, perks, education, the corporate ladder |
| 📈 Investing | `/invest` | Stocks, crypto, commodities, bonds priced live by the economy |
| 🌍 Global economy | `/economy` | Business-cycle phases, macro indicators, random events |
| 🏘️ Real estate | `/realestate` | Buy with cash or mortgage, rent out, value drifts with the market |
| 🏢 Business | `/business` | Found, upgrade, staff and market income-generating businesses |

The game runs a 1-second tick loop client-side (with capped offline progress),
saves to `localStorage` instantly, and syncs to Neon every 15s for cross-device
play.

## Architecture

```
src/
  app/                 # routes (one folder per feature) + API routes
    api/state          # GET/POST player save
    api/leaderboard    # net-worth leaderboard
  components/          # MobileShell, StatBar, BottomNav, Toast, ui primitives
  lib/
    game/
      types.ts         # all domain types
      data.ts          # static content (jobs, assets, properties, businesses)
      economy.ts       # macro simulation + asset pricing
      gambling.ts      # casino games
      engine.ts        # the per-tick simulation + net worth
      actions.ts       # pure state transitions for every player action
    db/                # Neon client, Drizzle schema, player persistence
    store.ts           # Zustand client store + tick/save loops
```

Game logic in `lib/game` is framework-agnostic and side-effect-free, so it can
run client-side, in API routes, or in a future authoritative server tick.

## Local development

```bash
npm install
cp .env.example .env        # then fill in DATABASE_URL
npm run db:push             # create tables in Neon
npm run dev                 # http://localhost:3000
```

> Tip: open dev tools, toggle device toolbar, and pick a phone — it's mobile-only.

## Connecting Neon (database)

1. Create a project at <https://neon.tech> (or add Neon from the Vercel
   Marketplace — see below, which wires the env vars for you).
2. Copy the **pooled** connection string into `DATABASE_URL` in `.env`.
3. Push the schema: `npm run db:push` (or generate + migrate with
   `npm run db:generate && npm run db:migrate`).
4. Inspect data with `npm run db:studio`.

## Connecting Vercel (deploy) + GitHub

1. Push this repo to GitHub (this branch is `claude/scaffold-gamblers-paradise-1x1BC`).
2. At <https://vercel.com/new>, **Import** the GitHub repo. Vercel auto-detects
   Next.js — no build config needed (`vercel.json` is included).
3. In the Vercel project, go to **Storage → Create / Connect → Neon**. This
   provisions (or links) a Neon database and injects `DATABASE_URL` into all
   environments automatically.
4. Redeploy. On first run the app creates tables lazily is *not* automatic —
   run migrations once against the production DB:
   `DATABASE_URL=<prod-url> npm run db:push`.
5. Every push to the connected branch triggers a Vercel deployment.

> The Vercel ↔ GitHub ↔ Neon wiring requires your own accounts and cannot be
> provisioned from this repo alone. The steps above are the full checklist.

## Accounts

Email + password accounts (no third-party provider needed) let a save follow a
player across devices. Sessions are signed cookies (HMAC via Web Crypto);
passwords are PBKDF2-hashed. Set `AUTH_SECRET` in the environment for secure,
stable sessions — in Vercel, add it under Settings → Environment Variables.
Anonymous play still works without an account (saved per-browser); registering
claims that progress.

## Roadmap / next steps

- OAuth providers (Google/Apple) on top of the email/password base.
- Server-authoritative ticks (cron) so progress can't be edited client-side.
- Leaderboard UI + activity feed (the `events` table is already scaffolded).
- Blackjack and live multiplayer tables.
- Store money as integer cents (or bigint) before any real balance matters.
