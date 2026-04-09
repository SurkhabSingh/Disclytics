# Disclytics Global Log

## Purpose

This file is the repo-wide running log. Every meaningful change should be summarized here after the nearest `AGENTS.md` is updated.

## Logging Rules

- Keep entries short and factual.
- Include affected services.
- If something failed, say so clearly.
- If an issue remained unresolved after repeated attempts, log that and stop active implementation until a clearer plan exists.

## Entries

### 2026-04-08

- Added global and service-level `AGENTS.md` files for API, bot, worker, web, runtime, and shared.
- Added root `SKILL.md` to define engineering expectations, debugging limits, and documentation rules.
- Established the rule that every prompt-level change must update the nearest `AGENTS.md` and this file.
- Hardened API CORS handling for local development so both `localhost:4173` and `localhost:5173` are accepted in non-production, and updated the API env example accordingly.
- Added a root combined-backend supervisor script and backend start commands so API, bot, and worker can run under one Railway service with service-level restart logging.
- Aligned local frontend/API origin config back to `localhost:4173` and made Vite use strict port `4173` for both dev and preview to avoid recurring local CORS drift.
- Split Vite dev and preview ports so `4173` is always the live-editing frontend and `4174` is built-preview only; also cleaned the voice trend axis labels to use simpler hour-based formatting.

### Existing Project Milestones

- Repository split into `api`, `bot`, `worker`, and `web` services with shared runtime and shared constants packages.
- Discord OAuth2 login, guild sync, and session-backed dashboard access implemented.
- Message tracking, voice tracking, reminders, and slash command support implemented.
- Voice reliability improved with reconciliation and stale-session handling.
- Dashboard evolved into a Discord-style UI with today, history, lifetime, and reminders views.
- Internal logging, request context, graceful shutdown, and request timeout handling added.
- Dashboard behavior intentionally changed to snapshot-only loading instead of automatic polling.
- SQL indexing added for heavier analytics paths.
