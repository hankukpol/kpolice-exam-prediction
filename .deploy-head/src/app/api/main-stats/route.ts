import { ExamType, Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getDifficultyStats } from "@/lib/difficulty";
import { getLikelyMultiple, getPassMultiple } from "@/lib/prediction";
import { prisma } from "@/lib/prisma";
import { getActiveNotices, getSiteSettings } from "@/lib/site-settings";

export const runtime = "nodejs";

interface QuotaRow {
  regionId: number;
  regionName: string;
  recruitCount: number;
  recruitCountCareer: number;
  applicantCount: number | null;
  applicantCountCareer: number | null;
}

interface ScoreBandRow {
  regionId: number;
  examType: ExamType;
  finalScore: number;
  _count: {
    _all: number;
  };
}

interface MainStatsRow {
  regionId: number;
  regionName: string;
  examType: ExamType;
  examTypeLabel: string;
  recruitCount: number;
  applicantCount: number | null;
  estimatedApplicants: number;
  isApplicantCountExact: boolean;
  competitionRate: number | null;
  participantCount: number;
  averageFinalScore: number | null;
  oneMultipleCutScore: number | null;
  oneMultipleBaseRank: number;
  oneMultipleActualRank: number | null;
  oneMultipleTieCount: number | null;
  possibleRange: { min: number | null; max: number | null };
  likelyRange: { min: number | null; max: number | null };
  sureMinScore: number | null;
}

type ScoreDistributionKey = "TOTAL" | "CORE" | "CRIMINAL_LAW" | "POLICE_STUDIES";

interface ScoreDistributionConfig {
  key: ScoreDistributionKey;
  label: string;
  maxScore: number;
  step: number;
  failThreshold: number | null;
  subjectName: string | null;
}

interface ScoreDistributionBucket {
  key: string;
  label: string;
  min: number;
  max: number;
  count: number;
  isFailRange: boolean;
  isMine: boolean;
}

interface ScoreDistributionItem {
  key: ScoreDistributionKey;
  label: string;
  maxScore: number;
  failThreshold: number | null;
  myScore: number | null;
  isFail: boolean | null;
  buckets: ScoreDistributionBucket[];
}

interface UserScoreSnapshot {
  totalScore: number;
  hasAnyFail: boolean;
  subjectScoresByName: Map<string, { score: number; isFail: boolean }>;
}

interface MainSectionVisibility {
  overview: boolean;
  difficulty: boolean;
  competitive: boolean;
  scoreDistribution: boolean;
}

function toSafePositiveInt(value: unknown, fallbackValue: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallbackValue;
  return Math.floor(parsed);
}

function roundNumber(value: number): number {
  return Number(value.toFixed(2));
}

function examTypeLabel(examType: ExamType): string {
  return examType === ExamType.PUBLIC ? "공채" : "경행경채";
}

function getScoreDistributionConfig(examType: ExamType): ScoreDistributionConfig[] {
  return [
    {
      key: "TOTAL",
      label: "총점",
      maxScore: 250,
      step: 50,
      failThreshold: null,
      subjectName: null,
    },
    {
      key: "CORE",
      label: examType === ExamType.PUBLIC ? "헌법" : "범죄학",
      maxScore: 50,
      step: 10,
      failThreshold: 20,
      subjectName: examType === ExamType.PUBLIC ? "헌법" : "범죄학",
    },
    {
      key: "CRIMINAL_LAW",
      label: "형사법",
      maxScore: 100,
      step: 10,
      failThreshold: 40,
      subjectName: "형사법",
    },
    {
      key: "POLICE_STUDIES",
      label: "경찰학",
      maxScore: 100,
      step: 10,
      failThreshold: 40,
      subjectName: "경찰학",
    },
  ];
}

function getDistributionBucketCount(maxScore: number, step: number): number {
  return Math.floor(maxScore / step) + 1;
}

function getDistributionBucketIndex(score: number, maxScore: number, step: number): number {
  const bucketCount = getDistributionBucketCount(maxScore, step);
  const lastIndex = Math.max(0, bucketCount - 1);
  const safeScore = Math.min(maxScore, Math.max(0, score));
  if (safeScore >= maxScore) {
    return lastIndex;
  }
  return Math.max(0, Math.min(lastIndex, Math.floor(safeScore / step)));
}

function buildDistributionBuckets(
  maxScore: number,
  step: number,
  failThreshold: number | null,
  countsByBucket: Map<number, number>,
  myScore: number | null
): ScoreDistributionBucket[] {
  const bucketCount = getDistributionBucketCount(maxScore, step);
  const myBucketIndex =
    myScore === null ? null : getDistributionBucketIndex(myScore, maxScore, step);

  return Array.from({ length: bucketCount }, (_, index) => {
    const isLast = index === bucketCount - 1;
    const min = isLast ? maxScore : index * step;
    const max = isLast ? maxScore : index * step + step - 1;
    const label = min === max ? `${min}점` : `${min}~${max}점`;

    return {
      key: `${min}-${max}`,
      label,
      min,
      max,
      count: countsByBucket.get(index) ?? 0,
      isFailRange: failThreshold !== null && max < failThreshold,
      isMine: myBucketIndex === index,
    };
  });
}

function buildScoreDistributions(params: {
  enabledExamTypes: ExamType[];
  subjects: Array<{ id: number; name: string; examType: ExamType; maxScore: number }>;
  totalScoreRows: Array<{ examType: ExamType; totalScore: number; count: number }>;
  subjectScoreRows: Array<{ subjectId: number; rawScore: number; count: number }>;
  myScoresByExamType: Map<ExamType, UserScoreSnapshot>;
}): Record<ExamType, ScoreDistributionItem[]> {
  const result: Record<ExamType, ScoreDistributionItem[]> = {
    [ExamType.PUBLIC]: [],
    [ExamType.CAREER]: [],
  };

  const subjectMetaByTypeAndName = new Map<string, { id: number }>();
  for (const subject of params.subjects) {
    subjectMetaByTypeAndName.set(`${subject.examType}:${subject.name}`, { id: subject.id });
  }

  const subjectScoreRowsBySubjectId = new Map<number, Array<{ rawScore: number; count: number }>>();
  for (const row of params.subjectScoreRows) {
    const current = subjectScoreRowsBySubjectId.get(row.subjectId) ?? [];
    current.push({ rawScore: row.rawScore, count: row.count });
    subjectScoreRowsBySubjectId.set(row.subjectId, current);
  }

  const totalCountsByExamType = new Map<ExamType, Map<number, number>>();
  for (const row of params.totalScoreRows) {
    const bucketIndex = getDistributionBucketIndex(row.totalScore, 250, 50);
    const byBucket = totalCountsByExamType.get(row.examType) ?? new Map<number, number>();
    byBucket.set(bucketIndex, (byBucket.get(bucketIndex) ?? 0) + row.count);
    totalCountsByExamType.set(row.examType, byBucket);
  }

  for (const examType of params.enabledExamTypes) {
    const config = getScoreDistributionConfig(examType);
    const mySnapshot = params.myScoresByExamType.get(examType);

    result[examType] = config.map((item) => {
      const countsByBucket = new Map<number, number>();
      let myScore: number | null = null;
      let isFail: boolean | null = null;

      if (item.key === "TOTAL") {
        const totalCounts = totalCountsByExamType.get(examType);
        if (totalCounts) {
          for (const [bucket, count] of totalCounts.entries()) {
            countsByBucket.set(bucket, count);
          }
        }

        myScore = mySnapshot ? roundNumber(mySnapshot.totalScore) : null;
        isFail = mySnapshot ? mySnapshot.hasAnyFail : null;
      } else if (item.subjectName) {
        const subjectMeta = subjectMetaByTypeAndName.get(`${examType}:${item.subjectName}`);
        if (subjectMeta) {
          const rows = subjectScoreRowsBySubjectId.get(subjectMeta.id) ?? [];
          for (const row of rows) {
            const bucket = getDistributionBucketIndex(row.rawScore, item.maxScore, item.step);
            countsByBucket.set(bucket, (countsByBucket.get(bucket) ?? 0) + row.count);
          }
        }

        const mySubjectScore = mySnapshot?.subjectScoresByName.get(item.subjectName);
        myScore = mySubjectScore ? roundNumber(mySubjectScore.score) : null;
        isFail = mySubjectScore ? mySubjectScore.isFail : null;
      }

      return {
        key: item.key,
        label: item.label,
        maxScore: item.maxScore,
        failThreshold: item.failThreshold,
        myScore,
        isFail,
        buckets: buildDistributionBuckets(
          item.maxScore,
          item.step,
          item.failThreshold,
          countsByBucket,
          myScore
        ),
      };
    });
  }

  return result;
}

function buildScoreBands(rows: ScoreBandRow[]): Array<{ score: number; count: number }> {
  return rows.map((row) => ({
    score: Number(row.finalScore),
    count: row._count._all,
  }));
}

function getScoreAtRank(
  scoreBands: Array<{ score: number; count: number }>,
  rank: number
): number | null {
  if (!Number.isInteger(rank) || rank < 1) {
    return null;
  }

  let covered = 0;
  for (const band of scoreBands) {
    covered += band.count;
    if (covered >= rank) {
      return roundNumber(band.score);
    }
  }

  return null;
}

function getScoreBandInfoAtRank(
  scoreBands: Array<{ score: number; count: number }>,
  rank: number
): { score: number; startRank: number; endRank: number; count: number } | null {
  if (!Number.isInteger(rank) || rank < 1) {
    return null;
  }

  let covered = 0;
  let lastBandInfo: { score: number; startRank: number; endRank: number; count: number } | null = null;
  for (const band of scoreBands) {
    const startRank = covered + 1;
    const endRank = covered + band.count;
    lastBandInfo = {
      score: roundNumber(band.score),
      startRank,
      endRank,
      count: band.count,
    };
    if (startRank <= rank && endRank >= rank) {
      return lastBandInfo;
    }
    covered = endRank;
  }

  return lastBandInfo;
}

function getScoreRange(
  scoreBands: Array<{ score: number; count: number }>,
  startRank: number,
  endRank: number
): { min: number | null; max: number | null } {
  if (!Number.isInteger(startRank) || !Number.isInteger(endRank) || startRank > endRank || startRank < 1) {
    return { min: null, max: null };
  }

  const max = getScoreAtRank(scoreBands, startRank);
  const min = getScoreAtRank(scoreBands, endRank);

  return {
    min,
    max,
  };
}

function getQuotaRecruitCount(quota: QuotaRow, examType: ExamType): number {
  return examType === ExamType.PUBLIC ? quota.recruitCount : quota.recruitCountCareer;
}

function getQuotaApplicantCount(
  quota: QuotaRow,
  examType: ExamType
): { applicantCount: number | null; isExact: boolean } {
  const actual = examType === ExamType.PUBLIC ? quota.applicantCount : quota.applicantCountCareer;
  if (typeof actual === "number" && Number.isFinite(actual) && actual >= 0) {
    return {
      applicantCount: Math.floor(actual),
      isExact: true,
    };
  }
  return {
    applicantCount: null,
    isExact: false,
  };
}

async function getQuotasForExam(examId: number): Promise<QuotaRow[]> {
  try {
    return await prisma.$queryRaw<QuotaRow[]>`
      SELECT
        q."regionId",
        r."name" AS "regionName",
        q."recruitCount",
        q."recruitCountCareer",
        q."applicantCount",
        q."applicantCountCareer"
      FROM "exam_region_quotas" q
      JOIN "Region" r ON r.id = q."regionId"
      WHERE q."examId" = ${examId}
        AND r."isActive" = true
      ORDER BY r."name" ASC
    `;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("isActive")) {
      throw error;
    }

    // isActive 컬럼이 없는 경우 폴백
    return await prisma.$queryRaw<QuotaRow[]>`
      SELECT
        q."regionId",
        r."name" AS "regionName",
        q."recruitCount",
        q."recruitCountCareer",
        q."applicantCount",
        q."applicantCountCareer"
      FROM "exam_region_quotas" q
      JOIN "Region" r ON r.id = q."regionId"
      WHERE q."examId" = ${examId}
      ORDER BY r."name" ASC
    `;
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const userId = Number(session.user.id);

  try {
    const activeExam = await prisma.exam.findFirst({
      where: { isActive: true },
      orderBy: [{ examDate: "desc" }, { id: "desc" }],
      select: {
        id: true,
        name: true,
        year: true,
        round: true,
      },
    });

    const [notices, settings] = await Promise.all([getActiveNotices(), getSiteSettings()]);
    const careerExamEnabled = Boolean(settings["site.careerExamEnabled"] ?? true);
    const sectionVisibility: MainSectionVisibility = {
      overview: Boolean(settings["site.mainCardOverviewEnabled"] ?? true),
      difficulty: Boolean(settings["site.mainCardDifficultyEnabled"] ?? true),
      competitive: Boolean(settings["site.mainCardCompetitiveEnabled"] ?? true),
      scoreDistribution: Boolean(settings["site.mainCardScoreDistributionEnabled"] ?? true),
    };
    const enabledExamTypes: ExamType[] = careerExamEnabled
      ? [ExamType.PUBLIC, ExamType.CAREER]
      : [ExamType.PUBLIC];
    const refreshInterval = toSafePositiveInt(settings["site.mainPageRefreshInterval"], 60);

    if (!activeExam) {
      return NextResponse.json({
        updatedAt: new Date().toISOString(),
        careerExamEnabled,
        liveStats: null,
        sectionVisibility,
        notices,
        difficulty: null,
        rows: [],
        topCompetitive: [],
        leastCompetitive: [],
        scoreDistributions: {
          [ExamType.PUBLIC]: [],
          [ExamType.CAREER]: [],
        },
        refresh: {
          enabled: Boolean(settings["site.mainPageAutoRefresh"]),
          intervalSec: refreshInterval,
        },
      });
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const [totalParticipants, examTypeStats, recentParticipants, latestSubmission, difficulty, quotas, mySubmissions] =
      await Promise.all([
        prisma.submission.count({
          where: { examId: activeExam.id },
        }),
        prisma.submission.groupBy({
          by: ["examType"],
          where: { examId: activeExam.id },
          _count: {
            _all: true,
          },
        }),
        prisma.submission.count({
          where: {
            examId: activeExam.id,
            createdAt: { gte: oneHourAgo },
          },
        }),
        prisma.submission.findFirst({
          where: { examId: activeExam.id },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        getDifficultyStats(activeExam.id),
        getQuotasForExam(activeExam.id),
        Number.isInteger(userId) && userId > 0
          ? prisma.submission.findMany({
              where: {
                examId: activeExam.id,
                userId,
              },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              select: {
                examType: true,
                totalScore: true,
                subjectScores: {
                  select: {
                    isFailed: true,
                    rawScore: true,
                    subject: {
                      select: {
                        name: true,
                      },
                    },
                  },
                },
              },
            })
          : Promise.resolve([]),
      ]);

    const publicParticipants =
      examTypeStats.find((item) => item.examType === ExamType.PUBLIC)?._count._all ?? 0;
    const careerParticipants = careerExamEnabled
      ? examTypeStats.find((item) => item.examType === ExamType.CAREER)?._count._all ?? 0
      : 0;

    const liveStats = {
      examName: activeExam.name,
      examYear: activeExam.year,
      examRound: activeExam.round,
      totalParticipants,
      publicParticipants,
      careerParticipants,
      recentParticipants,
      updatedAt: latestSubmission?.createdAt?.toISOString() ?? null,
    };

    const populationWhere: Prisma.SubmissionWhereInput = {
      examId: activeExam.id,
      isSuspicious: false,
      subjectScores: {
        some: {},
        none: {
          isFailed: true,
        },
      },
    };

    const [participantStats, scoreBandStats, totalScoreDistributionRaw, subjectScoreDistributionRaw, subjects] =
      await Promise.all([
      prisma.submission.groupBy({
        by: ["regionId", "examType"],
        where: populationWhere,
        _count: {
          _all: true,
        },
        _avg: {
          finalScore: true,
        },
      }),
      prisma.submission.groupBy({
        by: ["regionId", "examType", "finalScore"],
        where: populationWhere,
        _count: {
          _all: true,
        },
        orderBy: [{ regionId: "asc" }, { examType: "asc" }, { finalScore: "desc" }],
      }),
      prisma.submission.groupBy({
        by: ["examType", "totalScore"],
        where: {
          examId: activeExam.id,
          isSuspicious: false,
        },
        _count: {
          _all: true,
        },
      }),
      prisma.subjectScore.groupBy({
        by: ["subjectId", "rawScore"],
        where: {
          submission: {
            examId: activeExam.id,
            isSuspicious: false,
          },
        },
        _count: {
          _all: true,
        },
      }),
      prisma.subject.findMany({
        select: {
          id: true,
          name: true,
          examType: true,
          maxScore: true,
        },
      }),
    ]);

    const participantMap = new Map(
      participantStats.map((item) => [
        `${item.regionId}-${item.examType}`,
        {
          participantCount: item._count._all,
          averageFinalScore: item._avg.finalScore === null ? null : roundNumber(Number(item._avg.finalScore)),
        },
      ])
    );

    const scoreBandMap = new Map<string, ScoreBandRow[]>();
    for (const row of scoreBandStats) {
      const key = `${row.regionId}-${row.examType}`;
      const current = scoreBandMap.get(key) ?? [];
      current.push({
        regionId: row.regionId,
        examType: row.examType,
        finalScore: Number(row.finalScore),
        _count: {
          _all: row._count._all,
        },
      });
      scoreBandMap.set(key, current);
    }

    const rows: MainStatsRow[] = [];

    for (const quota of quotas) {
      for (const examType of enabledExamTypes) {
        const recruitCount = getQuotaRecruitCount(quota, examType);
        if (recruitCount < 1) {
          continue;
        }

        const key = `${quota.regionId}-${examType}`;
        const participant = participantMap.get(key);
        const participantCount = participant?.participantCount ?? 0;
        const averageFinalScore = participant?.averageFinalScore ?? null;
        const applicantCountInfo = getQuotaApplicantCount(quota, examType);
        const estimatedApplicants = applicantCountInfo.applicantCount ?? 0;
        const competitionRate =
          recruitCount > 0 && applicantCountInfo.applicantCount !== null
            ? roundNumber(applicantCountInfo.applicantCount / recruitCount)
            : null;

        const scoreBands = buildScoreBands(scoreBandMap.get(key) ?? []);
        const oneMultipleBand = getScoreBandInfoAtRank(scoreBands, recruitCount);
        const oneMultipleCutScore = oneMultipleBand?.score ?? null;
        const oneMultipleActualRank = oneMultipleBand?.endRank ?? null;
        const oneMultipleTieCount = oneMultipleBand?.count ?? null;

        const passMultiple = getPassMultiple(recruitCount);
        const likelyMultiple = getLikelyMultiple(passMultiple);
        const likelyMaxRank = Math.max(1, Math.floor(recruitCount * likelyMultiple));
        const passCount = Math.ceil(recruitCount * passMultiple);

        const likelyRange = getScoreRange(scoreBands, recruitCount + 1, likelyMaxRank);
        const possibleRange = getScoreRange(scoreBands, likelyMaxRank + 1, passCount);
        const sureMinScore = getScoreAtRank(scoreBands, recruitCount);

        rows.push({
          regionId: quota.regionId,
          regionName: quota.regionName,
          examType,
          examTypeLabel: examTypeLabel(examType),
          recruitCount,
          applicantCount: applicantCountInfo.applicantCount,
          estimatedApplicants,
          isApplicantCountExact: applicantCountInfo.isExact,
          competitionRate,
          participantCount,
          averageFinalScore,
          oneMultipleCutScore,
          oneMultipleBaseRank: recruitCount,
          oneMultipleActualRank,
          oneMultipleTieCount,
          possibleRange,
          likelyRange,
          sureMinScore,
        });
      }
    }

    const myScoresByExamType = new Map<ExamType, UserScoreSnapshot>();
    for (const submission of mySubmissions) {
      if (myScoresByExamType.has(submission.examType)) {
        continue;
      }

      const subjectScoresByName = new Map<string, { score: number; isFail: boolean }>();
      for (const subjectScore of submission.subjectScores) {
        subjectScoresByName.set(subjectScore.subject.name, {
          score: Number(subjectScore.rawScore),
          isFail: subjectScore.isFailed,
        });
      }

      myScoresByExamType.set(submission.examType, {
        totalScore: Number(submission.totalScore),
        hasAnyFail: submission.subjectScores.some((subjectScore) => subjectScore.isFailed),
        subjectScoresByName,
      });
    }

    const scoreDistributions = buildScoreDistributions({
      enabledExamTypes,
      subjects: subjects.map((subject) => ({
        id: subject.id,
        name: subject.name,
        examType: subject.examType,
        maxScore: Number(subject.maxScore),
      })),
      totalScoreRows: totalScoreDistributionRaw.map((row) => ({
        examType: row.examType,
        totalScore: Number(row.totalScore),
        count: row._count._all,
      })),
      subjectScoreRows: subjectScoreDistributionRaw.map((row) => ({
        subjectId: row.subjectId,
        rawScore: Number(row.rawScore),
        count: row._count._all,
      })),
      myScoresByExamType,
    });

    const competitiveBase = rows
      .filter(
        (row) =>
          row.averageFinalScore !== null &&
          row.sureMinScore !== null &&
          row.participantCount >= 1
      )
      .map((row) => ({
        label: `${row.regionName}-${row.examTypeLabel}`,
        averageFinalScore: row.averageFinalScore as number,
        sureMinScore: row.sureMinScore as number,
        gap: roundNumber((row.sureMinScore as number) - (row.averageFinalScore as number)),
      }));

    const topCompetitive = competitiveBase
      .slice()
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 5)
      .map((item, index) => ({ rank: index + 1, ...item }));

    const leastCompetitive = competitiveBase
      .slice()
      .sort((a, b) => a.gap - b.gap)
      .slice(0, 5)
      .map((item, index) => ({ rank: index + 1, ...item }));

    return NextResponse.json(
      {
        updatedAt: new Date().toISOString(),
        careerExamEnabled,
        liveStats,
        sectionVisibility,
        notices,
        difficulty,
        rows,
        topCompetitive,
        leastCompetitive,
        scoreDistributions,
        refresh: {
          enabled: Boolean(settings["site.mainPageAutoRefresh"]),
          intervalSec: refreshInterval,
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("풀서비스 메인 통계 조회 중 오류가 발생했습니다.", error);
    return NextResponse.json({ error: "풀서비스 메인 통계 조회에 실패했습니다." }, { status: 500 });
  }
}
