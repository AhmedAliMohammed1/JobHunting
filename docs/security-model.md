# Security model

Primary assets are identity, CVs, candidate facts, application answers, provider keys, and submission authority. Main threat boundaries are browser-to-web, web-to-Supabase, provider egress, and web-to-worker.

Controls include RLS, private buckets, validated file MIME plus magic bytes, user-scoped storage paths, HTTPS URL validation, structured redacted logs, rate limits, explicit provider modes, and server-only secrets. Sensitive answers are classified and held for review. Worker payloads reject credentials and prefilled sensitive answers.

The system never bypasses CAPTCHA, OTP, login, anti-bot controls, or site terms. It does not store application-site passwords. Outbound automation uses allowlisted domains, capped volume, freshness requirements, state transitions, dry-run evidence, and idempotency keys. Generic forms are unsupported for automatic submission.

Before launch, add a distributed rate limiter, a managed queue, error monitoring, dependency scanning, CSP reporting, backups, key rotation, and a documented incident response owner.
