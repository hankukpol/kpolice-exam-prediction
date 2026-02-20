import { ExamType } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const SUBJECT_ORDER: Record<ExamType, string[]> = {
  [ExamType.PUBLIC]: ["헌법", "형사법", "경찰학"],
  [ExamType.CAREER]: ["범죄학", "형사법", "경찰학"],
};

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function roundNumber(value: number): number {
  return Number(value.toFixed(2));
}

function calculateRank(scores: number[], myScore: number): number {
  return scores.filter((score) => score > myScore).length + 1;
}

function calculatePercentile(scores: number[], myScore: number): number {
  if (scores.length === 0) return 0;
  const lowerCount = scores.filter((score) => score < myScore).length;
  return roundNumber((lowerCount / scores.length) * 100);
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const userId = Number(session.user.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "사용자 정보를 확인할 수 없습니다." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const submissionId = parsePositiveInt(searchParams.get("submissionId"));
  if (searchParams.get("submissionId") && !submissionId) {
    return NextResponse.json({ error: "submissionId가 올바르지 않습니다." }, { status: 400 });
  }

  const submission = await prisma.submission.findFirst({
    where: {
      userId,
      ...(submissionId ? { id: submissionId } : {}),
    },
    orderBy: submissionId ? undefined : [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      examId: true,
      examType: true,
      regionId: true,
      gender: true,
      totalScore: true,
      finalScore: true,
      bonusType: true,
      bonusRate: true,
      createdAt: true,
      exam: {
        select: {
          id: true,
          name: true,
          year: true,
          round: true,
        },
      },
      region: {
        select: {
          id: true,
          name: true,
          recruitCount: true,
          recruitCountCareer: true,
        },
      },
      subjectScores: {
        select: {
          subjectId: true,
          rawScore: true,
          isFailed: true,
          subject: {
            select: {
              name: true,
              questionCount: true,
              maxScore: true,
              pointPerQuestion: true,
            },
          },
        },
      },
    },
  });

  if (!submission) {
    return NextResponse.json({ error: "조회할 성적 데이터가 없습니다." }, { status: 404 });
  }

  const groupSubmissions = await prisma.submission.findMany({
    where: {
      examId: submission.examId,
      regionId: submission.regionId,
      examType: submission.examType,
    },
    select: {
      id: true,
      finalScore: true,
      subjectScores: {
        select: {
          subjectId: true,
          rawScore: true,
        },
      },
    },
  });

  const subjectOrder = SUBJECT_ORDER[submission.examType];
  const orderedSubjectScores = [...submission.subjectScores].sort((a, b) => {
    const aIndex = subjectOrder.indexOf(a.subject.name);
    const bIndex = subjectOrder.indexOf(b.subject.name);
    const safeA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
    const safeB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
    if (safeA !== safeB) return safeA - safeB;
    return a.subjectId - b.subjectId;
  });

  const totalScores = groupSubmissions.map((item) => Number(item.finalScore));
  const myFinalScore = Number(submission.finalScore);
  const totalRank = calculateRank(totalScores, myFinalScore);
  const totalPercentile = calculatePercentile(totalScores, myFinalScore);
  const totalParticipants = groupSubmissions.length;

  const scores = orderedSubjectScores.map((mySubjectScore) => {
    const subjectScoresInGroup = groupSubmissions.map((participant) => {
      const found = participant.subjectScores.find((score) => score.subjectId === mySubjectScore.subjectId);
      return Number(found?.rawScore ?? 0);
    });

    const rawScore = Number(mySubjectScore.rawScore);
    const maxScore = Number(mySubjectScore.subject.maxScore);
    const pointPerQuestion = Number(mySubjectScore.subject.pointPerQuestion);
    const bonusScore = roundNumber(maxScore * Number(submission.bonusRate));
    const finalScore = roundNumber(rawScore + bonusScore);

    return {
      subjectId: mySubjectScore.subjectId,
      subjectName: mySubjectScore.subject.name,
      questionCount: mySubjectScore.subject.questionCount,
      pointPerQuestion,
      correctCount: Math.round(rawScore / pointPerQuestion),
      rawScore,
      maxScore,
      bonusScore,
      finalScore,
      isCutoff: mySubjectScore.isFailed,
      cutoffScore: roundNumber(maxScore * 0.4),
      rank: calculateRank(subjectScoresInGroup, rawScore),
      percentile: calculatePercentile(subjectScoresInGroup, rawScore),
      totalParticipants,
    };
  });

  const hasCutoff = scores.some((score) => score.isCutoff);
  const cutoffSubjects = scores
    .filter((score) => score.isCutoff)
    .map((score) => ({
      subjectName: score.subjectName,
      rawScore: score.rawScore,
      maxScore: score.maxScore,
      cutoffScore: score.cutoffScore,
    }));

  return NextResponse.json({
    submission: {
      id: submission.id,
      examId: submission.examId,
      examName: submission.exam.name,
      examYear: submission.exam.year,
      examRound: submission.exam.round,
      examType: submission.examType,
      regionId: submission.region.id,
      regionName: submission.region.name,
      gender: submission.gender,
      totalScore: Number(submission.totalScore),
      finalScore: Number(submission.finalScore),
      bonusType: submission.bonusType,
      bonusRate: Number(submission.bonusRate),
      createdAt: submission.createdAt,
    },
    scores,
    statistics: {
      totalParticipants,
      totalRank,
      totalPercentile,
      hasCutoff,
      cutoffSubjects,
      bonusScore: roundNumber(Number(submission.finalScore) - Number(submission.totalScore)),
    },
  });
}
