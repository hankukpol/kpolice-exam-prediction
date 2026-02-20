import bcrypt from "bcryptjs";
import { ExamType, PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

const regions = [
  { name: "서울", recruitCount: 715, recruitCountCareer: 0 },
  { name: "부산", recruitCount: 213, recruitCountCareer: 0 },
  { name: "대구", recruitCount: 92, recruitCountCareer: 0 },
  { name: "인천", recruitCount: 175, recruitCountCareer: 0 },
  { name: "광주", recruitCount: 37, recruitCountCareer: 0 },
  { name: "대전", recruitCount: 51, recruitCountCareer: 0 },
  { name: "울산", recruitCount: 22, recruitCountCareer: 0 },
  { name: "세종", recruitCount: 10, recruitCountCareer: 0 },
  { name: "경기남부", recruitCount: 609, recruitCountCareer: 0 },
  { name: "경기북부", recruitCount: 128, recruitCountCareer: 0 },
  { name: "강원", recruitCount: 140, recruitCountCareer: 0 },
  { name: "충북", recruitCount: 121, recruitCountCareer: 0 },
  { name: "충남", recruitCount: 152, recruitCountCareer: 0 },
  { name: "전북", recruitCount: 137, recruitCountCareer: 0 },
  { name: "전남", recruitCount: 176, recruitCountCareer: 0 },
  { name: "경북", recruitCount: 181, recruitCountCareer: 0 },
  { name: "경남", recruitCount: 196, recruitCountCareer: 0 },
  { name: "제주", recruitCount: 47, recruitCountCareer: 0 },
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
