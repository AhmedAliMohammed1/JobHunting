# Authentication

The app uses `@supabase/ssr` on the browser and server. `proxy.ts` refreshes sessions and protects product paths when Supabase is configured. Server authorization uses verified claims via `supabase.auth.getClaims()`; client state is never accepted as proof of identity.

Supported flows are email/password sign-in, registration, password recovery/reset, and Google OAuth. Configure both local and production `/auth/callback` URLs in Supabase. Recovery links should return to `/reset-password`.

When Supabase variables are absent, the public product preview remains available and auth forms show a configuration notice. Private API routes such as CV upload still fail closed. Never use the service secret in a browser client.
