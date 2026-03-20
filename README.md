# Discord Activity Analytics Platform

Production-oriented MVP for tracking Discord activity inside servers where the bot is installed. The platform stays within Discord policy boundaries:

- No self-bots
- No user tokens for automation
- No global tracking outside bot-installed servers
- No attempt to infer or scrape activity where the bot is absent

## Architecture

- `apps/api`: Express API, PostgreSQL access, OAuth2 login, analytics queries, reminder scheduling
- `apps/bot`: `discord.js` bot, message + voice tracking, guild sync, reminder delivery, optional voice TTS
- `apps/worker`: dedicated scheduler process for reminders and daily aggregation
- `apps/web`: React dashboard with coverage banner, metrics, trend charts, heatmap, reminders
- `packages/shared`: shared event/reminder constants
- `packages/runtime`: shared structured logger, request context, HTTP client, graceful shutdown

## Folder Structure

```text
.
|-- apps
|   |-- api
|   |   |-- sql/001_init.sql
|   |   `-- src
|   |       |-- config
|   |       |-- controllers
|   |       |-- db
|   |       |-- jobs
|   |       |-- middleware
|   |       |-- repositories
|   |       |-- routes
|   |       `-- services
|   |-- bot
|   |   `-- src
|   |       |-- clients
|   |       |-- events
|   |       |-- server
|   |       |-- services
|   |       |-- state
|   |       `-- utils
|   `-- web
|       `-- src
|           |-- api
|           |-- components
|           `-- pages
`-- packages
    `-- shared
```

## Data Flow

1. User authenticates with Discord OAuth2.
2. API stores the user and the list of guilds the user granted access to.
3. Bot is manually installed into specific guilds.
4. Bot sends message events and voice session state to the API through internal authenticated endpoints.
5. API stores raw events and voice sessions in PostgreSQL.
6. Worker process aggregates daily stats and dispatches reminders.
7. React dashboard reads analytics and shows tracking coverage explicitly.

## Core Tables

Defined in [001_init.sql](/c:/Users/admin/Desktop/saving%20grace/apps/api/sql/001_init.sql).

- `users`
- `guilds`
- `user_guilds`
- `events`
- `voice_sessions`
- `daily_stats`
- `reminders`

## Key API Surface

- `GET /api/auth/discord/start`
- `GET /api/auth/discord/callback`
- `GET /api/auth/me`
- `GET /api/analytics/dashboard?days=7`
- `GET /api/reminders`
- `POST /api/reminders`
- `PATCH /api/reminders/:reminderId/toggle`
- `POST /api/internal/events/messages`
- `POST /api/internal/voice-sessions/start`
- `POST /api/internal/voice-sessions/stop`
- `POST /api/internal/voice-sessions/reconcile`
- `POST /api/internal/guilds/sync`
- `GET /api/health/live`
- `GET /api/health/ready`

## Voice Tracking Notes

- Join/leave/switch events are tracked through `voiceStateUpdate`.
- Active sessions are kept in memory inside the bot for fast transitions.
- Open sessions are also persisted in PostgreSQL using `voice_sessions` with `end_time IS NULL`.
- Internal ingestion uses idempotency keys so retries do not duplicate message events or corrupt voice session boundaries.
- On bot restart, the bot reconciles live voice state from the gateway so stale open sessions are closed instead of running forever.
- Downtime cannot be reconstructed exactly because Discord does not provide retroactive session history. The reconciliation path is designed to fail safe by preventing overcounting.

## Observability

- API, bot, and worker emit structured JSON logs.
- Internal HTTP calls propagate `x-request-id` automatically.
- API exposes liveness and readiness routes.
- Bot control server exposes `/internal/health/live` and `/internal/health/ready`.
- Worker job execution uses PostgreSQL advisory locks so multiple worker replicas do not double-run reminder or aggregation jobs.

## Reminder Delivery

- Reminder schedules are stored in PostgreSQL.
- `node-cron` polls due reminders every minute.
- API sends reminder commands to the bot control server.
- Bot can deliver via DM, text channel, and optional voice playback using `@discordjs/voice`.

## Local Setup

1. Copy `apps/api/.env.example` to `apps/api/.env`.
2. Copy `apps/bot/.env.example` to `apps/bot/.env`.
3. Copy `apps/web/.env.example` to `apps/web/.env`.
4. Install dependencies from the repo root with `npm install`.
5. Create the PostgreSQL database and run [001_init.sql](/c:/Users/admin/Desktop/saving%20grace/apps/api/sql/001_init.sql).
6. Start each service:
   - `npm run dev:api`
   - `npm run dev:bot`
   - `npm run dev:worker`
   - `npm run dev:web`
7. Optional local container stack:
   - `docker compose up --build postgres api worker bot web`

## Test Baseline

- `npm run test`
- API unit coverage starts with reminder schedule logic.
- Bot unit coverage starts with voice join/switch transition logic.
- After credentials are added, run manual staging verification for OAuth, message tracking, voice tracking, and reminder delivery.

## MVP Scope Implemented

- Discord OAuth2 login scaffold
- Bot guild coverage sync
- Message event ingestion
- Voice session tracking with restart reconciliation
- PostgreSQL schema, aggregation job, and dedicated worker
- Reminder storage and dispatch
- Voice TTS delivery path
- Structured logging, request tracing, health/readiness checks
- Basic analytics dashboard

## Real-World Constraints This Repo Preserves

- Analytics coverage is intentionally partial and honest.
- Dashboard language should always reflect tracked servers, not all Discord activity.
- Product growth depends on increasing bot installation coverage, not bypassing Discord platform rules.
