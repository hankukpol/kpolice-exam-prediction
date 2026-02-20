import { ExamType, Gender } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { consumeFixedWindowRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

export const runtime = "nodejs";

const STATS_REQUEST_WINDOW_MS = 60 * 1000;
const STATS_REQUEST_LIMIT_PER_IP = 30;

function parseExamId(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toCount(value: bigint | number | null | undefined): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return 0;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminRoute();
  if (auth.error) {
    return auth.error;
  }

  const ip = getClientIp(request);
  const rateLimit = consumeFixedWindowRateLimit({
    namespace: "stats-api-ip",
    key: ip,
    limit: STATS_REQUEST_LIMIT_PER_IP,
    windowMs: STATS_REQUEST_WINDOW_MS,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSec),
        },
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const requestedExamId = parseExamId(searchParams.get("examId"));

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

  const [
    totalParticipants,
    byExamTypeRaw,
    byGenderRaw,
    byRegionRaw,
    regions,
    submissionsByDateRaw,
  ] = await Promise.all([
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
    prisma.region.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.$queryRaw<Array<{ date: string; count: bigint | number }>>`
      SELECT DATE_FORMAT(createdAt, '%Y-%m-%d') AS date, COUNT(*) AS count
      FROM Submission
      WHERE examId = ${exam.id}
      GROUP BY DATE(createdAt)
      ORDER BY DATE(createdAt)
    `,
  ]);

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

  const submissionsByDate = submissionsByDateRaw.map((item) => ({
    date: item.date,
    count: toCount(item.count),
  }));

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
