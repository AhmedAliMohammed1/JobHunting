# JobHunter AI

JobHunter AI is a privacy-first job discovery, matching, and application-preparation workspace. It combines auditable provider ingestion, deterministic scoring, private candidate data, and deliberately constrained browser assistance. It does **not** claim universal job coverage, does not bypass CAPTCHA/OTP/login, and never invents candidate facts.

## What is included

- Next.js 16 App Router, React 19, strict TypeScript, responsive product UI
- Supabase Auth, Postgres, pgvector, private Storage, migrations, seed data, and RLS
- Email/password, password recovery, and Google OAuth UI
- Search-provider abstraction with isolated development fixtures and a delayed/cached Remotive adapter
- Normalization, deduplication, freshness classification, partial-provider failure, retry, and rate limits
- Deterministic, decomposable job matching with centralized versionable weights
- AI abstraction for OpenAI-compatible structured output and embeddings, plus explicit mock/not-configured modes
- Application state machine, sensitive-answer review, dry-run gate, limits, allowlists, and idempotency-ready schema
- Separate Playwright worker foundation and Manifest V3 review extension
- Unit tests, browser smoke tests, GitHub Actions, Vercel config, and operational documentation

## Local setup

Requirements: Node.js 22.13 or newer and npm 11.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. With the default environment, the app runs in a clearly labeled local-fixture mode. Authenticated persistence, private uploads, RLS, and pgvector require a Supabase project.

To configure Supabase:

1. Create a project and enable Email and Google providers as needed.
2. Apply `supabase/migrations/20260817180000_initial_schema.sql` with the Supabase CLI or SQL editor.
3. Optionally apply `supabase/seed.sql` in a development project.
4. Set the public project URL, publishable key, and server secret in `.env.local`.
5. Add `http://localhost:3000/auth/callback` and your production callback URL to the Auth redirect allowlist.

## Commands

```bash
npm run lint
npm run typecheck
npm test
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

- Set `JOB_PROVIDER_MODE=live`; fixtures are never mixed into live responses.
- Enable only providers whose current terms and quotas you have reviewed. Remotive public results are labeled delayed/cached and cached for six hours.
- Keep `FEATURE_AUTO_APPLY=false` until the simulation, adapter, queue, secrets, and monitoring gates in the runbook pass.
- Never expose `SUPABASE_SECRET_KEY`, worker secrets, AI keys, or cron secrets to `NEXT_PUBLIC_*` variables.
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
