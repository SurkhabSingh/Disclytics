# API Agent Notes

## Scope

`apps/api` is the public backend for Disclytics. It owns:

- Discord OAuth2 login
- session issuance and logout
- analytics dashboard responses
- reminder CRUD APIs
- internal ingestion routes used by the bot
- database persistence orchestration

## Important Directories

- `src/controllers`
  HTTP boundary and response shaping
- `src/services`
  orchestration and business logic
- `src/repositories`
  SQL access and persistence details
- `src/routes`
  public and internal route wiring
- `src/jobs`
  shared job wiring used by the worker
- `sql`
  schema and operational SQL

## Principles For This Area

- Keep controllers thin.
- Keep repository functions SQL-focused and deterministic.
- Do not mix public route concerns with internal ingestion concerns.
- Preserve session behavior and cookie security.
- Keep analytics payloads stable unless the UI explicitly changes.
- Prefer additive SQL migrations over silent schema drift.

## Local Constraints

- `/api/internal/*` must be treated as private operational surface.
- The API should stay stateless with respect to scheduled jobs; the worker owns cron execution.
- Analytics is read-heavy. Avoid changing query semantics casually.
- PostgreSQL is the source of truth for tracked activity.

## Key Files

- `src/server.js`
- `src/app.js`
- `src/controllers/auth.controller.js`
- `src/controllers/analytics.controller.js`
- `src/services/analytics.service.js`
- `src/services/reminder.service.js`
- `src/services/eventIngestion.service.js`
- `src/jobs/startJobs.js`
- `sql/001_init.sql`
- `sql/002_add_analytics_indexes.sql`

## Local Action Log

- OAuth login, callback, and session persistence added.
- Internal ingestion endpoints added for bot-originated message and voice events.
- Reminder service added with DM/channel/voice delivery support through bot control.
- Analytics service added for today, history, lifetime, heatmap, and leaderboards.
- Dashboard query path reduced for the "history = today" case to avoid duplicate reads.
- Cron expressions made configurable through environment for worker scheduling.
- Additional analytics indexes added in `sql/002_add_analytics_indexes.sql`.
- CORS handling was hardened for local development so both Vite dev and preview localhost ports are accepted without changing production origin rules.
- Local development should prefer frontend port `4173`. The API env may still allow `5173` as a compatibility origin, but `4173` is the intended local default.

## Update Rule

When changing API code, update this file and root `logs.md` in the same prompt.
