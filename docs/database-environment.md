# Database and environment

The initial migration creates candidate, document, job, provider, search, notification, application, automation, feedback, and audit tables. `vector(1536)` columns support candidate/job embeddings with HNSW cosine indexes. Private `cvs` and `application-artifacts` buckets use first-path-segment ownership policies.

All user-owned tables have RLS and owner policies. Shared normalized jobs and provider health are readable by authenticated users; writes belong to trusted server/worker roles. The service key must be restricted to server processes.

Use `.env.example` as the canonical variable list. Validate production values in the deployment platform and rotate AI, cron, and worker secrets separately. Apply migrations in a staging project before production and take a database backup before destructive schema changes.
