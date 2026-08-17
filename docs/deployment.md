# Deployment

## Web on Vercel

Import the repository, use Node 22, run `npm run build`, and configure variables from `.env.example`. Set the production Supabase callback URL before enabling OAuth. `vercel.json` defines the web runtime and security headers.

Apply database migrations before promoting the web deployment. Verify `/api/health`, login/recovery, RLS cross-user isolation, private upload, fixture/live labels, provider degradation, and that auto-apply remains off.

`/api/config/status` is the deployment preflight. Production is not ready until `services.auth`, `services.database`, `services.ai`, and `services.jobs` are true. Protected pages deliberately redirect to `/login?error=configuration` when Supabase public variables are missing; this prevents a broken deployment from appearing authenticated.

Required Vercel variables for account-backed features are `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`. Set `JOB_PROVIDER_MODE=live` and `ENABLE_REMOTIVE=true` for the included live provider. If `AI_PROVIDER=openai-compatible`, also set `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL`. Redeploy after changing public variables because Next.js embeds them at build time.

## Worker

Deploy `worker/Dockerfile` to a container platform with controlled egress and encrypted environment variables. Connect it to a managed queue/API over HTTPS. Do not deploy browser credentials because they are intentionally unsupported.

## Rollback

Keep the previous Vercel deployment and worker image. Roll web/worker back independently. Avoid destructive database rollbacks; ship forward migrations or restore from a tested backup.
