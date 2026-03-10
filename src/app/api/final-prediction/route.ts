import { ExamType } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { calculateFinalRankingDetails, calculateKnownFinalScore, roundScore } from "@/lib/final-prediction";
import { prisma } from "@/lib/prisma";
import { getVerifiedSessionUser, isVerifiedAdmin, SessionUserError } from "@/lib/session-user";
import { getSiteSettingsUncached } from "@/lib/site-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FinalPredictionRequestBody {
  submissionId?: unknown;
  fitnessPassed?: unknown;
  martialDanLevel?: unknown;
}

interface AdminPreviewCandidate {
  submissionId: number;
  label: string;
}

const MOCK_EXAM_NUMBER_PREFIX = "MOCK-";

const submissionSelect = {
  id: true,
  userId: true,
  examId: true,
  regionId: true,
  examType: true,
  finalScore: true,
  examNumber: true,
  bonusRate: true,
} as const;

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function parseBoolean(value: unknown): boolean | null {
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

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function parseDanLevel(value: unknown): number | null {
  const parsed = parseFiniteNumber(value);
  if (parsed === null || !Number.isInteger(parsed) || parsed < 0 || parsed > 20) {
    return null;
  }
  return parsed;
}

function examTypeLabel(examType: ExamType): string {
  return examType === ExamType.CAREER ? "경행경채" : "공채";
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) {
    return digits ? `${digits.slice(0, 2)}${"*".repeat(Math.max(digits.length - 2, 0))}` : "";
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-***-${digits.slice(-4)}`;
  }
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

function isMockSubmissionExamNumber(value: string): boolean {
  return value.startsWith(MOCK_EXAM_NUMBER_PREFIX);
}

async function ensureFinalPredictionEnabled() {
  const settings = await getSiteSettingsUncached();
  return Boolean(settings["site.finalPredictionEnabled"] ?? false);
}

async function buildAdminPreviewCandidates(): Promise<AdminPreviewCandidate[]> {
  const activeExam = await prisma.exam.findFirst({
    where: { isActive: true },
    orderBy: [{ examDate: "desc" }, { id: "desc" }],
    select: { id: true },
  });

  const loadRows = async (examId?: number) =>
    prisma.submission.findMany({
      where: {
        examNumber: { startsWith: MOCK_EXAM_NUMBER_PREFIX },
        ...(examId ? { examId } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 120,
      select: {
        id: true,
        examNumber: true,
        examType: true,
        user: {
          select: {
            name: true,
            phone: true,
          },
        },
        region: {
          select: {
            name: true,
          },
        },
        exam: {
          select: {
            year: true,
            round: true,
          },
        },
      },
    });

  const rows = activeExam ? await loadRows(activeExam.id) : await loadRows();
  const fallbackRows = rows.length < 1 && activeExam ? await loadRows() : [];
  const targetRows = rows.length > 0 ? rows : fallbackRows;

  return targetRows.map((row) => ({
    submissionId: row.id,
    label: `#${row.id} | ${row.exam.year}-${row.exam.round} ${examTypeLabel(row.examType)} | ${row.region.name} | ${row.user.name}(${maskPhone(row.user.phone)}) | ${row.examNumber}`,
  }));
}

async function findTargetSubmission(params: {
  submissionId: number | null;
  userId: number;
  isAdmin: boolean;
  adminPreviewCandidates: AdminPreviewCandidate[];
}) {
  if (params.submissionId) {
    return prisma.submission.findFirst({
      where: params.isAdmin
        ? {
            id: params.submissionId,
            examNumber: { startsWith: MOCK_EXAM_NUMBER_PREFIX },
          }
        : {
            id: params.submissionId,
            userId: params.userId,
          },
      select: submissionSelect,
    });
  }

  if (!params.isAdmin) {
    return prisma.submission.findFirst({
      where: { userId: params.userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: submissionSelect,
    });
  }

  const firstCandidateSubmissionId = params.adminPreviewCandidates[0]?.submissionId;
  if (!firstCandidateSubmissionId) {
    return null;
  }

  return prisma.submission.findUnique({
    where: { id: firstCandidateSubmissionId },
    select: submissionSelect,
  });
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  let viewer;
  try {
    viewer = await getVerifiedSessionUser(session);
  } catch (error) {
    if (error instanceof SessionUserError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "사용자 정보를 확인할 수 없습니다." }, { status: 401 });
  }

  if (!(await ensureFinalPredictionEnabled())) {
    return NextResponse.json({ error: "최종 예측 기능이 아직 열리지 않았습니다." }, { status: 403 });
  }

  const userId = viewer.id;
  const isAdmin = isVerifiedAdmin(viewer);
  const adminPreviewCandidates = isAdmin ? await buildAdminPreviewCandidates() : [];

  const { searchParams } = new URL(request.url);
  const submissionIdQuery = parsePositiveInt(searchParams.get("submissionId"));

  const submission = await findTargetSubmission({
    submissionId: submissionIdQuery,
    userId,
    isAdmin,
    adminPreviewCandidates,
  });

  if (!submission) {
    if (isAdmin) {
      return NextResponse.json({
        isAdminPreview: true,
        adminPreviewCandidates,
        submissionId: null,
        writtenScore: null,
        finalPrediction: null,
        ranking: null,
      });
    }

    return NextResponse.json({ error: "최종 예측을 조회할 제출 데이터가 없습니다." }, { status: 404 });
  }

  if (isAdmin && !isMockSubmissionExamNumber(submission.examNumber)) {
    return NextResponse.json({ error: "관리자 미리보기는 MOCK 제출 데이터만 지원합니다." }, { status: 400 });
  }

  const saved = await prisma.finalPrediction.findUnique({
    where: { submissionId: submission.id },
    select: {
      fitnessScore: true,
      interviewScore: true,
      interviewGrade: true,
      finalScore: true,
      finalRank: true,
      updatedAt: true,
    },
  });

  const fitnessPassed = saved?.interviewGrade === "PASS";
  const writtenScore = Number(submission.finalScore);
  const martialDanLevel =
    saved?.interviewScore === null || saved?.interviewScore === undefined ? 0 : Number(saved.interviewScore);

  const calculated = calculateKnownFinalScore({
    writtenScore,
    fitnessPassed,
    martialDanLevel,
    bonusRate: Number(submission.bonusRate),
  });

  const ranking =
    saved?.finalScore !== null && saved?.finalScore !== undefined && fitnessPassed
      ? await calculateFinalRankingDetails({
          examId: submission.examId,
          regionId: submission.regionId,
          examType: submission.examType,
          submissionId: submission.id,
        })
      : null;

  const rankInfo = {
    finalRank: ranking?.finalRank ?? null,
    totalParticipants: ranking?.totalParticipants ?? 0,
  };

  return NextResponse.json({
    isAdminPreview: isAdmin,
    ...(isAdmin ? { adminPreviewCandidates } : {}),
    submissionId: submission.id,
    writtenScore: roundScore(writtenScore),
    finalPrediction: saved
      ? {
          fitnessPassed,
          martialDanLevel,
          ...calculated,
          finalRank: rankInfo.finalRank,
          totalParticipants: rankInfo.totalParticipants,
          updatedAt: saved.updatedAt.toISOString(),
        }
      : null,
    ranking,
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  let viewer;
  try {
    viewer = await getVerifiedSessionUser(session);
  } catch (error) {
    if (error instanceof SessionUserError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "사용자 정보를 확인할 수 없습니다." }, { status: 401 });
  }

  if (!(await ensureFinalPredictionEnabled())) {
    return NextResponse.json({ error: "최종 예측 기능이 아직 열리지 않았습니다." }, { status: 403 });
  }

  const userId = viewer.id;
  const isAdmin = isVerifiedAdmin(viewer);

  let body: FinalPredictionRequestBody;
  try {
    body = (await request.json()) as FinalPredictionRequestBody;
  } catch {
    return NextResponse.json({ error: "요청 본문(JSON)이 올바르지 않습니다." }, { status: 400 });
  }

  const submissionId = parsePositiveInt(body.submissionId);
  if (!submissionId) {
    return NextResponse.json({ error: "유효한 submissionId가 필요합니다." }, { status: 400 });
  }

  const fitnessPassed = parseBoolean(body.fitnessPassed);
  if (fitnessPassed === null) {
    return NextResponse.json({ error: "fitnessPassed는 true 또는 false여야 합니다." }, { status: 400 });
  }

  const martialDanLevel = parseDanLevel(body.martialDanLevel);
  if (martialDanLevel === null) {
    return NextResponse.json({ error: "무도 단수는 0부터 20 사이의 정수여야 합니다." }, { status: 400 });
  }

  const submission = await prisma.submission.findFirst({
    where: isAdmin
      ? {
          id: submissionId,
          examNumber: { startsWith: MOCK_EXAM_NUMBER_PREFIX },
        }
      : {
          id: submissionId,
          userId,
        },
    select: submissionSelect,
  });

  if (!submission) {
    return NextResponse.json({ error: "해당 제출 데이터를 찾을 수 없습니다." }, { status: 404 });
  }

  const writtenScore = Number(submission.finalScore);
  const calculated = calculateKnownFinalScore({
    writtenScore,
    fitnessPassed,
    martialDanLevel,
    bonusRate: Number(submission.bonusRate),
  });

  await prisma.finalPrediction.upsert({
    where: { submissionId: submission.id },
    update: {
      userId: submission.userId,
      fitnessScore: calculated.martialBonusPoint,
      interviewScore: martialDanLevel,
      interviewGrade: fitnessPassed ? "PASS" : "FAIL",
      finalScore: calculated.score75,
    },
    create: {
      submissionId: submission.id,
      userId: submission.userId,
      fitnessScore: calculated.martialBonusPoint,
      interviewScore: martialDanLevel,
      interviewGrade: fitnessPassed ? "PASS" : "FAIL",
      finalScore: calculated.score75,
    },
  });

  const ranking = fitnessPassed
    ? await calculateFinalRankingDetails({
        examId: submission.examId,
        regionId: submission.regionId,
        examType: submission.examType,
        submissionId: submission.id,
      })
    : null;

  const rankInfo = {
    finalRank: ranking?.finalRank ?? null,
    totalParticipants: ranking?.totalParticipants ?? 0,
  };

  await prisma.finalPrediction.update({
    where: { submissionId: submission.id },
    data: { finalRank: rankInfo.finalRank },
  });

  return NextResponse.json({
    success: true,
    submissionId: submission.id,
    writtenScore: roundScore(writtenScore),
    fitnessPassed,
    martialDanLevel,
    calculation: calculated,
    rank: rankInfo,
    ranking,
  });
}
