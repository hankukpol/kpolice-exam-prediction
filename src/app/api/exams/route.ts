import { ExamType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const SUBJECT_ORDER: Record<ExamType, string[]> = {
  [ExamType.PUBLIC]: ["헌법", "형사법", "경찰학"],
  [ExamType.CAREER]: ["범죄학", "형사법", "경찰학"],
};

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

  const [regions, publicSubjectsRaw, careerSubjectsRaw] = await Promise.all([
    prisma.region.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
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
  ]);

  const publicSubjects = sortSubjectsByRule(ExamType.PUBLIC, publicSubjectsRaw);
  const careerSubjects = sortSubjectsByRule(ExamType.CAREER, careerSubjectsRaw);

  return NextResponse.json({
    exams,
    activeExam,
    regions,
    subjectGroups: {
      PUBLIC: publicSubjects,
      CAREER: careerSubjects,
    },
  });
}
