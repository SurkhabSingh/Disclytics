# Disclytics

Disclytics is a Discord activity analytics platform for communities that want a clearer view of how members participate inside the servers they actually manage.

The bot tracks activity only in servers where it has been explicitly installed. The web app turns that data into usable analytics such as message trends, voice usage, channel activity patterns, reminder delivery, and server coverage.

## Purpose

Disclytics is built to help server owners, moderators, and engaged members understand:

- who is active in a server over time
- how voice participation changes day to day
- which channels carry the most discussion
- what share of a user's Discord footprint is actually covered by the bot
- when reminders or follow-up nudges should be delivered

This is not a self-bot, scraper, or global Discord tracker. It is a server-scoped analytics system that works within Discord's platform rules.

## What The Platform Includes

- `apps/api`
  - Express API
  - Discord OAuth2 login
  - analytics queries
  - reminder APIs
  - internal ingestion endpoints for bot events
- `apps/bot`
  - `discord.js` bot
  - message tracking
  - voice session tracking
  - slash command support
  - reminder and optional TTS delivery
- `apps/worker`
  - scheduled aggregation and reminder processing
- `apps/web`
  - React dashboard
  - charts, activity log, reminders, and install flow
- `packages/runtime`
  - shared logging, shutdown, and HTTP client utilities
- `packages/shared`
  - shared constants and event types

## Core Product Behavior

1. A user logs in with Discord OAuth2.
2. The API stores the user and the guilds they authorized.
3. The bot is invited into selected servers.
4. The bot captures message and voice activity inside those servers only.
5. The API stores raw events and voice sessions in PostgreSQL.
6. The worker aggregates daily stats and dispatches reminders.
7. The web dashboard shows analytics and coverage clearly.

## Real-World Constraints

Disclytics is intentionally designed around Discord's actual boundaries:

- It cannot track a user's activity across all of Discord.
- It only tracks activity in servers where the bot is present.
- It does not use self-bots or user tokens.
- It cannot see hidden channels unless the bot has permission to view them in that server.
- It cannot reconstruct activity that happened while the bot was offline unless Discord emits enough live state to reconcile safely.

Those constraints are not edge cases. They are part of the product model and should remain visible in the UI and product language.

## Key Features

- Discord OAuth2 authentication
- server coverage tracking
- message ingestion with content and media history
- voice session tracking with restart reconciliation
- daily analytics and channel distribution
- hourly activity heatmap
- reminder scheduling
- slash-command stats for the current server
- optional voice reminder delivery through `@discordjs/voice`
- structured logging and readiness checks

## Data Model

The PostgreSQL schema lives in `apps/api/sql/001_init.sql`.

Main tables:

- `users`
- `guilds`
- `user_guilds`
- `events`
- `voice_sessions`
- `daily_stats`
- `reminders`

## Local Setup

1. Install dependencies from the repo root:

```powershell
npm install
```

2. Create local env files from the examples:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/bot/.env.example apps/bot/.env
Copy-Item apps/worker/.env.example apps/worker/.env
Copy-Item apps/web/.env.example apps/web/.env
```

3. Fill in the Discord and database values in those `.env` files.

4. Start the local PostgreSQL helper:

```powershell
npm run local:db:start
```

This helper creates an isolated local database cluster under `.local/postgres`, starts PostgreSQL on port `5433`, creates the `discord_analytics` database, and applies `apps/api/sql/001_init.sql`.

If you use that helper, the API and worker should point `DATABASE_URL` to:

```text
postgres://postgres:postgres@localhost:5433/discord_analytics
```

5. Start each service in its own terminal:

```powershell
npm run dev:api
```

```powershell
npm run dev:bot
```

```powershell
npm run dev:worker
```

```powershell
npm run dev:web
```

6. Open the dashboard:

```text
http://localhost:4173
```

## Discord Setup Notes

- The bot install flow should include `bot` and `applications.commands`.
- For staging, setting `DISCORD_COMMAND_GUILD_ID` makes slash commands register faster in one guild.
- The bot needs the `Message Content` intent enabled for message analytics.
- Channel visibility still depends on server permissions, not just the Developer Portal.

## Dashboard And Bot Surfaces

- Web dashboard
  - coverage
  - trends
  - activity history
  - reminders
  - invite flow
- Slash command
  - `/stats`
  - returns stats for the current server only
  - supports `day`, `week`, `month`, and `lifetime`

## Observability

- structured JSON logs across API, bot, and worker
- request tracing for internal service calls
- API liveness and readiness routes
- bot control server health routes
- worker-safe scheduling with PostgreSQL advisory locks

## Before Pushing

- Make sure real `.env` files are not staged.
- Rotate any secret immediately if it was ever pasted into a tracked file.
- Confirm bot invite scopes and redirect URIs match the deployment environment.
- Verify that log output does not contain secrets or tokens.
