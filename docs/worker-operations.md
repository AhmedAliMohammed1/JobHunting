# Worker operations

The Playwright worker is a separate Node/container process because Vercel functions are not suited to long-lived browser sessions. It polls an authenticated queue endpoint, validates HTTPS plus allowlisted domains, rejects credential and sensitive-answer payloads, opens an isolated browser context, and detects CAPTCHA/OTP/login.

Deploy from `worker/Dockerfile`. Set `WORKER_POLL_URL`, a 24+ character `WORKER_SECRET`, and an optional poll interval. Run one low-concurrency replica first. Add managed queue leases, heartbeat/visibility timeout, bounded retries, dead-letter handling, encrypted artifact storage, and metrics before production.

The included runner intentionally stops before mutation unless a named tested ATS adapter exists. Never use it to evade anti-bot controls or a site's terms.
