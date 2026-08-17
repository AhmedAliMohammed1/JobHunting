# Troubleshooting

- **Auth loops:** verify `NEXT_PUBLIC_APP_URL`, Supabase redirect allowlist, browser clock, and publishable key. Check only coarse error codes; do not log tokens.
- **CV upload 401/503:** sign in, then confirm Supabase variables, the `cvs` bucket, migration policies, MIME, signature, and 8 MB limit.
- **No search results:** check `JOB_PROVIDER_MODE`. Mock returns only fixtures; live returns only enabled real providers. Provider failures are reported as partial, never filled with mock jobs.
- **AI unavailable:** confirm all four adapter values. Core matching/search continue without AI; unknown extraction remains unknown.
- **Build font/network errors:** the app uses a system font stack and has no build-time font download.
- **Worker stops:** CAPTCHA, OTP, login, sensitive payloads, and unsupported pages are intentional stops. Do not weaken the guard to force progress.
- **Auto-apply will not enable:** confirm server feature flag, user setting, dry run, database check, fresh job, allowlist, adapter, and volume limits.
