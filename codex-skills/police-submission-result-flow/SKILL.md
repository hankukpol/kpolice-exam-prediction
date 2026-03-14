---
name: police-submission-result-flow
description: Use this skill for user submission and result-flow work in this repository, including OMR 입력, 답안 제출, 사전등록 연동, 결과 페이지, 성적분석 API, and changes touching src/app/exam/input, src/app/api/submission, src/app/exam/result, or src/app/api/analysis.
---

# Police Submission Result Flow

## Overview

Use this skill when a task changes the user path from answer entry to stored submission to result and analysis screens. It covers OMR input modes, request payload shape, submission validation, persistence, and result-page data contracts.

## Trigger Cues

Use this skill when the request mentions any of these:

- OMR 입력, 빠른입력, 라디오 입력, 답안 수정
- 제출 API, 응답 형식, 결과 페이지, 성적분석 차트
- exam number validation, region validation, edit flow, pre-registration
- files under `src/app/exam/input`, `src/app/api/submission`, `src/app/exam/result`, `src/app/api/analysis`

## Primary Files

- `src/app/exam/input/page.tsx`
- `src/components/exam/QuickOmrInput.tsx`
- `src/components/exam/RadioOmrInput.tsx`
- `src/components/exam/OmrInputModeToggle.tsx`
- `src/app/api/submission/route.ts`
- `src/app/api/result/route.ts`
- `src/app/exam/result/page.tsx`
- `src/app/exam/result/components/**`
- `src/app/api/analysis/**`
- `src/lib/answer-validation.ts`
- `src/lib/pre-registration.ts`
- `src/lib/exam-utils.ts`
- `src/lib/scoring.ts`

## Workflow

1. Trace the full path before editing.
   - Input UI state
   - Request payload
   - API parsing and validation
   - Prisma writes
   - Result-query read path
2. Preserve shared state assumptions.
   - Quick and radio OMR modes must map to the same answer data
   - Public and career subject branching must stay aligned with active subjects
3. Check duplicate-prevention and identity rules.
   - `examNumber` uniqueness by exam and region
   - user-level submission limits and edit limits
   - pre-registration handoff behavior
4. If an API response shape changes, update every consumer in the same task.
5. Re-check empty states and partial-data handling on the result page.

## Invariants

- Do not weaken server-side validation because the client already validates it.
- Preserve rate-limit, session, and duplicate-prevention behavior in submission routes.
- Keep request and response types in sync with the actual page usage.
- If scoring changes during this task, also apply the `police-scoring-prediction` workflow.

## Validation

Run these when relevant and feasible:

- `npm run build`
- `npm run verify:calculations` when score-related values change

Manual checks are important for this skill:

- desktop and mobile input mode behavior
- submit, edit, and result navigation
- public versus career branch behavior

## Response Checklist

- State which user flow entrypoint changed.
- State whether request or response payloads changed.
- State what was verified manually and what was not verified.
