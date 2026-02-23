import { ExamType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface QuotaUpdateItem {
  regionId?: unknown;
  isActive?: unknown;
  recruitCount?: unknown;
  recruitCountCareer?: unknown;
  applicantCount?: unknown;
  applicantCountCareer?: unknown;
  examNumberStart?: unknown;
  examNumberEnd?: unknown;
}

interface QuotaUpdatePayload {
  examId?: unknown;
  regions?: QuotaUpdateItem[];
}

function parseNonNegativeInt(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0 ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  }

  return null;
}

function parseNullableNonNegativeInt(value: unknown): { ok: boolean; value: number | null } {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }

  const parsed = parseNonNegativeInt(value);
  if (parsed === null) {
    return { ok: false, value: null };
  }

  return { ok: true, value: parsed };
}

function parseBoolean(value: unknown): boolean | null | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }

  return null;
}

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function formatPassMultiple(recruitCount: number): string {
  if (recruitCount <= 0) return "-";
  if (recruitCount >= 150) return "1.5배";
  if (recruitCount >= 100) return "1.6배";
  if (recruitCount >= 50) return "1.7배";
  if (recruitCount >= 6) return "1.8배";

  const smallTable: Record<number, number> = { 5: 10, 4: 9, 3: 8, 2: 6, 1: 3 };
  const passCount = smallTable[recruitCount];
  if (!passCount) return "-";

  return `${(passCount / recruitCount).toFixed(1)}배`;
}

// GET: 시험 목록 + 선택된 시험의 지역별 모집인원 조회
// ?examId=N (없으면 활성 시험 자동 선택)
export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if ("error" in guard) return guard.error;

  try {
    // 시험 목록 조회
    const exams = await prisma.exam.findMany({
      orderBy: [{ isActive: "desc" }, { examDate: "desc" }],
      select: { id: true, name: true, year: true, round: true, isActive: true },
    });

    // examId 결정
    const examIdParam = request.nextUrl.searchParams.get("examId");
    let examId: number | null = null;

    if (examIdParam) {
      examId = parsePositiveInt(examIdParam);
    }

    if (!examId) {
      const activeExam = exams.find((e) => e.isActive);
      examId = activeExam?.id ?? exams[0]?.id ?? null;
    }

    // 지역 목록 조회
    const regions = await prisma.region.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: { id: true, name: true, isActive: true },
    });

    // 선택된 시험의 ExamRegionQuota 조회
    const quotas = examId
      ? await prisma.examRegionQuota.findMany({
          where: { examId },
          select: {
            regionId: true,
            recruitCount: true,
            recruitCountCareer: true,
            applicantCount: true,
            applicantCountCareer: true,
            examNumberStart: true,
            examNumberEnd: true,
          },
        })
      : [];

    const quotaByRegionId = new Map(quotas.map((q) => [q.regionId, q]));

    // 제출 통계 조회
    const groupedCounts = examId
      ? await prisma.submission.groupBy({
          by: ["regionId", "examType"],
          where: { examId },
          _count: { _all: true },
        })
      : [];

    const countByRegion = new Map<
      number,
      { total: number; publicCount: number; careerCount: number }
    >();

    for (const row of groupedCounts) {
      const existing = countByRegion.get(row.regionId) ?? {
        total: 0,
        publicCount: 0,
        careerCount: 0,
      };

      const count = row._count._all;
      existing.total += count;
      if (row.examType === ExamType.PUBLIC) {
        existing.publicCount += count;
      } else {
        existing.careerCount += count;
      }

      countByRegion.set(row.regionId, existing);
    }

    return NextResponse.json({
      exams,
      selectedExamId: examId,
      regions: regions.map((region) => {
        const quota = quotaByRegionId.get(region.id);
        const counts = countByRegion.get(region.id) ?? {
          total: 0,
          publicCount: 0,
          careerCount: 0,
        };

        return {
          id: region.id,
          name: region.name,
          isActive: region.isActive,
          recruitCount: quota?.recruitCount ?? 0,
          recruitCountCareer: quota?.recruitCountCareer ?? 0,
          applicantCount: quota?.applicantCount ?? null,
          applicantCountCareer: quota?.applicantCountCareer ?? null,
          passMultiplePublic: formatPassMultiple(quota?.recruitCount ?? 0),
          passMultipleCareer: formatPassMultiple(quota?.recruitCountCareer ?? 0),
          examNumberStart: quota?.examNumberStart ?? null,
          examNumberEnd: quota?.examNumberEnd ?? null,
          submissionCount: counts.total,
          submissionCountPublic: counts.publicCount,
          submissionCountCareer: counts.careerCount,
        };
      }),
    });
  } catch (error) {
    console.error("모집인원 목록 조회 중 오류가 발생했습니다.", error);
    return NextResponse.json({ error: "모집인원 목록 조회에 실패했습니다." }, { status: 500 });
  }
}

// PUT: 시험별 지역 모집인원 저장 (ExamRegionQuota upsert) + Region isActive 업데이트
export async function PUT(request: NextRequest) {
  const guard = await requireAdminRoute();
  if ("error" in guard) return guard.error;

  try {
    const body = (await request.json()) as QuotaUpdatePayload;

    const examId = parsePositiveInt(body.examId);
    if (!examId) {
      return NextResponse.json({ error: "유효한 시험 ID가 필요합니다." }, { status: 400 });
    }

    if (!Array.isArray(body.regions) || body.regions.length === 0) {
      return NextResponse.json({ error: "수정할 지역 데이터가 없습니다." }, { status: 400 });
    }

    // 시험 존재 확인
    const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { id: true } });
    if (!exam) {
      return NextResponse.json({ error: "존재하지 않는 시험입니다." }, { status: 404 });
    }

    const normalized = body.regions.map((item) => {
      const regionId = parsePositiveInt(item.regionId);
      const isActive = parseBoolean(item.isActive);
      const recruitCount = parseNonNegativeInt(item.recruitCount);
      const recruitCountCareer = parseNonNegativeInt(item.recruitCountCareer);
      const applicantCountParsed = parseNullableNonNegativeInt(item.applicantCount);
      const applicantCountCareerParsed = parseNullableNonNegativeInt(item.applicantCountCareer);

      const examNumberStart =
        typeof item.examNumberStart === "string" ? item.examNumberStart.trim() || null : null;
      const examNumberEnd =
        typeof item.examNumberEnd === "string" ? item.examNumberEnd.trim() || null : null;

      return {
        regionId,
        isActive,
        recruitCount,
        recruitCountCareer,
        applicantCount: applicantCountParsed.value,
        applicantCountCareer: applicantCountCareerParsed.value,
        applicantCountValid: applicantCountParsed.ok,
        applicantCountCareerValid: applicantCountCareerParsed.ok,
        examNumberStart,
        examNumberEnd,
      };
    });

    for (const row of normalized) {
      if (!row.regionId) {
        return NextResponse.json({ error: "유효한 지역 ID가 필요합니다." }, { status: 400 });
      }
      if (row.isActive === null) {
        return NextResponse.json({ error: "isActive 값이 올바르지 않습니다." }, { status: 400 });
      }
      if (row.recruitCount === null || row.recruitCountCareer === null) {
        return NextResponse.json({ error: "모집인원은 0 이상의 정수여야 합니다." }, { status: 400 });
      }
      if (!row.applicantCountValid || !row.applicantCountCareerValid) {
        return NextResponse.json({ error: "출원인원은 비워두거나 0 이상의 정수여야 합니다." }, { status: 400 });
      }
    }

    const uniqueIds = new Set<number>();
    for (const row of normalized) {
      const rowId = row.regionId as number;
      if (uniqueIds.has(rowId)) {
        return NextResponse.json({ error: "중복된 지역 ID가 포함되어 있습니다." }, { status: 400 });
      }
      uniqueIds.add(rowId);
    }

    // 지역 존재 확인
    const existingRegions = await prisma.region.findMany({
      where: { id: { in: Array.from(uniqueIds) } },
      select: { id: true },
    });

    if (existingRegions.length !== uniqueIds.size) {
      return NextResponse.json({ error: "존재하지 않는 지역 ID가 포함되어 있습니다." }, { status: 404 });
    }

    // 트랜잭션: Region isActive 업데이트 + ExamRegionQuota upsert
    const operations = normalized.flatMap((row) => {
      const regionId = row.regionId as number;
      const ops = [];

      // Region isActive 업데이트 (값이 있는 경우만)
      if (row.isActive !== undefined) {
        ops.push(
          prisma.region.update({
            where: { id: regionId },
            data: { isActive: row.isActive as boolean },
          })
        );
      }

      // ExamRegionQuota upsert
      ops.push(
        prisma.examRegionQuota.upsert({
          where: {
            examId_regionId: { examId, regionId },
          },
          update: {
            recruitCount: row.recruitCount as number,
            recruitCountCareer: row.recruitCountCareer as number,
            applicantCount: row.applicantCount,
            applicantCountCareer: row.applicantCountCareer,
            examNumberStart: row.examNumberStart,
            examNumberEnd: row.examNumberEnd,
          },
          create: {
            examId,
            regionId,
            recruitCount: row.recruitCount as number,
            recruitCountCareer: row.recruitCountCareer as number,
            applicantCount: row.applicantCount,
            applicantCountCareer: row.applicantCountCareer,
            examNumberStart: row.examNumberStart,
            examNumberEnd: row.examNumberEnd,
          },
        })
      );

      return ops;
    });

    await prisma.$transaction(operations);

    return NextResponse.json({
      success: true,
      updatedCount: normalized.length,
      message: `${normalized.length}개 지역 설정이 업데이트되었습니다.`,
    });
  } catch (error) {
    console.error("모집인원 저장 중 오류가 발생했습니다.", error);
    return NextResponse.json({ error: "모집인원 저장에 실패했습니다." }, { status: 500 });
  }
}

// POST: 다른 시험의 모집인원을 현재 시험으로 복사
export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if ("error" in guard) return guard.error;

  try {
    const body = (await request.json()) as { sourceExamId?: unknown; targetExamId?: unknown };
    const sourceExamId = parsePositiveInt(body.sourceExamId);
    const targetExamId = parsePositiveInt(body.targetExamId);

    if (!sourceExamId || !targetExamId) {
      return NextResponse.json({ error: "원본 시험 ID와 대상 시험 ID가 필요합니다." }, { status: 400 });
    }

    if (sourceExamId === targetExamId) {
      return NextResponse.json({ error: "같은 시험으로 복사할 수 없습니다." }, { status: 400 });
    }

    const sourceQuotas = await prisma.examRegionQuota.findMany({
      where: { examId: sourceExamId },
    });

    if (sourceQuotas.length === 0) {
      return NextResponse.json({ error: "원본 시험에 모집인원 데이터가 없습니다." }, { status: 404 });
    }

    const operations = sourceQuotas.map((sq) =>
      prisma.examRegionQuota.upsert({
        where: {
          examId_regionId: { examId: targetExamId, regionId: sq.regionId },
        },
        update: {
          recruitCount: sq.recruitCount,
          recruitCountCareer: sq.recruitCountCareer,
          applicantCount: sq.applicantCount,
          applicantCountCareer: sq.applicantCountCareer,
          examNumberStart: sq.examNumberStart,
          examNumberEnd: sq.examNumberEnd,
        },
        create: {
          examId: targetExamId,
          regionId: sq.regionId,
          recruitCount: sq.recruitCount,
          recruitCountCareer: sq.recruitCountCareer,
          applicantCount: sq.applicantCount,
          applicantCountCareer: sq.applicantCountCareer,
          examNumberStart: sq.examNumberStart,
          examNumberEnd: sq.examNumberEnd,
        },
      })
    );

    await prisma.$transaction(operations);

    return NextResponse.json({
      success: true,
      copiedCount: sourceQuotas.length,
      message: `${sourceQuotas.length}개 지역 모집인원이 복사되었습니다.`,
    });
  } catch (error) {
    console.error("모집인원 복사 중 오류가 발생했습니다.", error);
    return NextResponse.json({ error: "모집인원 복사에 실패했습니다." }, { status: 500 });
  }
}
