# Testing

The suite is split by failure boundary:

- `npm run test:unit` — auth validation, safe redirects, product schemas, normalization, matching, application transitions, safety simulation, rate/URL security, and durable job identity.
- `npm run test:integration` — public API behavior, health/config preflight, every authenticated API boundary, and provider output contracts.
- `npm run test:e2e` — Chromium desktop and iPhone-size flows for auth, navigation, search, filters, save gates, API health, and every product route.
- `npm run test:coverage` — V8 coverage report for server-side product logic, enforced at 90% statements/lines/functions and 65% branches.
- `npm run check` — lint, TypeScript, worker TypeScript, all Vitest suites, production build, and browser suites.

## Feature-to-suite matrix

| Feature | Unit/contract | API integration | Browser |
| --- | --- | --- | --- |
| Login, registration, recovery, callback | `auth.test.ts` | auth boundary suite | `authentication.spec.ts` |
| Search, filters, provider labeling | job/provider suites | public search API | `search.spec.ts` |
| Profile | product schema | anonymous/auth boundary | navigation route + authenticated API contract |
| Saved jobs | identity and job schema | anonymous/auth boundary | search save gate + saved route |
| Saved searches and alert schedule | search/product schema | anonymous/auth boundary | save action + search-profiles route |
| Matching/recommendations | matching suite | anonymous/auth boundary | recommended route |
| Applications | transition/preflight suites | anonymous/auth boundary | applications route |
| CV upload and private documents | file/risk validation | anonymous/auth boundary | CV route |
| Notifications | delivery dedupe logic | anonymous/auth boundary | notifications route |
| Automation and worker safety | eligibility, preflight, simulation | anonymous/auth boundary | automation/settings routes |
| Deployment health | environment validation | health/config endpoints | `api.spec.ts` |

The production preflight browser run sets `E2E_PRODUCTION_MISCONFIGURED=true` and verifies that protected pages fail closed when Supabase is absent. The full feature-shell run uses development fixture mode. A real Supabase deployment must additionally run the checklist below because OAuth delivery, RLS, Storage, and third-party provider availability cannot be proven without that deployment's credentials.

## Live deployment checklist

Use two disposable users. Verify email confirmation, password recovery, Google OAuth (if enabled), cross-user RLS denial, profile persistence, save/remove job, saved-search create/pause/delete, application-stage update, CV upload/delete, notification read state, sign-out, and session expiry. Keep auto-apply disabled while testing. Worker adapters require authorized fixture sites covering success, validation error, changed selectors, CAPTCHA, login, timeout, and duplicate-task idempotency.
