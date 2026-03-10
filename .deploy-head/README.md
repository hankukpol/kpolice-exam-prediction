# Police Exam Prediction

Next.js + Prisma 기반 서비스입니다. 현재 배포 기준은 `Vercel + Supabase(PostgreSQL + Storage)` 입니다.

## Local Setup

1. 환경변수 파일 생성
```bash
cp .env.example .env
```

2. 의존성 설치
```bash
npm install
```

3. Prisma 클라이언트 생성 및 스키마 반영
```bash
npm run prisma:generate
npm run prisma:push
```

4. 시드 데이터 입력(선택)
```bash
npm run prisma:seed
```

5. 개발 서버 실행
```bash
npm run dev
```

## Required Environment Variables

- `DATABASE_URL`: Supabase Postgres 연결 문자열
- `NEXTAUTH_SECRET`: NextAuth JWT 서명 키
- `NEXTAUTH_URL`: 서비스 URL
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase 프로젝트 URL
- `SUPABASE_URL`: 서버용 Supabase URL (보통 `NEXT_PUBLIC_SUPABASE_URL`와 동일)
- `SUPABASE_SERVICE_ROLE_KEY`: Storage 업로드/삭제용 키(서버 전용)
- `SUPABASE_STORAGE_BUCKET`: Storage 버킷명(기본 `uploads`)
- `CRON_SECRET` 또는 `AUTO_PASSCUT_CRON_SECRET`: 자동 발표 크론 인증 키

## Vercel Deploy

1. Vercel 프로젝트 생성 및 이 저장소 연결
2. 위 환경변수 등록
3. Supabase에서 `uploads` 버킷(공개 버킷) 생성
4. 배포 후 `POST/GET /api/internal/pass-cut-auto-release` 크론 인증 동작 확인

## Notes

- 파일 업로드는 로컬 디스크가 아니라 Supabase Storage를 사용합니다.
- Prisma 마이그레이션 파일은 제거되었으며, 현재는 `prisma db push` 방식으로 스키마를 맞춥니다.
