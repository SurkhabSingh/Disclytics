# Bot Agent Notes

## Scope

`apps/bot` is the Discord-connected runtime. It owns:

- gateway connection
- message and voice event capture
- slash command registration and handling
- reminder delivery
- optional voice/TTS delivery
- bot-side reconciliation of live voice state

## Important Directories

- `src/events`
  gateway event handlers
- `src/services`
  voice tracking, guild sync, TTS, and registration services
- `src/commands`
  slash commands
- `src/server`
  internal control server
- `src/clients`
  API client used by the bot
- `src/state`
  in-memory session state

## Principles For This Area

- The bot must stay compliant with Discord rules.
- The bot only tracks activity in guilds where it is installed.
- Slash commands must remain server-safe and scoped correctly.
- Do not assume missed gateway events will be replayed later.
- Use reconciliation and explicit state handling instead of guesswork.

## Local Constraints

- The internal control server is operational infrastructure, not a public API.
- The bot should be deployed as a private service whenever the platform supports it.
- Voice session tracking must not grow forever after missed leave events.
- If the bot was offline, recovered voice start times may be approximate and should be treated as such in logic.

## Key Files

- `src/index.js`
- `src/events/messageCreate.js`
- `src/events/voiceStateUpdate.js`
- `src/events/ready.js`
- `src/events/interactionCreate.js`
- `src/services/voiceTracking.service.js`
- `src/services/commandRegistration.service.js`
- `src/server/controlServer.js`
- `src/commands/stats.js`
- `src/commands/remind.js`

## Local Action Log

- Message tracking implemented for guild-scoped messages, including content/media capture.
- Voice tracking implemented with in-memory active sessions and backend session persistence.
- Startup reconciliation added so users already in voice can be recovered when the bot connects.
- Stale voice-session protection added together with backend support to stop runaway live duration growth.
- Slash commands added for `/stats` and `/remind`.
- Internal control server added for reminder and TTS dispatch.

## Update Rule

When changing bot behavior, update this file and root `logs.md` in the same prompt.

