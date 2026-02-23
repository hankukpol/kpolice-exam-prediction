# Deploy Guide (Vercel + Supabase)

## 1. Supabase

1. Create a Supabase project.
2. Create a public storage bucket named `uploads` (or set custom bucket name in env).
3. Copy connection URL and keys:
   - `DATABASE_URL` (Postgres)
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

## 2. Database Schema

Run once in your local/dev environment:

```bash
npm install
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
```

## 3. Vercel Environment Variables

Set these variables in Vercel project settings:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` (optional, default `uploads`)
- `CRON_SECRET` (or `AUTO_PASSCUT_CRON_SECRET`)
- `ADMIN_PHONE` (optional for seed)
- `ADMIN_PASSWORD` (optional for seed)

## 4. Deploy

Push the repository and deploy on Vercel.

Build uses:

```bash
npm run build
```

## 5. Cron

`vercel.json` includes a cron for:

- `/api/internal/pass-cut-auto-release` every 10 minutes

The route accepts:

- `Authorization: Bearer <CRON_SECRET>` (Vercel Cron default)
- `x-auto-release-secret` header (manual/internal compatibility)
