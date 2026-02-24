# 로컬 개발 및 배포 가이드 (Vercel + Supabase)

## 전체 흐름 요약

```
코드 수정 → 로컬 테스트 (npm run dev) → 타입 체크 → Vercel 배포
                                          ↓ (DB 스키마 변경 시)
                                   prisma migrate dev → Vercel 배포
```

---

## 1. 로컬 개발 환경

### 1-1. 개발 서버 실행

```bash
cd police
npm run dev
```

- `http://localhost:3000` 에서 확인
- `.env.local`의 Supabase DB에 연결된 상태로 실행됨
- 코드 수정 시 자동 핫 리로드 (저장하면 즉시 반영)

> **주의**: 로컬 개발 서버도 실제 Supabase DB에 연결되므로, 데이터 삭제/수정 등은 실제 데이터에 영향을 줍니다.

### 1-2. 테스트 계정

| 구분 | 전화번호 | 비밀번호 |
|------|---------|---------|
| 관리자 | 010-0000-0000 | Admin2026! |
| 일반 사용자 | 회원가입으로 생성 | - |

---

## 2. 코드 수정 후 배포 절차

### 2-1. 코드만 수정한 경우 (DB 변경 없음)

```bash
# 1단계: 로컬에서 테스트
npm run dev
# → http://localhost:3000 에서 수정 사항 확인

# 2단계: 타입 체크 (오류 없는지 확인)
npx tsc --noEmit

# 3단계: 빌드 테스트 (선택, 배포 전 확인하고 싶을 때)
npm run build

# 4단계: Vercel 프로덕션 배포
npx vercel --prod --yes
```

### 2-2. DB 스키마도 변경한 경우

```bash
# 1단계: prisma/schema.prisma 수정

# 2단계: 마이그레이션 실행 (Supabase DB에 즉시 반영)
npx prisma migrate dev --name 변경내용_설명

# 3단계: 로컬에서 테스트
npm run dev

# 4단계: 타입 체크
npx tsc --noEmit

# 5단계: Vercel 프로덕션 배포
npx vercel --prod --yes
```

### 2-3. 시드 데이터 변경 시

```bash
# 시드 데이터 재입력 (기존 데이터 초기화 주의!)
npx prisma db seed
```

---

## 3. Vercel 설정

### 3-1. 환경 변수 목록

Vercel 프로젝트에 설정된 환경 변수:

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `DATABASE_URL` | Supabase 트랜잭션 풀러 (포트 6543) | `postgresql://postgres.xxx:pw@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require` |
| `DIRECT_URL` | Supabase 세션 풀러 (포트 5432, 마이그레이션용) | `postgresql://postgres.xxx:pw@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require` |
| `NEXTAUTH_SECRET` | NextAuth 암호화 키 | 랜덤 문자열 |
| `NEXTAUTH_URL` | 서비스 URL | `https://police-sandy.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | `https://xxx.supabase.co` |
| `SUPABASE_URL` | Supabase 프로젝트 URL (서버용) | 위와 동일 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서비스 역할 키 | `eyJ...` |
| `CRON_SECRET` | Vercel Cron 인증 키 | 랜덤 문자열 |
| `ADMIN_PHONE` | 관리자 전화번호 (시드용) | `010-0000-0000` |
| `ADMIN_PASSWORD` | 관리자 비밀번호 (시드용) | `Admin2026!` |

### 3-2. 환경 변수 추가/수정 방법

```bash
# 환경 변수 목록 확인
npx vercel env ls

# 새 환경 변수 추가 (대화형)
npx vercel env add 변수명

# 주의: 값 입력 시 printf 사용 (echo는 줄바꿈 추가됨)
printf "값" | npx vercel env add 변수명 production
```

### 3-3. 배포 명령어

```bash
# 프로덕션 배포
npx vercel --prod --yes

# 프리뷰 배포 (테스트용, 별도 URL 생성)
npx vercel --yes

# 배포 로그 확인
npx vercel logs police-sandy.vercel.app
```

### 3-4. vercel.json 설정

```json
{
  "regions": ["icn1"],
  "crons": [
    {
      "path": "/api/internal/pass-cut-auto-release",
      "schedule": "0 0 * * *"
    }
  ]
}
```

- `regions: ["icn1"]` — 서울 리전에서 서버리스 함수 실행 (DB가 서울에 있으므로 지연 최소화)
- `crons` — 매일 자정 합격컷 자동 발표 체크

---

## 4. Supabase 설정

### 4-1. 프로젝트 정보

- **프로젝트 URL**: `https://qsdufgjxepzvgkrcumcq.supabase.co`
- **DB 리전**: `ap-northeast-2` (서울)
- **풀러 호스트**: `aws-1-ap-northeast-2.pooler.supabase.com`

### 4-2. DB 연결 방식

| 용도 | 포트 | 풀링 모드 | URL 파라미터 |
|------|------|---------|-------------|
| **런타임** (API 실행) | 6543 | Transaction | `?pgbouncer=true&sslmode=require` |
| **마이그레이션** (스키마 변경) | 5432 | Session | `?sslmode=require` |

### 4-3. Prisma 스키마의 DB 설정

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")      // 트랜잭션 풀러 (6543)
  directUrl = env("DIRECT_URL")        // 세션 풀러 (5432) - 마이그레이션용
}
```

### 4-4. Prisma 주요 명령어

```bash
# DB 스키마 마이그레이션 (변경 적용)
npx prisma migrate dev --name 변경내용

# Prisma Client 재생성 (타입 변경 후)
npx prisma generate

# DB GUI 브라우저
npx prisma studio

# 시드 데이터 입력
npx prisma db seed

# 스키마를 DB에 강제 푸시 (마이그레이션 없이, 개발용)
npx prisma db push
```

---

## 5. MySQL → PostgreSQL 전환 시 주의사항

Supabase는 PostgreSQL을 사용하므로, MySQL 전용 문법이 있으면 수정이 필요합니다.

### 5-1. 이미 수정된 호환성 이슈

| 이슈 | MySQL | PostgreSQL (수정 후) |
|------|-------|---------------------|
| **Enum 비교** | `s."examType" = ${value}` | `s."examType"::text = ${value}` |
| **ROUND 함수** | `ROUND(AVG(col), 2)` | `ROUND(AVG(col)::numeric, 2)` |

### 5-2. 향후 주의할 패턴

```sql
-- PostgreSQL에서 ROUND에 소수점 자릿수 지정 시 반드시 ::numeric 캐스팅
ROUND(expression::numeric, 소수점자릿수)

-- Prisma raw SQL에서 Enum 컬럼과 문자열 비교 시 ::text 캐스팅
WHERE s."enumColumn"::text = ${stringValue}

-- PostgreSQL은 큰따옴표로 컬럼명 구분 (MySQL은 백틱)
SELECT "columnName" FROM "TableName"
```

---

## 6. 트러블슈팅

### 자주 발생하는 오류

| 오류 메시지 | 원인 | 해결 |
|------------|------|------|
| `P1001: Can't reach database server` | DB 연결 실패 | `.env`의 DATABASE_URL 확인, 풀러 호스트/포트 확인 |
| `operator does not exist: "EnumType" = text` | Enum 캐스팅 누락 | raw SQL에서 `::text` 캐스팅 추가 |
| `function round(double precision, integer) does not exist` | ROUND 타입 오류 | `::numeric` 캐스팅 추가 |
| `500 Internal Server Error` (Vercel) | 환경 변수 누락 또는 코드 오류 | `npx vercel logs` 로 상세 로그 확인 |
| 페이지/API 느림 | 서버 리전 불일치 | `vercel.json`의 `regions`를 `["icn1"]`으로 설정 |

### Vercel 로그 확인

```bash
# 최근 배포 로그 스트리밍
npx vercel logs police-sandy.vercel.app

# 특정 배포 상세 정보
npx vercel inspect [배포URL] --logs
```

---

## 7. 서비스 URL

| 환경 | URL |
|------|-----|
| **로컬 개발** | `http://localhost:3000` |
| **Vercel 프로덕션** | `https://police-sandy.vercel.app` |
| **Supabase 대시보드** | `https://supabase.com/dashboard` |
| **Vercel 대시보드** | `https://vercel.com/dashboard` |
