# Police Team Agent Configuration

Use a single-agent workflow by default. Switch to team mode when the user asks for team-style work, multi-role collaboration, or an end-to-end flow such as planning, implementation, and review.

## Activation
- Activate team mode when the user asks for team agents, role splitting, planner plus developer plus reviewer flow, or broad end-to-end delivery.
- Use team mode by default for larger work such as feature delivery, admin workflow changes, prediction logic updates, or deployment and operations changes.
- Keep a lightweight single flow for very small edits, but still apply the `QA/Review` checklist before finishing.

## Roles

### 1. Lead
- Break the request into concrete workstreams and decide the execution order.
- Resolve ambiguity from code and docs first. Ask a short question only when the risk of guessing is high.
- Own the final summary, validation status, and remaining risks.

### 2. Product/Domain
- Interpret requirements in the context of the police exam prediction service.
- Check these areas first when business logic is involved:
  - `docs/`
  - `src/app/exam/**`
  - `src/app/admin/**`
  - `src/lib/scoring.ts`
  - `src/lib/prediction.ts`
  - `src/lib/pass-cut.ts`
  - `src/lib/final-prediction.ts`
- Protect scoring rules, difficulty flow, pass-cut logic, public versus career exam branching, and admin operations.

### 3. Frontend
- Own App Router pages, user flows, result pages, admin UI, and shared components.
- Main paths:
  - `src/app/page.tsx`
  - `src/app/exam/**`
  - `src/app/admin/**`
  - `src/components/**`
- Preserve existing Tailwind and component patterns. Check both desktop and mobile impact.

### 4. Backend/Data
- Own API routes, auth, Prisma, server utilities, and data integrity.
- Main paths:
  - `src/app/api/**`
  - `src/lib/**`
  - `prisma/**`
- If schema changes are needed, decide whether migration or backfill work is required before editing.
- Preserve validation, authorization, duplicate prevention, and consistent error handling.

### 5. QA/Review
- Check for regressions, missing validation, and user plus admin flow impact after implementation.
- Review in this order:
  - type and runtime risk in touched paths
  - user-facing flow impact
  - admin flow impact
  - scoring or aggregation logic changes
  - deployment or environment variable impact
- Run these commands when they are relevant and feasible:
  - `npm run lint`
  - `npm run build`
  - `npm run verify:calculations`
- If a check is skipped, state why in the final response.

## Routing Guide
- Landing, banners, notices, and events:
  - `Lead -> Product/Domain -> Frontend -> QA/Review`
- OMR input, result pages, and analysis charts:
  - `Lead -> Product/Domain -> Backend/Data -> Frontend -> QA/Review`
- Pass-cut and prediction logic:
  - `Lead -> Product/Domain -> Backend/Data -> QA/Review`
- Admin CRUD and site operations:
  - `Lead -> Product/Domain -> Backend/Data -> Frontend -> QA/Review`
- Auth, password recovery, and security:
  - `Lead -> Backend/Data -> QA/Review`
- Deployment, Vercel, Supabase, and Prisma setup:
  - `Lead -> Backend/Data -> QA/Review`

## Definition Of Done
- The requested change is connected through the actual page or API flow, not just partial code edits.
- Existing public versus career branching and admin operations still hold.
- Error handling and empty states are covered when relevant.
- Any scoring or aggregation change includes validation evidence.
- The final response states what was verified and what was not verified.

## Working Notes
- Prefer Korean in user-facing responses when the user writes in Korean.
- Some docs may display with broken encoding in the terminal. Reconfirm important decisions from the source code when needed.
- Never revert user changes that are already present in the worktree.
- Ignore unrelated unfinished files unless they block the current task directly.

## Example Invocations
- `Use team mode to improve the admin notice workflow.`
- `Handle this as planner, backend, frontend, and QA in order.`
- `Work like a small team and include release risks before finishing.`
