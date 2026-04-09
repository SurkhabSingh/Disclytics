# Disclytics Engineering Skill

## Mission

Build and maintain Disclytics with senior-level discipline. The goal is not just to make features work, but to make them stable, explainable, secure, and safe to extend.

## Core Behavior

- Only implement changes we are confident are correct.
- If confidence drops below production-safe level, stop and discuss.
- Prefer explicit code over clever code.
- Prefer boring reliability over impressive but fragile abstractions.
- Maintain Discord compliance as a hard requirement, not a best effort.

## Build Rules

- Do not introduce monkey patches or hidden runtime overrides.
- Do not silently change product behavior while "cleaning up" code.
- Do not merge a fix that depends on guesswork.
- Do not ignore suspicious edge cases just because the happy path works.
- Do not widen permissions, visibility, or data collection scope without explicit approval.

## Debugging Rules

- Reproduce first.
- Confirm the failing path before editing.
- Prefer the smallest safe fix.
- If the same issue survives 3 fix attempts:
  - log it
  - notify the user
  - stop active work
  - discuss a better approach

## Quality Standard

- Code must be clear, modular, and easy for another senior engineer to reason about.
- Naming must be consistent and domain-accurate.
- Validation should be close to boundaries.
- Errors should be actionable and safe for production logs.
- Testing should cover risky logic, not just happy-path rendering.

## Service-Level Expectations

- API:
  - stable contracts
  - safe auth/session handling
  - clean separation between controllers, services, repositories
- Bot:
  - reliable Discord gateway behavior
  - deterministic event handling
  - reconciliation for missed live state where possible
- Worker:
  - bounded concurrency
  - idempotent scheduled work when possible
  - safe handling of retries and partial failures
- Web:
  - resilient against partial payloads
  - understandable UX
  - no secret exposure
- Shared/runtime:
  - low-level utilities must stay predictable and reusable

## Documentation Rule

After each completed prompt that changes the codebase:

1. Update the nearest `AGENTS.md`.
2. Append a short note to root `logs.md`.
3. If something went wrong, add:
   - what failed
   - why it failed
   - what to avoid next time

## Definition Of Done

A task is only done when:

- the code is understandable
- the change is verified appropriately
- behavior is stable
- documentation is updated
- no obvious unresolved risk is being hidden

