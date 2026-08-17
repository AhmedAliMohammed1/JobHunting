# Demo scripts

## Safe local demo

1. Start with `.env.example` defaults and open `/dashboard`.
2. Visit Discover and run the example query. Point out the `DEVELOPMENT FIXTURE` label.
3. Open Recommendations and explain score decomposition.
4. Upload is shown but fails closed until Supabase/Auth are configured.
5. Open Auto-apply safety. Show that enablement is locked until dry run, then explain that the server and database remain independent gates.
6. Open Applications and show `WAITING_FOR_USER` for a sensitive answer.

## Failure demo

Set `JOB_PROVIDER_MODE=live` with providers disabled. Search returns zero real results rather than substituting fixtures. Disable Supabase variables and show the coarse health/auth configuration state. Never demonstrate against a real application form without written authorization.
