import { ExamType, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface RegionRow {
  id: number;
  name: string;
  isActive: boolean;
  recruitCount: number;
  recruitCountCareer: number;
  applicantCount: number | null;
  applicantCountCareer: number | null;
}

interface RegionRowLegacy {
  id: number;
  name: string;
  recruitCount: number;
  recruitCountCareer: number;
  applicantCount: number | null;
  applicantCountCareer: number | null;
}

interface RegionUpdateItem {
  id?: unknown;
  isActive?: unknown;
  recruitCount?: unknown;
  recruitCountCareer?: unknown;
  applicantCount?: unknown;
  applicantCountCareer?: unknown;
}

interface RegionUpdatePayload {
  regions?: RegionUpdateItem[];
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

function isMissingColumnError(error: unknown, columnName: string): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";

  return message.includes("Unknown column") && message.includes(columnName);
}

async function ensureRegionIsActiveColumnBestEffort(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `Region` ADD COLUMN IF NOT EXISTS `isActive` BOOLEAN NOT NULL DEFAULT true"
    );
  } catch {
    // Ignore and fall back to compatibility queries below.
  }
}

async function fetchRegionsCompat(): Promise<{ rows: RegionRow[]; supportsIsActive: boolean }> {
  try {
    const rows = await prisma.$queryRaw<RegionRow[]>`
      SELECT
        id,
        name,
        isActive,
        recruitCount,
        recruitCountCareer,
        applicantCount,
        applicantCountCareer
      FROM Region
      ORDER BY isActive DESC, name ASC
    `;
    return { rows, supportsIsActive: true };
  } catch (error) {
    if (!isMissingColumnError(error, "isActive")) {
      throw error;
    }

    const legacyRows = await prisma.$queryRaw<RegionRowLegacy[]>`
      SELECT
        id,
        name,
        recruitCount,
        recruitCountCareer,
        applicantCount,
        applicantCountCareer
      FROM Region
      ORDER BY name ASC
    `;

    return {
      rows: legacyRows.map((row) => ({
        ...row,
        isActive: true,
      })),
      supportsIsActive: false,
    };
  }
}

async function fetchExistingRegionsCompat(ids: number[]): Promise<{ rows: RegionRow[]; supportsIsActive: boolean }> {
  if (ids.length < 1) {
    return { rows: [], supportsIsActive: true };
  }

  const idSql = Prisma.join(ids);

  try {
    const rows = await prisma.$queryRaw<RegionRow[]>`
      SELECT
        id,
        name,
        isActive,
        recruitCount,
        recruitCountCareer,
        applicantCount,
        applicantCountCareer
      FROM Region
      WHERE id IN (${idSql})
    `;
    return { rows, supportsIsActive: true };
  } catch (error) {
    if (!isMissingColumnError(error, "isActive")) {
      throw error;
    }

    const legacyRows = await prisma.$queryRaw<RegionRowLegacy[]>`
      SELECT
        id,
        name,
        recruitCount,
        recruitCountCareer,
        applicantCount,
        applicantCountCareer
      FROM Region
      WHERE id IN (${idSql})
    `;

    return {
      rows: legacyRows.map((row) => ({
        ...row,
        isActive: true,
      })),
      supportsIsActive: false,
    };
  }
}

export async function GET() {
  const guard = await requireAdminRoute();
  if ("error" in guard) return guard.error;

  try {
    await ensureRegionIsActiveColumnBestEffort();

    const [regionFetch, groupedCounts] = await Promise.all([
      fetchRegionsCompat(),
      prisma.submission.groupBy({
        by: ["regionId", "examType"],
        _count: {
          _all: true,
        },
      }),
    ]);

    const countByRegion = new Map<
      number,
      {
        total: number;
        publicCount: number;
        careerCount: number;
      }
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
      regions: regionFetch.rows.map((region) => {
        const counts = countByRegion.get(region.id) ?? {
          total: 0,
          publicCount: 0,
          careerCount: 0,
        };

        return {
          id: region.id,
          name: region.name,
          isActive: region.isActive,
          recruitCount: region.recruitCount,
          recruitCountCareer: region.recruitCountCareer,
          applicantCount: region.applicantCount,
          applicantCountCareer: region.applicantCountCareer,
          passMultiplePublic: formatPassMultiple(region.recruitCount),
          passMultipleCareer: formatPassMultiple(region.recruitCountCareer),
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

export async function PUT(request: NextRequest) {
  const guard = await requireAdminRoute();
  if ("error" in guard) return guard.error;

  try {
    const body = (await request.json()) as RegionUpdatePayload;

    if (!Array.isArray(body.regions) || body.regions.length === 0) {
      return NextResponse.json({ error: "수정할 지역 데이터가 없습니다." }, { status: 400 });
    }

    const normalized = body.regions.map((item) => {
      const id = parsePositiveInt(item.id);
      const isActive = parseBoolean(item.isActive);
      const recruitCount = parseNonNegativeInt(item.recruitCount);
      const recruitCountCareer = parseNonNegativeInt(item.recruitCountCareer);
      const applicantCountParsed = parseNullableNonNegativeInt(item.applicantCount);
      const applicantCountCareerParsed = parseNullableNonNegativeInt(item.applicantCountCareer);

      return {
        id,
        isActive,
        recruitCount,
        recruitCountCareer,
        applicantCount: applicantCountParsed.value,
        applicantCountCareer: applicantCountCareerParsed.value,
        applicantCountValid: applicantCountParsed.ok,
        applicantCountCareerValid: applicantCountCareerParsed.ok,
      };
    });

    for (const row of normalized) {
      if (!row.id) {
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
      const rowId = row.id as number;
      if (uniqueIds.has(rowId)) {
        return NextResponse.json({ error: "중복된 지역 ID가 포함되어 있습니다." }, { status: 400 });
      }
      uniqueIds.add(rowId);
    }

    await ensureRegionIsActiveColumnBestEffort();

    const existingFetch = await fetchExistingRegionsCompat(Array.from(uniqueIds));
    if (existingFetch.rows.length !== uniqueIds.size) {
      return NextResponse.json({ error: "존재하지 않는 지역 ID가 포함되어 있습니다." }, { status: 404 });
    }

    const existingRegionById = new Map(existingFetch.rows.map((region) => [region.id, region] as const));

    await prisma.$transaction(
      normalized.map((row) => {
        const regionId = row.id as number;
        const nextIsActive = row.isActive ?? existingRegionById.get(regionId)?.isActive ?? true;

        if (existingFetch.supportsIsActive) {
          return prisma.$executeRaw`
            UPDATE Region
            SET
              isActive = ${nextIsActive},
              recruitCount = ${row.recruitCount as number},
              recruitCountCareer = ${row.recruitCountCareer as number},
              applicantCount = ${row.applicantCount},
              applicantCountCareer = ${row.applicantCountCareer}
            WHERE id = ${regionId}
          `;
        }

        return prisma.$executeRaw`
          UPDATE Region
          SET
            recruitCount = ${row.recruitCount as number},
            recruitCountCareer = ${row.recruitCountCareer as number},
            applicantCount = ${row.applicantCount},
            applicantCountCareer = ${row.applicantCountCareer}
          WHERE id = ${regionId}
        `;
      })
    );

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

