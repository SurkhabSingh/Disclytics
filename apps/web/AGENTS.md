# Web Agent Notes

## Scope

`apps/web` is the React frontend for Disclytics. It owns:

- landing page
- OAuth entry points
- authenticated dashboard
- analytics visualization
- reminder creation and reminder history
- install/invite affordances

## Important Directories

- `src/pages`
  top-level views
- `src/components`
  reusable UI blocks
- `src/components/charts`
  chart rendering
- `src/features`
  feature-specific data shaping
- `src/api`
  frontend API client
- `src/utils`
  formatting and helpers
- `src/test`
  shared test setup

## Principles For This Area

- Keep the UI understandable before making it clever.
- Prefer resilient rendering over tight assumptions about payload shape.
- No secret or privileged backend data should be exposed here.
- Snapshot behavior is intentional right now:
  - no polling
  - no auto-refresh on focus
  - no client-side live counter updates
- Reload or explicit user actions should be the trigger for fresh data.

## Local Constraints

- Charts should degrade gracefully with empty data.
- The dashboard must remain usable in loading, empty, and partial-data states.
- Avoid introducing heavy client behavior without clear UX value.
- This frontend depends on stable API contracts but should still guard against malformed data.

## Key Files

- `src/App.jsx`
- `src/pages/DashboardPage.jsx`
- `src/api/client.js`
- `src/features/analytics/dashboardModel.js`
- `src/components/ReminderPanel.jsx`
- `src/components/ActivityDetailsPanel.jsx`
- `src/components/charts/EngagementTrendChart.jsx`
- `src/styles.css`

## Local Action Log

- Dashboard evolved from a simple metrics view into a Discord-inspired workspace UI.
- History calendar, lifetime analytics, reminders, and activity history panels were added.
- Scatter plots were removed in favor of simpler analytics surfaces.
- Error boundary and request timeout handling were added for safer production behavior.
- Auto-refresh and client-side live polling were fully removed. The dashboard now shows a static snapshot until the user reloads or changes date context.
- Vite uses strict ports for local consistency:
  - dev server on `4173`
  - preview server on `4174`
- Local frontend workflow now intentionally separates ports:
  - dev server with live CSS/HMR: `4173`
  - preview server for built assets: `4174`
  This avoids confusion where preview serves stale built CSS while someone expects hot reload.

## Update Rule

When changing dashboard behavior or visuals, update this file and root `logs.md` in the same prompt.
