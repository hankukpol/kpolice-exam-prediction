---
name: police-admin-site-ops
description: Use this skill for admin 운영 changes in this repository, including 공지, 배너, 이벤트, FAQ, 사이트 설정, 관리자 CRUD, 공개 상태, 업로드, and admin API or page work under src/app/admin and src/app/api/admin.
---

# Police Admin Site Ops

## Overview

Use this skill for changes to the admin console and public site operations. It covers notices, banners, events, FAQs, site settings, uploads, admin-only routes, and release-style operational controls.

## Trigger Cues

Use this skill when the request mentions any of these:

- 관리자 페이지, 공지, 배너, 이벤트, FAQ, 사이트 설정
- 운영 노출, 공개 여부, 정렬, 업로드, HTML 배너
- admin route auth, 운영 도구, pass-cut release admin control
- files under `src/app/admin`, `src/app/api/admin`, `src/lib/site-settings.ts`, `src/lib/banners.ts`

## Primary Files

- `src/app/admin/**`
- `src/app/api/admin/**`
- `src/app/api/site-settings/route.ts`
- `src/app/api/notices/route.ts`
- `src/app/api/events/route.ts`
- `src/app/api/banners/route.ts`
- `src/lib/admin-auth.ts`
- `src/lib/admin-ip.ts`
- `src/lib/site-settings.ts`
- `src/lib/site-settings.constants.ts`
- `src/lib/banners.ts`
- `src/lib/sanitize-banner-html.ts`
- `src/lib/upload.ts`

## Workflow

1. Check the admin entrypoint and the matching public consumer together.
2. Verify authorization first.
   - Admin-only pages and routes must keep `requireAdminRoute` style protection
   - Do not rely only on hidden UI controls
3. Verify normalization and persistence.
   - settings payload normalization
   - upload path handling
   - reorder and publish state updates
4. Check user-visible impact.
   - landing page blocks
   - exam notices and banners
   - event cards and scheduling
5. If HTML content is involved, keep sanitization in place.

## Invariants

- Do not remove admin authorization or weaken role checks.
- Preserve banner HTML sanitization and upload safeguards.
- Public-facing consumers must handle missing or disabled content gracefully.
- When changing pass-cut release controls, also review the calculation or release service path that consumes them.

## Validation

Run these when relevant and feasible:

- `npm run build`

Manual checks matter here:

- admin CRUD path
- public visibility after save
- empty state and disabled state behavior

## Response Checklist

- State which admin area changed.
- State which public surface consumes the change.
- State whether auth, sanitization, or visibility rules were rechecked.
