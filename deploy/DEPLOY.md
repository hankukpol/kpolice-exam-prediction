# 배포 가이드 (PM2 + Nginx)

## 1. 프로덕션 환경변수
프로젝트 루트의 `.env.production`을 생성하고 값을 입력합니다.

```env
DATABASE_URL="mysql://exam_user:CHANGE_ME@localhost:3306/police_exam_prediction?charset=utf8mb4"
NEXTAUTH_SECRET="CHANGE_ME_TO_LONG_RANDOM_SECRET"
NEXTAUTH_URL="https://daegu.koreapolice.co.kr/exam"
ADMIN_PHONE="010-0000-0000"
ADMIN_PASSWORD="CHANGE_ME"
```

## 2. 서버 배포
```bash
cd /opt/exam-police
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
```

## 3. PM2 실행
```bash
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup
pm2 status
```

## 4. Nginx 리버스 프록시
1. `deploy/nginx.exam.conf`를 서버 Nginx 설정으로 반영합니다.
2. 설정 테스트 후 재시작합니다.

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 5. 배포 확인 체크리스트
1. `https://daegu.koreapolice.co.kr/exam/` 접속
2. 회원가입 > 로그인 > `/exam/input` 제출
3. `/exam/result` > `/exam/prediction` > `/exam/comments` 이동
4. API 에러 발생 시 토스트 노출 확인
5. `pm2 logs police-exam` 및 Nginx 에러 로그 확인
