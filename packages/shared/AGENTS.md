# Shared Package Agent Notes

## Scope

`packages/shared` contains shared constants and low-level cross-service helpers that define platform vocabulary.

## Principles For This Area

- Keep exports minimal and stable.
- Only place truly cross-service primitives here.
- Avoid business logic that belongs in API, bot, worker, or web.
- Renaming values here can break multiple services at once.

## Key Files

- `src/index.js`

## Current Shared Surface

- event type constants
- reminder delivery type constants
- reminder schedule type constants
- stats period constants
- voice session key helper

## Local Action Log

- Shared enums added to keep API, bot, and worker aligned on event and reminder types.
- Shared voice session key helper added to keep in-memory voice tracking identifiers consistent.

## Update Rule

When changing shared constants or helpers, update this file and root `logs.md` in the same prompt.

