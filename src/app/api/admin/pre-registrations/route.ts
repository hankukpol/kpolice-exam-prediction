import { NextRequest, NextResponse } from "next/server";
import { buildAdminPreRegistrationWhere, parseAdminExamType } from "@/lib/admin-pre-registrations";
import { requireAdminRoute } from "@/lib/admin-auth";
import { parsePositiveInt } from "@/lib/exam-utils";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function parsePage(value: string | null): number {
  return parsePositiveInt(value) ?? 1;
}

function parseLimit(value: string | null): number {
  const parsed = parsePositiveInt(value) ?? 20;
  return Math.min(parsed, 100);
}

function getGroupCount(group: { _count?: true | { id?: number | null; _all?: number | null } } | undefined): number {
  const count = group?._count;
  if (!count || count === true) return 0;
  return count.id ?? count._all ?? 0;
}

export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if ("error" in guard) return guard.error;

  try {
    const { searchParams } = new URL(request.url);
    const requestedPage = parsePage(searchParams.get("page"));
    const limit = parseLimit(searchParams.get("limit"));
    const examId = parsePositiveInt(searchParams.get("examId"));
    const regionId = parsePositiveInt(searchParams.get("regionId"));
    const examType = parseAdminExamType(searchParams.get("examType"));
    const search = searchParams.get("search")?.trim() ?? "";

    if (searchParams.get("examType") && !examType) {
      return NextResponse.json({ error: "examType은 PUBLIC 또는 CAREER여야 합니다." }, { status: 400 });
    }

    const where = buildAdminPreRegistrationWhere({
      examId,
      regionId,
      examType,
      search,
    });

    const [totalCount, groupedByExamType] = await prisma.$transaction([
      prisma.preRegistration.count({ where }),
      prisma.preRegistration.groupBy({
        by: ["examType"],
        orderBy: {
          examType: "asc",
        },
        where,
        _count: { id: true },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const page = Math.min(requestedPage, totalPages);
    const skip = (page - 1) * limit;

    const rows = await prisma.preRegistration.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip,
      take: limit,
      select: {
        id: true,
        examId: true,
        regionId: true,
        examType: true,
        gender: true,
        examNumber: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        exam: {
          select: {
            name: true,
            year: true,
            round: true,
          },
        },
        region: {
          select: {
            name: true,
          },
        },
      },
    });

    const publicGroup = groupedByExamType.find((item) => item.examType === "PUBLIC");
    const careerGroup = groupedByExamType.find((item) => item.examType === "CAREER");
    const publicCount = getGroupCount(publicGroup);
    const careerCount = getGroupCount(careerGroup);

    return NextResponse.json({
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      },
      summary: {
        totalCount,
        publicCount,
        careerCount,
      },
      preRegistrations: rows.map((row) => ({
        id: row.id,
        examId: row.examId,
        examName: row.exam.name,
        examYear: row.exam.year,
        examRound: row.exam.round,
        userId: row.user.id,
        userName: row.user.name,
        userPhone: row.user.phone,
        regionId: row.regionId,
        regionName: row.region.name,
        examType: row.examType,
        gender: row.gender,
        examNumber: row.examNumber,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    });
  } catch (error) {
    console.error("관리자 사전등록 목록 조회 중 오류가 발생했습니다.", error);
    return NextResponse.json({ error: "사전등록 목록 조회에 실패했습니다." }, { status: 500 });
  }
}
