# Testing

`npm test` covers normalization, deduplication, freshness, match scoring, transition validation, preflight, risk, and URL safety. `npm run test:e2e` covers responsive public navigation and the fixture search disclosure. `npm run lint`, `npm run typecheck`, and `npm run build` are required CI gates.

Before production, run Supabase integration tests against disposable projects for RLS cross-user access, private storage, OAuth callback, migrations, and pgvector retrieval. Worker adapters require authorized fixture sites that cover success, validation error, changed selectors, CAPTCHA, login, timeout, and duplicate-task idempotency.
