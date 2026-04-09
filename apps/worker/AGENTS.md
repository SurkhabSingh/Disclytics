# Worker Agent Notes

## Scope

`apps/worker` is the background process for Disclytics. It owns:

- scheduled daily aggregation
- scheduled reminder dispatch
- advisory-lock-safe execution of background jobs

## Important Directories

- `src`
  worker bootstrap and logging
- shared execution logic lives in `apps/api/src/jobs` and `apps/api/src/services`

## Principles For This Area

- The worker must be safe to restart.
- Scheduled jobs must avoid duplicate execution across multiple instances.
- Concurrency must stay bounded.
- The worker should remain non-public in deployment.

## Local Constraints

- Advisory locks are the current guard against duplicate scheduled work.
- The worker intentionally reuses API DB and job modules instead of forking another business-logic copy.
- Cron schedules are configurable through environment variables and should stay that way.

## Key Files

- `src/index.js`
- `../api/src/jobs/startJobs.js`
- `../api/src/services/dailyStats.service.js`
- `../api/src/services/reminder.service.js`

## Local Action Log

- Worker was split out from API to avoid cron duplication during API scaling.
- Advisory-lock job execution added for safe multi-instance behavior.
- Reminder dispatch concurrency bounded to improve throughput without flooding downstream bot delivery calls.
- Cron expressions exposed through environment variables for safer operational tuning.

## Update Rule

When changing scheduled jobs or worker execution behavior, update this file and root `logs.md` in the same prompt.

