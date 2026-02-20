import bcrypt from "bcryptjs";
import { ExamType, PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

// recruitCountCareer is seeded with the same values as recruitCount by default.
// Update these values to official CAREER quotas for each region before production use.
const regions = [
  { name: "서울", recruitCount: 715, recruitCountCareer: 715 },
  { name: "부산", recruitCount: 213, recruitCountCareer: 213 },
  { name: "대구", recruitCount: 92, recruitCountCareer: 92 },
  { name: "인천", recruitCount: 175, recruitCountCareer: 175 },
  { name: "광주", recruitCount: 37, recruitCountCareer: 37 },
  { name: "대전", recruitCount: 51, recruitCountCareer: 51 },
  { name: "울산", recruitCount: 22, recruitCountCareer: 22 },
  { name: "세종", recruitCount: 10, recruitCountCareer: 10 },
  { name: "경기남부", recruitCount: 609, recruitCountCareer: 609 },
  { name: "경기북부", recruitCount: 128, recruitCountCareer: 128 },
  { name: "강원", recruitCount: 140, recruitCountCareer: 140 },
  { name: "충북", recruitCount: 121, recruitCountCareer: 121 },
  { name: "충남", recruitCount: 152, recruitCountCareer: 152 },
  { name: "전북", recruitCount: 137, recruitCountCareer: 137 },
  { name: "전남", recruitCount: 176, recruitCountCareer: 176 },
  { name: "경북", recruitCount: 181, recruitCountCareer: 181 },
  { name: "경남", recruitCount: 196, recruitCountCareer: 196 },
  { name: "제주", recruitCount: 47, recruitCountCareer: 47 },
];

const subjects = [
  {
    name: "헌법",
    examType: ExamType.PUBLIC,
    questionCount: 20,
    pointPerQuestion: 2.5,
    maxScore: 50,
  },
  {
    name: "형사법",
    examType: ExamType.PUBLIC,
    questionCount: 40,
    pointPerQuestion: 2.5,
    maxScore: 100,
  },
  {
    name: "경찰학",
    examType: ExamType.PUBLIC,
    questionCount: 40,
    pointPerQuestion: 2.5,
    maxScore: 100,
  },
  {
    name: "범죄학",
    examType: ExamType.CAREER,
    questionCount: 20,
    pointPerQuestion: 2.5,
    maxScore: 50,
  },
  {
    name: "형사법",
    examType: ExamType.CAREER,
    questionCount: 40,
    pointPerQuestion: 2.5,
    maxScore: 100,
  },
  {
    name: "경찰학",
    examType: ExamType.CAREER,
    questionCount: 40,
    pointPerQuestion: 2.5,
    maxScore: 100,
  },
];

const siteSettings = [
  { key: "site.title", value: "경찰 필기 합격예측" },
  { key: "site.heroBadge", value: "2026년 경찰 1차 필기시험 합격예측" },
  { key: "site.heroTitle", value: "OMR 입력부터 합격권 예측까지\n한 번에 확인하세요." },
  {
    key: "site.heroSubtitle",
    value:
      "응시정보와 OMR 답안을 입력하면 과목별 분석, 석차, 배수 위치, 합격권 등급을 실시간으로 제공합니다.",
  },
  {
    key: "site.footerDisclaimer",
    value:
      "면책조항: 본 서비스는 수험생의 자기 점검을 위한 참고용 분석 도구이며, 실제 합격 여부를 보장하지 않습니다. 최종 선발 결과는 경찰청 및 지역청 공식 공고를 반드시 확인해 주세요.",
  },
  { key: "site.bannerImageUrl", value: "" },
  { key: "site.bannerLink", value: "" },
  { key: "site.maintenanceMode", value: "false" },
  { key: "site.maintenanceMessage", value: "시스템 점검 중입니다." },
];

const noticeSamples = [
  {
    title: "시험일: 2026.3.14(토)",
    content: "합격발표: 2026.3.20(금) 17:00",
    isActive: true,
    priority: 1,
  },
];

async function main() {
  const adminPhone = process.env.ADMIN_PHONE ?? "010-0000-0000";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin1234!";
  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { phone: adminPhone },
    update: {
      name: "시스템 관리자",
      phone: adminPhone,
      password: hashedPassword,
      role: Role.ADMIN,
    },
    create: {
      name: "시스템 관리자",
      phone: adminPhone,
      password: hashedPassword,
      role: Role.ADMIN,
    },
  });

  await prisma.exam.upsert({
    where: {
      year_round: {
        year: 2026,
        round: 1,
      },
    },
    update: {
      name: "2026년 제1차 경찰공무원(순경) 채용시험",
      examDate: new Date("2026-03-14T10:00:00+09:00"),
      isActive: true,
    },
    create: {
      name: "2026년 제1차 경찰공무원(순경) 채용시험",
      year: 2026,
      round: 1,
      examDate: new Date("2026-03-14T10:00:00+09:00"),
      isActive: true,
    },
  });

  for (const region of regions) {
    await prisma.region.upsert({
      where: { name: region.name },
      update: region,
      create: region,
    });
  }

  for (const subject of subjects) {
    await prisma.subject.upsert({
      where: {
        name_examType: {
          name: subject.name,
          examType: subject.examType,
        },
      },
      update: subject,
      create: subject,
    });
  }

  for (const setting of siteSettings) {
    await prisma.siteSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }

  for (const notice of noticeSamples) {
    const existingNotice = await prisma.notice.findFirst({
      where: { title: notice.title },
      select: { id: true },
    });

    if (existingNotice) {
      await prisma.notice.update({
        where: { id: existingNotice.id },
        data: {
          content: notice.content,
          isActive: notice.isActive,
          priority: notice.priority,
        },
      });
    } else {
      await prisma.notice.create({ data: notice });
    }
  }

  console.log("기본 데이터 시딩이 완료되었습니다.");
  console.log(`관리자 연락처: ${adminPhone}`);
  console.log("관리자 비밀번호는 .env의 ADMIN_PASSWORD 값을 사용합니다.");
}

main()
  .catch((error) => {
    console.error("시딩 중 오류가 발생했습니다.", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
