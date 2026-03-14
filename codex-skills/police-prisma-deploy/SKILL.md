---
name: police-prisma-deploy
description: Use this skill for Prisma schema, migration, seed, environment, and deployment work in this repository, including prisma/schema.prisma, migrations, Vercel or Supabase deployment settings, and database-shape changes that may require backfill or validation.
---

# Police Prisma Deploy

## Overview

Use this skill when a task changes database structure, Prisma behavior, or deployment wiring for this service. It is for schema edits, migrations, seed updates, Prisma generation, environment variables, and production deployment implications.

## Trigger Cues

Use this skill when the request mentions any of these:

- Prisma schema, migration, seed, db push, migrate deploy
- Vercel, Supabase, DATABASE_URL, DIRECT_URL, build pipeline
- unique constraint, non-null column, backfill, data integrity
- files under `prisma/`, `src/lib/prisma.ts`, `vercel.json`, `package.json`

## Primary Files

- `prisma/schema.prisma`
- `prisma/migrations/**`
- `prisma/seed.ts`
- `src/lib/prisma.ts`
- `docs/DEPLOY_VERCEL_SUPABASE.md`
- `package.json`
- `vercel.json`
- `.env.example`

## Workflow

1. Decide the class of change before editing.
   - schema-only
   - migration plus data backfill
   - deployment or environment wiring
2. Check blast radius of every schema change.
   - new required columns
   - changed unique constraints
   - renamed enums or fields
   - existing data compatibility
3. Prefer additive migrations over risky in-place rewrites.
4. If a field becomes required, define how existing rows remain valid.
5. Re-check build and generate sequence after editing.

## Invariants

- Do not edit old applied migrations unless the user explicitly asks for history rewriting.
- Preserve core uniqueness rules unless the business requirement clearly changes them.
  - user plus exam uniqueness
  - exam plus region plus exam number uniqueness
- Keep Prisma client generation compatible with the build scripts in `package.json`.
- Call out environment-variable impact explicitly when a task changes deployment behavior.

## Validation

Run these when relevant and feasible:

- `npm run prisma:generate`
- `npm run build`
- `npm run verify:calculations` if schema changes affect scoring or prediction data

## Response Checklist

- State whether the task needed a migration, a backfill, or only code changes.
- State whether deployment or env vars are affected.
- State which verification commands ran and which were skipped.
