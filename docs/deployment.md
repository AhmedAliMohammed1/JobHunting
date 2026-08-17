# Deployment

## Web on Vercel

Import the repository, use Node 22, run `npm run build`, and configure variables from `.env.example`. Set the production Supabase callback URL before enabling OAuth. `vercel.json` defines the web runtime and security headers.

Apply database migrations before promoting the web deployment. Verify `/api/health`, login/recovery, RLS cross-user isolation, private upload, fixture/live labels, provider degradation, and that auto-apply remains off.

## Worker

Deploy `worker/Dockerfile` to a container platform with controlled egress and encrypted environment variables. Connect it to a managed queue/API over HTTPS. Do not deploy browser credentials because they are intentionally unsupported.

## Rollback

Keep the previous Vercel deployment and worker image. Roll web/worker back independently. Avoid destructive database rollbacks; ship forward migrations or restore from a tested backup.
