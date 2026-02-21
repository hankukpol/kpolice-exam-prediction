import { ExamType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSiteSettingsUncached } from "@/lib/site-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUBJECT_ORDER: Record<ExamType, string[]> = {
  [ExamType.PUBLIC]: ["헌법", "형사법", "경찰학"],
  [ExamType.CAREER]: ["범죄학", "형사법", "경찰학"],
};

const REGION_ORDER = [
  "강원",
  "경기남부",
  "경기북",
  "경남",
  "경북",
  "광주",
  "대구",
  "대전",
  "부산",
  "서울",
  "101경비단",
  "세종",
  "울산",
  "인천",
  "전남",
  "전북",
  "충남",
  "충북",
  "제주",
] as const;

function regionOrderOf(name: string): number {
  const index = REGION_ORDER.findIndex((keyword) => name.includes(keyword));
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function sortSubjectsByRule(
  examType: ExamType,
  subjects: Array<{
    id: number;
    name: string;
    questionCount: number;
    pointPerQuestion: number;
    maxScore: number;
  }>
) {
  const order = SUBJECT_ORDER[examType];
  return [...subjects].sort((a, b) => {
    const aIndex = order.indexOf(a.name);
    const bIndex = order.indexOf(b.name);
    const safeA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
    const safeB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
    if (safeA !== safeB) return safeA - safeB;
    return a.id - b.id;
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("active") === "true";

  const exams = await prisma.exam.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: [{ isActive: "desc" }, { examDate: "desc" }, { id: "desc" }],
    select: {
      id: true,
      name: true,
      year: true,
      round: true,
      examDate: true,
      isActive: true,
    },
  });

  const activeExam = exams.find((exam) => exam.isActive) ?? null;

  const [regionsRaw, publicSubjectsRaw, careerSubjectsRaw, settings] = await Promise.all([
    prisma.region.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        isActive: true,
        recruitCount: true,
        recruitCountCareer: true,
      },
    }),
    prisma.subject.findMany({
      where: { examType: ExamType.PUBLIC },
      select: {
        id: true,
        name: true,
        questionCount: true,
        pointPerQuestion: true,
        maxScore: true,
      },
    }),
    prisma.subject.findMany({
      where: { examType: ExamType.CAREER },
      select: {
        id: true,
        name: true,
        questionCount: true,
        pointPerQuestion: true,
        maxScore: true,
      },
    }),
    getSiteSettingsUncached(),
  ]);

  const careerExamEnabled = Boolean(settings["site.careerExamEnabled"] ?? true);
  const regions = [...regionsRaw].sort((a, b) => {
    const orderA = regionOrderOf(a.name);
    const orderB = regionOrderOf(b.name);
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name, "ko-KR");
  });
  const publicSubjects = sortSubjectsByRule(ExamType.PUBLIC, publicSubjectsRaw);
  const careerSubjects = careerExamEnabled
    ? sortSubjectsByRule(ExamType.CAREER, careerSubjectsRaw)
    : [];

  return NextResponse.json({
    exams,
    activeExam,
    careerExamEnabled,
    regions,
    subjectGroups: {
      PUBLIC: publicSubjects,
      CAREER: careerSubjects,
    },
  });
}
