# JobHunter AI

JobHunter AI is a privacy-first job discovery, matching, and application-preparation workspace. It combines auditable provider ingestion, deterministic scoring, private candidate data, and deliberately constrained browser assistance. It does **not** claim universal job coverage, does not bypass CAPTCHA/OTP/login, and never invents candidate facts.

## What is included

- Next.js 16 App Router, React 19, strict TypeScript, responsive product UI
- Supabase Auth, Postgres, pgvector, private Storage, migrations, seed data, and RLS
- Email/password, password recovery, and Google OAuth UI
- Natural-language search interpretation with deterministic fallback, complete structured filters, and CV-aware match thresholds
- Search-provider abstraction with isolated development fixtures, an hourly cached Arbeitnow European/UK aggregator, and an optional delayed Remotive adapter
- Normalization, deduplication, freshness classification, partial-provider failure, retry, and rate limits
- Deterministic, decomposable job matching with centralized versionable weights
- AI abstraction for OpenAI-compatible structured output and embeddings, plus explicit mock/not-configured modes
- Application state machine, sensitive-answer review, dry-run gate, limits, allowlists, and idempotency-ready schema
- Separate Playwright worker foundation and Manifest V3 review extension
- Unit, provider-contract, API-integration, desktop/mobile browser suites, GitHub Actions, Vercel config, and operational documentation

## Local setup

Requirements: Node.js 22.13 or newer and npm 11.

### Recommended: use the same environment values as Vercel production

```bash
npm install
npx vercel login
npm run setup:local
npm run dev
```

`npm run setup:local` links this checkout to the existing Vercel `job-hunting` project and pulls the current **production** environment variables into `.env.local`.

`.env.local` is intentionally gitignored and must never be committed. If an API key changes in Vercel later, refresh your local copy with:

```bash
npm run env:pull
```

Then restart `npm run dev`.

Open `http://localhost:3000`.

### Alternative: local fixture mode without production credentials

```bash
cp .env.example .env.local
npm install
npm run dev
```

With the example environment, the app can run in local/mock mode. Authenticated persistence, private uploads, RLS, live external job APIs, and production search discovery require the relevant credentials.

To configure Supabase manually:

1. Create a project and enable Email and Google providers as needed.
2. Apply `supabase/migrations/20260817180000_initial_schema.sql` with the Supabase CLI or SQL editor.
3. Optionally apply `supabase/seed.sql` in a development project.
4. Set the public project URL, publishable key, and server secret in `.env.local`.
5. Add `http://localhost:3000/auth/callback` and your production callback URL to the Auth redirect allowlist.

## Commands

```bash
npm run setup:local
npm run env:pull
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:coverage
npm run test:e2e
npm run build
```

The browser worker is intentionally separate:

```bash
cd worker
npm install
npm run build
npm start
```

## Production rules

- Production always enforces live-provider mode; fixtures are never mixed into production responses. `JOB_PROVIDER_MODE=mock` remains available for local development and automated tests.
- Arbeitnow is enabled by default, cached for one hour, attributed on every result, and aggregates listings from multiple public ATS sources. Remotive is opt-in because its public-feed terms and 24-hour delay require a separate deployment review.
- Keep `FEATURE_AUTO_APPLY=false` until the simulation, adapter, queue, secrets, and monitoring gates in the runbook pass.
- Never expose `SUPABASE_SECRET_KEY`, worker secrets, AI keys, job-provider API keys, OAuth secrets, or cron secrets in Git-tracked files or `NEXT_PUBLIC_*` variables.
- Deploy the web application to Vercel and the stateful Playwright worker to a separate container service.

## Documentation

- [Architecture](docs/architecture.md)
- [Implementation plan](docs/implementation-plan.md)
- [Authentication](docs/authentication.md)
- [Database and environment](docs/database-environment.md)
- [Security model](docs/security-model.md)
- [AI providers](docs/ai-providers.md)
- [Candidate onboarding](docs/candidate-onboarding.md)
- [Job sources](docs/job-sources.md)
- [Automation safety](docs/automation-safety.md)
- [Worker operations](docs/worker-operations.md)
- [Extension](docs/extension.md)
- [Deployment](docs/deployment.md)
- [Demo scripts](docs/demo-scripts.md)
- [Testing](docs/testing.md)
- [Troubleshooting](docs/troubleshooting.md)

## Status honesty

The repository is production-shaped, but external services remain opt-in. A route displaying local fixtures says so. An unconfigured integration returns a coarse unavailable state. The generic worker only navigates and analyzes in dry-run mode; it does not submit. Named ATS adapters must be implemented and tested against authorized environments before automatic submission can be enabled.
