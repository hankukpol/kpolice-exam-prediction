import { ExamType } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { buildPassCutPredictionRows, getCurrentPassCutSnapshot } from "@/lib/pass-cut";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";

export const runtime = "nodejs";

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseExamType(value: string | null): ExamType | null {
  if (value === ExamType.PUBLIC) return ExamType.PUBLIC;
  if (value === ExamType.CAREER) return ExamType.CAREER;
  return null;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const examIdQuery = parsePositiveInt(searchParams.get("examId"));
  const regionId = parsePositiveInt(searchParams.get("regionId"));
  const examType = parseExamType(searchParams.get("examType"));

  if (!regionId) {
    return NextResponse.json({ error: "regionId가 필요합니다." }, { status: 400 });
  }
  if (!examType) {
    return NextResponse.json({ error: "examType은 PUBLIC 또는 CAREER여야 합니다." }, { status: 400 });
  }

  const examId =
    examIdQuery ??
    (
      await prisma.exam.findFirst({
        where: { isActive: true },
        orderBy: [{ examDate: "desc" }, { id: "desc" }],
        select: { id: true },
      })
    )?.id ??
    null;

  if (!examId) {
    return NextResponse.json({
      releases: [],
      current: {
        participantCount: 0,
        recruitCount: 0,
        averageScore: null,
        oneMultipleCutScore: null,
        sureMinScore: null,
        likelyMinScore: null,
        possibleMinScore: null,
      },
    });
  }

  const releases = await prisma.passCutRelease.findMany({
    where: { examId },
    orderBy: [{ releaseNumber: "asc" }, { id: "asc" }],
    select: {
      releaseNumber: true,
      releasedAt: true,
      participantCount: true,
      snapshots: {
        where: {
          regionId,
          examType,
        },
        select: {
          participantCount: true,
          recruitCount: true,
          averageScore: true,
          oneMultipleCutScore: true,
          sureMinScore: true,
          likelyMinScore: true,
          possibleMinScore: true,
        },
        take: 1,
      },
    },
  });

  const settings = await getSiteSettings();
  const currentRows = await buildPassCutPredictionRows({
    examId,
    includeCareerExamType: Boolean(settings["site.careerExamEnabled"] ?? true),
  });
  const current = getCurrentPassCutSnapshot(currentRows, regionId, examType);

  return NextResponse.json({
    releases: releases.map((release) => {
      const snapshot = release.snapshots[0] ?? null;
      return {
        releaseNumber: release.releaseNumber,
        releasedAt: release.releasedAt.toISOString(),
        totalParticipantCount: release.participantCount,
        snapshot: snapshot
          ? {
              participantCount: snapshot.participantCount,
              recruitCount: snapshot.recruitCount,
              averageScore: snapshot.averageScore,
              oneMultipleCutScore: snapshot.oneMultipleCutScore,
              sureMinScore: snapshot.sureMinScore,
              likelyMinScore: snapshot.likelyMinScore,
              possibleMinScore: snapshot.possibleMinScore,
            }
          : null,
      };
    }),
    current,
  });
}
