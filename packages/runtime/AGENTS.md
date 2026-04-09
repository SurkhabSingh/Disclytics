# Runtime Agent Notes

## Scope

`packages/runtime` contains shared operational primitives reused across services.

Current responsibilities:

- structured logger creation
- HTTP client wrapper
- request-context helpers
- graceful shutdown registration

## Principles For This Area

- Keep utilities generic and dependency-light.
- Do not leak service-specific business logic into this package.
- Changes here affect multiple services, so regressions have broad blast radius.
- Backward compatibility matters more here than in feature modules.

## Key Files

- `src/index.js`
- `src/logger.js`
- `src/httpClient.js`
- `src/requestContext.js`
- `src/shutdown.js`

## Local Action Log

- Shared structured logging introduced for API, bot, and worker.
- Shared HTTP client added for internal service communication with retry and timeout support.
- Shared graceful shutdown helpers added to keep service exits consistent.
- Shared request-context utilities added for better tracing.

## Update Rule

When changing shared runtime behavior, update this file and root `logs.md` in the same prompt.

