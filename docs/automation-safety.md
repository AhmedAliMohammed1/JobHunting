# Automation safety

Auto-apply defaults off in UI, server configuration, and database state. Enabling requires all of: the server feature flag, explicit user preference, a recorded successful dry run, fresh listing, allowlisted domain, supported named adapter, approved answers, and remaining daily/weekly/company limits.

The application state machine rejects invalid transitions. CAPTCHA, OTP, login, sensitive fields, unknown required fields, low-confidence mapping, unsupported controls, and stale jobs stop execution. Generic pages support analysis/dry-run only and never submit.

Every mutation needs an idempotency key. Store state transitions and sanitized evidence, not credentials or full page content. Confirmation must be explicit; lack of confirmation is `SUBMITTED_UNVERIFIED`, never success. A global pause and per-task cancellation must remain available.
