---
name: police-scoring-prediction
description: Use this skill for police exam calculation changes in this repository, including 점수 계산, 가산점, 과락, 재채점, 합격예측, pass-cut, 컷라인 공개, and final prediction updates touching src/lib/scoring.ts, prediction.ts, pass-cut.ts, or final-prediction.ts.
---

# Police Scoring Prediction

## Overview

Use this skill when a request changes how scores are calculated or interpreted for the police exam service. It covers written scoring, bonus handling, failed-subject cutoff logic, live prediction, pass-cut tables, release flows, and final ranking calculations.

## Trigger Cues

Use this skill when the request mentions any of these:

- 점수 계산, 채점, 재채점, 과락, 가산점
- 합격예측, 컷라인, 배수, 경쟁률, pass-cut, final prediction
- answer key changes, ranking changes, tie logic, rounding changes
- files under `src/lib/scoring.ts`, `src/lib/prediction.ts`, `src/lib/pass-cut.ts`, `src/lib/final-prediction.ts`

## Primary Files

- `src/lib/scoring.ts`
- `src/lib/prediction.ts`
- `src/lib/pass-cut.ts`
- `src/lib/final-prediction.ts`
- `src/lib/pass-cut-release.service.ts`
- `src/lib/pass-cut-auto-release.ts`
- `src/lib/correct-rate.ts`
- `src/app/api/prediction/route.ts`
- `src/app/api/final-prediction/route.ts`
- `src/app/api/admin/pass-cut-release/route.ts`
- `scripts/verify-calculations.ts`

## Workflow

1. Identify which layer is changing.
   - Written scoring and rescore
   - Live prediction and competitor ranking
   - Pass-cut table generation and release timing
   - Final prediction and 75-point ranking
2. Trace the calculation from API or page entrypoint into the library function and back to stored or returned values.
3. Preserve current grouping rules.
   - Ranking is scoped by `regionId` and `examType`
   - Public and career flows stay separate
   - Suspicious or failed submissions are excluded where current code excludes them
4. Check rounding and tie behavior before editing.
   - The code rounds to 2 decimals in several places
   - Equal-score ranks and cut-score lookup are intentional
5. If the request changes business rules, update validation evidence as part of the same task.

## Invariants

- Do not change the public versus career subject composition without checking `SUBJECT_RULES` and the active subject data together.
- Do not change `getPassMultiple`, likely multiple logic, or small recruit-count special cases casually. These affect every downstream prediction view.
- Keep bonus handling aligned across written score, final score, and final ranking.
- Preserve unique grouping assumptions around `regionId`, `examType`, and recruit count.
- When docs and code disagree, trust the current code path first and document the discrepancy in the final response.

## Validation

Run these when relevant and feasible:

- `npm run verify:calculations`
- `npm run build`

If the change touches only one layer, still sanity-check the adjacent layer that consumes it.

## Response Checklist

- State which calculation layer changed.
- State which business rule was preserved or intentionally changed.
- State which verification command ran and which did not run.
