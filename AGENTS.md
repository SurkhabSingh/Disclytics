# Disclytics Agent Notes

## Purpose

This repository powers Disclytics, a Discord activity analytics platform. It tracks activity only inside servers where the bot is installed and visualizes that activity in a web dashboard. The system is intentionally server-scoped and must remain compliant with Discord platform rules at all times.

This file is the global handoff document. Service-level details live in the nearest `AGENTS.md` under each app or package.

## System Map

- `apps/api`
  Public Express API for OAuth, analytics reads, reminder APIs, and internal ingestion endpoints.
- `apps/bot`
  Discord bot process that listens to gateway events, manages slash commands, tracks voice state, and exposes an internal control server.
- `apps/worker`
  Background scheduler for daily aggregation and reminder dispatch.
- `apps/web`
  React dashboard and landing page.
- `packages/runtime`
  Shared runtime utilities for logging, HTTP, request context, and shutdown.
- `packages/shared`
  Shared constants and cross-service enums.

## Tech Stack

- Backend: Node.js, Express.js, PostgreSQL
- Bot: discord.js, @discordjs/voice
- Frontend: React, Recharts, react-icons, Vite
- Auth: Discord OAuth2
- Scheduler: node-cron
- Infra patterns: private internal traffic, public API, structured logs, graceful shutdown

## Non-Negotiables

- Never track activity outside servers where the bot is present.
- Never use self-bots, user tokens, or anything that violates Discord policy.
- Never expose secrets in frontend code, logs, committed files, screenshots, or docs.
- Never ship a change if the expected behavior is uncertain.
- Never rely on monkey patching, hidden side effects, or fragile one-off hacks.
- If the same bug survives 3 serious fix attempts, stop implementation, log it, notify the user, and discuss a new approach before continuing.

## Engineering Principles

- Favor small, reversible changes over sweeping rewrites.
- Preserve current working behavior unless the task explicitly changes product behavior.
- Keep services loosely coupled:
  - API serves public HTTP and persists data.
  - Bot owns Discord connectivity and live collection.
  - Worker owns scheduled jobs.
- Treat PostgreSQL as the source of truth.
- Prefer explicit validation, timeouts, and structured logging.
- Optimize for production correctness first, then performance, then aesthetics.
- Document every meaningful change in:
  - the nearest `AGENTS.md`
  - root `logs.md`

## Operating Rules For Future Contributors

1. Read the nearest `AGENTS.md` before editing a service or package.
2. If changing multiple services, read this file plus each touched local `AGENTS.md`.
3. Before risky work, confirm the approach and likely blast radius.
4. After each completed prompt:
   - update the nearest `AGENTS.md`
   - append a short entry to `logs.md`
5. If a bug is unresolved after 3 credible attempts:
   - create a log entry
   - stop active implementation
   - ask for a strategy reset

## Current Architecture Decisions

- The bot, API, worker, and web app remain separate services.
- The worker is separate so API scaling does not duplicate cron jobs.
- The bot has an internal control server and should stay private in deployment.
- A combined backend deployment mode is now supported through a root supervisor script for platforms such as Railway. This does not merge business logic; it only supervises the existing API, bot, and worker entrypoints together.
- The dashboard is currently snapshot-based:
  - no interval polling
  - no focus/visibility auto-refresh
  - new data loads on page reload or explicit date change
- Voice tracking uses startup reconciliation and stale-session protection to avoid runaway active sessions.
- Internal service traffic is protected by shared secret plus deployment-level network isolation.

## Deployment Guardrails

- Public:
  - `apps/web`
  - `apps/api`
- Private or non-public:
  - `apps/bot`
  - `apps/worker`
  - database
- Apply both SQL files before production use:
  - `apps/api/sql/001_init.sql`
  - `apps/api/sql/002_add_analytics_indexes.sql`

## Global Action Log

- Initial monorepo created with API, bot, worker, web, runtime, and shared packages.
- Discord OAuth, guild sync, and dashboard authentication flow implemented.
- Message tracking, voice session tracking, reminders, and dashboard analytics added.
- Worker extracted from API so scheduled jobs run independently.
- Structured logging, request context, graceful shutdown, and internal HTTP helpers added.
- Voice tracking hardened with reconciliation and stale-session protection.
- Dashboard redesigned into a Discord-inspired analytics UI with history, lifetime, and reminders.
- Scatter plots removed in favor of simpler analytics surfaces.
- Frontend hardened with request timeout handling, payload normalization, and error boundary.
- Dashboard auto-refresh behavior removed so the UI is now snapshot-based by design.
- Analytics query load reduced for same-day history requests.
- Database indexes added for analytics-heavy paths.
- Root combined backend supervisor added so Railway can run API, bot, and worker as a single deployable service while preserving per-service ownership and logs. The root `npm start` entrypoint now maps to this combined backend mode.
