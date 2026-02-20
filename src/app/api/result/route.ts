import { ExamType, Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { SUBJECT_CUTOFF_RATE } from "@/lib/policy";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const SUBJECT_ORDER: Record<ExamType, string[]> = {
  [ExamType.PUBLIC]: ["헌법", "형사법", "경찰학"],
  [ExamType.CAREER]: ["범죄학", "형사법", "경찰학"],
};

type CountRow = {
  totalCount: bigint | number | null;
  higherCount: bigint | number | null;
  lowerCount: bigint | number | null;
};

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function roundNumber(value: number): number {
  return Number(value.toFixed(2));
}

function toCount(value: bigint | number | null | undefined): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return 0;
}

function calculateRankByHigher(higherCount: number): number {
  return higherCount + 1;
}

function calculatePercentileByLower(lowerCount: number, totalCount: number): number {
  if (totalCount <= 0) return 0;
  return roundNumber((lowerCount / totalCount) * 100);
}

function getPopulationConditionSql(submissionHasCutoff: boolean): Prisma.Sql {
  if (submissionHasCutoff) {
    return Prisma.empty;
  }

  return Prisma.sql`
    AND NOT EXISTS (
      SELECT 1
      FROM SubjectScore sf
      WHERE sf.submissionId = s.id
        AND sf.isFailed = true
    )
  `;
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
      examNumber: true,
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

  const submissionHasCutoff = submission.subjectScores.some((score) => score.isFailed);
  const rankingBasis = submissionHasCutoff ? "ALL_PARTICIPANTS" : "NON_CUTOFF_PARTICIPANTS";
  const populationConditionSql = getPopulationConditionSql(submissionHasCutoff);
  const myFinalScore = Number(submission.finalScore);

  const [overallRow] = await prisma.$queryRaw<CountRow[]>(Prisma.sql`
    SELECT
      COUNT(*) AS totalCount,
      SUM(CASE WHEN s.finalScore > ${myFinalScore} THEN 1 ELSE 0 END) AS higherCount,
      SUM(CASE WHEN s.finalScore < ${myFinalScore} THEN 1 ELSE 0 END) AS lowerCount
    FROM Submission s
    WHERE s.examId = ${submission.examId}
      AND s.regionId = ${submission.regionId}
      AND s.examType = ${submission.examType}
      ${populationConditionSql}
  `);

  const totalParticipants = toCount(overallRow?.totalCount);
  if (totalParticipants < 1) {
    return NextResponse.json({ error: "성적 비교 대상이 없습니다." }, { status: 404 });
  }

  const totalRank = calculateRankByHigher(toCount(overallRow?.higherCount));
  const totalPercentile = calculatePercentileByLower(toCount(overallRow?.lowerCount), totalParticipants);

  const subjectOrder = SUBJECT_ORDER[submission.examType];
  const orderedSubjectScores = [...submission.subjectScores].sort((a, b) => {
    const aIndex = subjectOrder.indexOf(a.subject.name);
    const bIndex = subjectOrder.indexOf(b.subject.name);
    const safeA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
    const safeB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
    if (safeA !== safeB) return safeA - safeB;
    return a.subjectId - b.subjectId;
  });

  const scores = await Promise.all(
    orderedSubjectScores.map(async (mySubjectScore) => {
      const rawScore = Number(mySubjectScore.rawScore);
      const maxScore = Number(mySubjectScore.subject.maxScore);
      const pointPerQuestion = Number(mySubjectScore.subject.pointPerQuestion);
      const bonusScore = roundNumber(maxScore * Number(submission.bonusRate));
      const finalScore = roundNumber(rawScore + bonusScore);

      const [subjectRow] = await prisma.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT
          COUNT(*) AS totalCount,
          SUM(CASE WHEN ss.rawScore > ${rawScore} THEN 1 ELSE 0 END) AS higherCount,
          SUM(CASE WHEN ss.rawScore < ${rawScore} THEN 1 ELSE 0 END) AS lowerCount
        FROM Submission s
        INNER JOIN SubjectScore ss
          ON ss.submissionId = s.id
         AND ss.subjectId = ${mySubjectScore.subjectId}
        WHERE s.examId = ${submission.examId}
          AND s.regionId = ${submission.regionId}
          AND s.examType = ${submission.examType}
          ${populationConditionSql}
      `);

      const subjectParticipants = toCount(subjectRow?.totalCount);
      const subjectHigher = toCount(subjectRow?.higherCount);
      const subjectLower = toCount(subjectRow?.lowerCount);

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
        cutoffScore: roundNumber(maxScore * SUBJECT_CUTOFF_RATE),
        rank: calculateRankByHigher(subjectHigher),
        percentile: calculatePercentileByLower(subjectLower, subjectParticipants),
        totalParticipants: subjectParticipants,
      };
    })
  );

  const hasCutoff = submissionHasCutoff;
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
      examNumber: submission.examNumber,
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
      rankingBasis,
      cutoffSubjects,
      bonusScore: roundNumber(Number(submission.finalScore) - Number(submission.totalScore)),
    },
  });
}
