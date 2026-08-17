# JobHunter AI implementation plan

## Delivery strategy

The repository is organized as production infrastructure with a runnable credential-free mode. Each phase leaves the product in a deployable state; optional integrations remain `NOT_CONFIGURED` rather than pretending to work.

## Phase 1 — foundation

- Next.js App Router, strict TypeScript, Tailwind, accessible responsive shell, light/dark/system theme architecture.
- Supabase browser/server clients, cookie refresh proxy, email/password and Google OAuth entry points.
- Versioned PostgreSQL migration, private storage buckets, complete RLS policies, indexes, and development seed.
- Structured logging, health route, feature flags, safe errors, rate-limit abstraction, GitHub Actions.

## Phase 2 — candidate profile

- Private PDF/DOCX upload validation and document metadata.
- Vendor-neutral structured candidate parsing with Zod validation.
- Authoritative manual profile edits, education/employment records, reusable application data, approved answers, and multiple CV versions.
- Embedding interface and pgvector storage without sending more candidate data than required.

## Phase 3 — job discovery

- Provider interface, mock provider, Remotive public adapter, all-settled orchestration, timeouts, transient retry, and provider health metrics.
- Normalization, URL/data validation, source attribution, fingerprints, deduplication, discovery timestamps, and expiration states.
- Cached structured and natural-language search, traditional filters, pagination, and saved search profiles.

## Phase 4 — matching and recommendations

- Centralized deterministic weights, exact skill/title/location/employment/freshness signals, optional semantic signal, stable 0–100 score bands.
- Requirement extraction cache, truthful match explanations, feedback signals, saved and hidden jobs.
- Recommendations ranked by current preferences and feedback without opaque hard suppression.

## Phase 5 — alerts

- In-app notifications, email provider abstraction, idempotent delivery records, saved-search cron orchestration, immediate/hourly/daily preference model.
- Clear source freshness and graceful degraded behavior when email is not configured.

## Phase 6 — applications

- Application tracker, approved question bank, source/confidence for every field, CV selection, truthful cover-letter abstraction.
- Preflight validator, risk classifier, idempotency checks, event audit trail, and explicit confirmation evidence.

## Phase 7 — assisted apply

- Form model/analyzer/mapper/validator, ATS adapter interface, generic dry-run-only fallback, preview and confirmation workflow.
- Manifest V3 extension that fills only approved values and highlights unknown or sensitive questions for the user.

## Phase 8 — controlled automation

- Queue interface, external Playwright worker, resumable state machine, simulation mode, Auto Apply eligibility engine, daily/weekly/company limits, and kill switch.
- CAPTCHA, OTP, login, and unsupported platforms always pause or fall back to assisted/manual apply.

## Phase 9 — production hardening

- Unit and integration tests for deterministic logic, Playwright flows against mock pages only, CI build validation, secret scan guidance.
- Observability, provider diagnostics, performance budgets, backup/restore/migration procedures, deployment and troubleshooting guides.

## Release gates

1. No secrets, private CVs, or credentials in git.
2. Migration applies cleanly and every user-owned table has tested RLS.
3. `lint`, `typecheck`, unit tests, and production build pass.
4. Mock mode works with no production credentials.
5. At least one documented real provider works and displays its actual freshness limitation.
6. Simulation proves Auto Apply decisions without submission.
7. Duplicate notifications, tasks, and applications are rejected by database and application-level idempotency.
8. CAPTCHA, OTP, sensitive questions, unknown facts, and unverified submission always stop automation.

