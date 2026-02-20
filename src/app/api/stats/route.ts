import { ExamType, Gender } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const examIdParam = searchParams.get("examId");
  const requestedExamId =
    examIdParam && Number.isInteger(Number(examIdParam)) ? Number(examIdParam) : null;

  const exam = requestedExamId
    ? await prisma.exam.findUnique({
        where: { id: requestedExamId },
      })
    : await prisma.exam.findFirst({
        where: { isActive: true },
        orderBy: [{ examDate: "desc" }, { id: "desc" }],
      });

  if (!exam) {
    return NextResponse.json({ error: "통계를 조회할 시험이 없습니다." }, { status: 404 });
  }

  const [totalParticipants, byExamTypeRaw, byGenderRaw, byRegionRaw, submissions] =
    await Promise.all([
      prisma.submission.count({
        where: { examId: exam.id },
      }),
      prisma.submission.groupBy({
        by: ["examType"],
        where: { examId: exam.id },
        _count: {
          _all: true,
        },
      }),
      prisma.submission.groupBy({
        by: ["gender"],
        where: { examId: exam.id },
        _count: {
          _all: true,
        },
      }),
      prisma.submission.groupBy({
        by: ["regionId", "examType"],
        where: { examId: exam.id },
        _count: {
          _all: true,
        },
      }),
      prisma.submission.findMany({
        where: { examId: exam.id },
        select: {
          createdAt: true,
        },
      }),
    ]);

  const regions = await prisma.region.findMany({
    orderBy: { name: "asc" },
  });
  const regionNameById = new Map(regions.map((region) => [region.id, region.name] as const));

  const byExamType = {
    [ExamType.PUBLIC]: 0,
    [ExamType.CAREER]: 0,
  };
  for (const item of byExamTypeRaw) {
    byExamType[item.examType] = item._count._all;
  }

  const byGender = {
    [Gender.MALE]: 0,
    [Gender.FEMALE]: 0,
  };
  for (const item of byGenderRaw) {
    byGender[item.gender] = item._count._all;
  }

  const byRegionMap = new Map<
    number,
    { regionId: number; regionName: string; publicCount: number; careerCount: number; total: number }
  >();

  for (const item of byRegionRaw) {
    const existing = byRegionMap.get(item.regionId) ?? {
      regionId: item.regionId,
      regionName: regionNameById.get(item.regionId) ?? "알 수 없음",
      publicCount: 0,
      careerCount: 0,
      total: 0,
    };

    if (item.examType === ExamType.PUBLIC) {
      existing.publicCount += item._count._all;
    } else {
      existing.careerCount += item._count._all;
    }
    existing.total += item._count._all;
    byRegionMap.set(item.regionId, existing);
  }

  const submissionsByDateMap = new Map<string, number>();
  for (const submission of submissions) {
    const dateKey = toDateKey(submission.createdAt);
    submissionsByDateMap.set(dateKey, (submissionsByDateMap.get(dateKey) ?? 0) + 1);
  }

  const submissionsByDate = Array.from(submissionsByDateMap.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, count]) => ({ date, count }));

  return NextResponse.json({
    exam: {
      id: exam.id,
      name: exam.name,
      year: exam.year,
      round: exam.round,
      examDate: exam.examDate,
      isActive: exam.isActive,
    },
    totalParticipants,
    byExamType: {
      PUBLIC: byExamType[ExamType.PUBLIC],
      CAREER: byExamType[ExamType.CAREER],
    },
    byGender: {
      MALE: byGender[Gender.MALE],
      FEMALE: byGender[Gender.FEMALE],
    },
    byRegion: Array.from(byRegionMap.values()).sort((a, b) => b.total - a.total),
    submissionsByDate,
  });
}
