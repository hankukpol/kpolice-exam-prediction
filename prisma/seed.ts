import bcrypt from "bcryptjs";
import { ExamType, PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

const regions = [
  "서울", "101경비단", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기남부", "경기북부", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

// 2026년 1차 시험 기준 지역별 모집인원 (ExamRegionQuota 시딩용)
// recruitCountCareer 값은 공식 경행경채 인원 확정 전까지 공채와 동일 값 사용
const regionQuotas = [
  { regionName: "서울", recruitCount: 715, recruitCountCareer: 715 },
  { regionName: "101경비단", recruitCount: 40, recruitCountCareer: 0 },
  { regionName: "부산", recruitCount: 213, recruitCountCareer: 213 },
  { regionName: "대구", recruitCount: 92, recruitCountCareer: 92 },
  { regionName: "인천", recruitCount: 175, recruitCountCareer: 175 },
  { regionName: "광주", recruitCount: 37, recruitCountCareer: 37 },
  { regionName: "대전", recruitCount: 51, recruitCountCareer: 51 },
  { regionName: "울산", recruitCount: 22, recruitCountCareer: 22 },
  { regionName: "세종", recruitCount: 10, recruitCountCareer: 10 },
  { regionName: "경기남부", recruitCount: 609, recruitCountCareer: 609 },
  { regionName: "경기북부", recruitCount: 128, recruitCountCareer: 128 },
  { regionName: "강원", recruitCount: 140, recruitCountCareer: 140 },
  { regionName: "충북", recruitCount: 121, recruitCountCareer: 121 },
  { regionName: "충남", recruitCount: 152, recruitCountCareer: 152 },
  { regionName: "전북", recruitCount: 137, recruitCountCareer: 137 },
  { regionName: "전남", recruitCount: 176, recruitCountCareer: 176 },
  { regionName: "경북", recruitCount: 181, recruitCountCareer: 181 },
  { regionName: "경남", recruitCount: 196, recruitCountCareer: 196 },
  { regionName: "제주", recruitCount: 47, recruitCountCareer: 47 },
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
  { key: "site.careerExamEnabled", value: "true" },
  { key: "site.mainPageAutoRefresh", value: "true" },
  { key: "site.mainPageRefreshInterval", value: "60" },
];

const noticeSamples = [
  {
    title: "시험일: 2026.3.14(토)",
    content: "합격발표: 2026.3.20(금) 17:00",
    isActive: true,
    priority: 1,
  },
];

const faqSamples = [
  {
    question: "응시자 정보(직렬, 지역, 가산점) 입력을 잘못했는데 수정이 가능한가요?",
    answer:
      "답안 제출 전에는 입력 화면에서 수정할 수 있습니다. 제출 후에는 결과 화면의 답안 수정 기능(관리자 설정 제한 내)으로 수정 가능합니다.",
    isActive: true,
    priority: 100,
  },
  {
    question: "채점하기에서 마킹을 잘못했는데 수정이 가능한가요?",
    answer:
      "가능합니다. 제출 이후 결과 화면에서 답안 수정 버튼을 눌러 다시 제출하면 최신 답안으로 재채점됩니다.",
    isActive: true,
    priority: 90,
  },
  {
    question: "합격예측은 필기합격, 최종합격 중 어떤 기준인가요?",
    answer:
      "본 서비스의 합격예측은 필기시험 기준 참고 지표입니다. 최종 합격 여부는 체력·면접·신원조회 등 공식 전형 결과를 확인해야 합니다.",
    isActive: true,
    priority: 80,
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

  for (const regionName of regions) {
    await prisma.region.upsert({
      where: { name: regionName },
      update: {},
      create: { name: regionName },
    });
  }

  // ExamRegionQuota 시딩: 활성 시험 × 지역별 모집인원
  const activeExam = await prisma.exam.findFirst({
    where: { isActive: true },
    select: { id: true },
  });

  if (activeExam) {
    for (const quota of regionQuotas) {
      const region = await prisma.region.findUnique({
        where: { name: quota.regionName },
        select: { id: true },
      });
      if (!region) continue;

      await prisma.examRegionQuota.upsert({
        where: {
          examId_regionId: {
            examId: activeExam.id,
            regionId: region.id,
          },
        },
        update: {
          recruitCount: quota.recruitCount,
          recruitCountCareer: quota.recruitCountCareer,
        },
        create: {
          examId: activeExam.id,
          regionId: region.id,
          recruitCount: quota.recruitCount,
          recruitCountCareer: quota.recruitCountCareer,
        },
      });
    }
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

  for (const faq of faqSamples) {
    const existingFaq = await prisma.faq.findFirst({
      where: { question: faq.question },
      select: { id: true },
    });

    if (existingFaq) {
      await prisma.faq.update({
        where: { id: existingFaq.id },
        data: {
          answer: faq.answer,
          isActive: faq.isActive,
          priority: faq.priority,
        },
      });
    } else {
      await prisma.faq.create({ data: faq });
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
