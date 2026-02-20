import { NextRequest, NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/admin-auth";
import { buildPassCutPredictionRows } from "@/lib/pass-cut";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";

export const runtime = "nodejs";

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

export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if ("error" in guard) return guard.error;

  const { searchParams } = new URL(request.url);
  const examId = parsePositiveInt(searchParams.get("examId"));
  if (!examId) {
    return NextResponse.json({ error: "examId가 필요합니다." }, { status: 400 });
  }

  const releases = await prisma.passCutRelease.findMany({
    where: { examId },
    orderBy: [{ releaseNumber: "asc" }, { id: "asc" }],
    select: {
      id: true,
      examId: true,
      releaseNumber: true,
      releasedAt: true,
      participantCount: true,
      memo: true,
      admin: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          snapshots: true,
        },
      },
    },
  });

  return NextResponse.json({
    releases: releases.map((release) => ({
      id: release.id,
      examId: release.examId,
      releaseNumber: release.releaseNumber,
      releasedAt: release.releasedAt.toISOString(),
      participantCount: release.participantCount,
      memo: release.memo,
      createdBy: {
        id: release.admin.id,
        name: release.admin.name,
      },
      snapshotCount: release._count.snapshots,
    })),
  });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if ("error" in guard) return guard.error;

  const adminUserId = Number(guard.session.user.id);
  if (!Number.isInteger(adminUserId) || adminUserId <= 0) {
    return NextResponse.json({ error: "관리자 정보를 확인할 수 없습니다." }, { status: 401 });
  }

  const body = (await request.json()) as {
    examId?: number;
    releaseNumber?: number;
    memo?: string;
    autoNotice?: boolean;
  };

  const examId = parsePositiveInt(body.examId);
  const releaseNumber = parsePositiveInt(body.releaseNumber);
  const memo = typeof body.memo === "string" && body.memo.trim() ? body.memo.trim() : null;
  const autoNotice = body.autoNotice !== false;

  if (!examId) {
    return NextResponse.json({ error: "examId가 필요합니다." }, { status: 400 });
  }
  if (!releaseNumber || releaseNumber < 1 || releaseNumber > 4) {
    return NextResponse.json({ error: "releaseNumber는 1~4 범위여야 합니다." }, { status: 400 });
  }

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      name: true,
      year: true,
      round: true,
    },
  });
  if (!exam) {
    return NextResponse.json({ error: "대상 시험을 찾을 수 없습니다." }, { status: 404 });
  }

  const duplicated = await prisma.passCutRelease.findUnique({
    where: {
      examId_releaseNumber: {
        examId,
        releaseNumber,
      },
    },
    select: { id: true },
  });
  if (duplicated) {
    return NextResponse.json(
      { error: `이미 ${releaseNumber}차 합격컷 발표가 등록되어 있습니다.` },
      { status: 409 }
    );
  }

  const settings = await getSiteSettings();
  const rows = await buildPassCutPredictionRows({
    examId,
    includeCareerExamType: Boolean(settings["site.careerExamEnabled"] ?? true),
  });

  const participantCount = rows.reduce((sum, row) => sum + row.participantCount, 0);
  const release = await prisma.$transaction(async (tx) => {
    const created = await tx.passCutRelease.create({
      data: {
        examId,
        releaseNumber,
        participantCount,
        createdBy: adminUserId,
        memo,
      },
      select: {
        id: true,
        releaseNumber: true,
        releasedAt: true,
        participantCount: true,
      },
    });

    if (rows.length > 0) {
      await tx.passCutSnapshot.createMany({
        data: rows.map((row) => ({
          passCutReleaseId: created.id,
          regionId: row.regionId,
          examType: row.examType,
          participantCount: row.participantCount,
          recruitCount: row.recruitCount,
          averageScore: row.averageScore,
          oneMultipleCutScore: row.oneMultipleCutScore,
          sureMinScore: row.sureMinScore,
          likelyMinScore: row.likelyMinScore,
          possibleMinScore: row.possibleMinScore,
        })),
      });
    }

    if (autoNotice) {
      await tx.notice.create({
        data: {
          title: `${releaseNumber}차 합격컷 발표 안내`,
          content: `${exam.year}년 ${exam.round}차 ${exam.name} ${releaseNumber}차 합격컷이 발표되었습니다.`,
          isActive: true,
          priority: 100,
        },
      });
    }

    return created;
  });

  return NextResponse.json({
    success: true,
    releaseId: release.id,
    releaseNumber: release.releaseNumber,
    releasedAt: release.releasedAt.toISOString(),
    participantCount: release.participantCount,
    snapshotCount: rows.length,
  });
}
