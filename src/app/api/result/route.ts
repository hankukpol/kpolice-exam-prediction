import { ExamType, Prisma, Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getCorrectRateRows } from "@/lib/correct-rate";
import { parsePositiveInt } from "@/lib/exam-utils";
import { SUBJECT_CUTOFF_RATE } from "@/lib/policy";
import { prisma } from "@/lib/prisma";
import { getSiteSettingsUncached } from "@/lib/site-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUBJECT_ORDER: Record<ExamType, string[]> = {
  [ExamType.PUBLIC]: ["헌법", "형사법", "경찰학"],
  [ExamType.CAREER]: ["범죄학", "형사법", "경찰학"],
};

type CountRow = {
  totalCount: bigint | number | null;
  higherCount: bigint | number | null;
  lowerCount: bigint | number | null;
};

function toAnswerKey(subjectId: number, questionNumber: number): string {
  return `${subjectId}:${questionNumber}`;
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
  const isAdmin = ((session.user.role as Role | undefined) ?? Role.USER) === Role.ADMIN;
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "사용자 정보를 확인할 수 없습니다." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const submissionId = parsePositiveInt(searchParams.get("submissionId"));
  if (searchParams.get("submissionId") && !submissionId) {
    return NextResponse.json({ error: "submissionId가 올바르지 않습니다." }, { status: 400 });
  }

  const activeExam =
    !submissionId && isAdmin
      ? await prisma.exam.findFirst({
          where: { isActive: true },
          orderBy: [{ examDate: "desc" }, { id: "desc" }],
          select: { id: true },
        })
      : null;

  const submissionWhere: Prisma.SubmissionWhereInput = submissionId
    ? {
        id: submissionId,
        ...(isAdmin ? {} : { userId }),
      }
    : isAdmin
      ? {
          ...(activeExam ? { examId: activeExam.id } : {}),
        }
      : {
          userId,
        };

  const submission = await prisma.submission.findFirst({
    where: submissionWhere,
    orderBy: submissionId ? undefined : [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      userId: true,
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
      editCount: true,
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
      userAnswers: {
        select: {
          subjectId: true,
          questionNumber: true,
          selectedAnswer: true,
          isCorrect: true,
        },
      },
      difficultyRatings: {
        select: {
          subjectId: true,
          rating: true,
        },
      },
    },
  });

  if (!submission) {
    return NextResponse.json({ error: "조회할 성적 데이터가 없습니다." }, { status: 404 });
  }

  const settings = await getSiteSettingsUncached();
  const maxEditLimit = (settings["site.submissionEditLimit"] as number) ?? 3;
  const finalPredictionEnabled = Boolean(settings["site.finalPredictionEnabled"] ?? false);

  const answerKeys = await prisma.answerKey.findMany({
    where: { examId: submission.examId },
    select: { subjectId: true, questionNumber: true, correctAnswer: true },
  });
  const correctRateRows = await getCorrectRateRows(submission.examId, submission.examType);
  const correctRateByKey = new Map(
    correctRateRows.map((row) => [
      toAnswerKey(row.subjectId, row.questionNumber),
      {
        correctRate: row.correctRate,
        difficultyLevel: row.difficultyLevel,
      },
    ] as const)
  );

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

  // 과목별 순위/백분위를 단일 GROUP BY 쿼리로 일괄 조회 (N+1 방지)
  type SubjectCountRow = {
    subjectId: number;
    totalCount: bigint | number | null;
    higherCount: bigint | number | null;
    lowerCount: bigint | number | null;
  };

  const subjectIds = orderedSubjectScores.map((s) => s.subjectId);

  const scoreConditions = orderedSubjectScores.map(
    (s) => Prisma.sql`WHEN ss.subjectId = ${s.subjectId} THEN ${Number(s.rawScore)}`
  );
  const myScoreSql = Prisma.sql`CASE ${Prisma.join(scoreConditions, " ")} ELSE 0 END`;

  const subjectRows =
    subjectIds.length > 0
      ? await prisma.$queryRaw<SubjectCountRow[]>(Prisma.sql`
          SELECT
            ss.subjectId,
            COUNT(*) AS totalCount,
            SUM(CASE WHEN ss.rawScore > (${myScoreSql}) THEN 1 ELSE 0 END) AS higherCount,
            SUM(CASE WHEN ss.rawScore < (${myScoreSql}) THEN 1 ELSE 0 END) AS lowerCount
          FROM Submission s
          INNER JOIN SubjectScore ss
            ON ss.submissionId = s.id
           AND ss.subjectId IN (${Prisma.join(subjectIds)})
          WHERE s.examId = ${submission.examId}
            AND s.regionId = ${submission.regionId}
            AND s.examType = ${submission.examType}
            ${populationConditionSql}
          GROUP BY ss.subjectId
        `)
      : [];

  const subjectStatsMap = new Map(
    subjectRows.map((row) => [
      row.subjectId,
      {
        totalCount: toCount(row.totalCount),
        higherCount: toCount(row.higherCount),
        lowerCount: toCount(row.lowerCount),
      },
    ])
  );

  const answerKeyMap = new Map<string, number>();
  for (const k of answerKeys) {
    answerKeyMap.set(toAnswerKey(k.subjectId, k.questionNumber), k.correctAnswer);
  }

  const scores = orderedSubjectScores.map((mySubjectScore) => {
    const rawScore = Number(mySubjectScore.rawScore);
    const maxScore = Number(mySubjectScore.subject.maxScore);
    const pointPerQuestion = Number(mySubjectScore.subject.pointPerQuestion);
    const bonusScore = mySubjectScore.isFailed ? 0 : roundNumber(maxScore * Number(submission.bonusRate));
    const finalScore = roundNumber(rawScore + bonusScore);

    const stats = subjectStatsMap.get(mySubjectScore.subjectId);
    const subjectParticipants = stats?.totalCount ?? 0;
    const subjectHigher = stats?.higherCount ?? 0;
    const subjectLower = stats?.lowerCount ?? 0;

    const difficulty =
      submission.difficultyRatings.find(
        (rating) => rating.subjectId === mySubjectScore.subjectId
      )?.rating ?? null;

    const userAnswers = submission.userAnswers
      .filter((ua) => ua.subjectId === mySubjectScore.subjectId)
      .map((ua) => {
        const correctRateInfo = correctRateByKey.get(toAnswerKey(ua.subjectId, ua.questionNumber));
        return {
          questionNumber: ua.questionNumber,
          selectedAnswer: ua.selectedAnswer,
          isCorrect: ua.isCorrect,
          correctAnswer: answerKeyMap.get(toAnswerKey(ua.subjectId, ua.questionNumber)) ?? null,
          correctRate: correctRateInfo?.correctRate ?? 0,
          difficultyLevel: correctRateInfo?.difficultyLevel ?? "NORMAL",
        };
      })
      .sort((a, b) => a.questionNumber - b.questionNumber);

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
      difficulty,
      answers: userAnswers,
    };
  });

  const subjectCorrectRateSummaries = scores.map((score) => {
    const rows = correctRateRows.filter((row) => row.subjectId === score.subjectId);
    const averageCorrectRate =
      rows.length > 0
        ? roundNumber(rows.reduce((sum, row) => sum + row.correctRate, 0) / rows.length)
        : 0;

    const hardest = rows.reduce(
      (current, row) => {
        if (!current || row.correctRate < current.correctRate) {
          return row;
        }
        return current;
      },
      null as (typeof rows)[number] | null
    );

    const easiest = rows.reduce(
      (current, row) => {
        if (!current || row.correctRate > current.correctRate) {
          return row;
        }
        return current;
      },
      null as (typeof rows)[number] | null
    );

    return {
      subjectId: score.subjectId,
      subjectName: score.subjectName,
      averageCorrectRate,
      hardestQuestion: hardest?.questionNumber ?? null,
      hardestRate: hardest?.correctRate ?? null,
      easiestQuestion: easiest?.questionNumber ?? null,
      easiestRate: easiest?.correctRate ?? null,
      myCorrectOnHard: score.answers.filter(
        (answer) => answer.difficultyLevel === "VERY_HARD" && answer.isCorrect
      ).length,
      myWrongOnEasy: score.answers.filter(
        (answer) => answer.difficultyLevel === "EASY" && !answer.isCorrect
      ).length,
    };
  });

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
    features: {
      finalPredictionEnabled,
    },
    submission: {
      id: submission.id,
      isOwner: submission.userId === userId,
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
      editCount: submission.editCount,
      maxEditLimit,
    },
    scores,
    subjectCorrectRateSummaries,
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
