import { ExamType, Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getDifficultyStats } from "@/lib/difficulty";
import { parseEstimatedApplicantsMultiplier } from "@/lib/policy";
import { getPassMultiple } from "@/lib/prediction";
import { prisma } from "@/lib/prisma";
import { getActiveNotices, getSiteSettings } from "@/lib/site-settings";

export const runtime = "nodejs";

const ESTIMATED_APPLICANTS_MULTIPLIER = parseEstimatedApplicantsMultiplier(
  process.env.ESTIMATED_APPLICANTS_MULTIPLIER
);

interface RegionRow {
  id: number;
  name: string;
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
  estimatedApplicants: number;
  competitionRate: number;
  participantCount: number;
  averageFinalScore: number | null;
  oneMultipleCutScore: number | null;
  possibleRange: { min: number | null; max: number | null };
  likelyRange: { min: number | null; max: number | null };
  sureMinScore: number | null;
}

interface RegionRowLegacy {
  id: number;
  name: string;
  recruitCount: number;
  recruitCountCareer: number;
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

function getRegionRecruitCount(region: RegionRow, examType: ExamType): number {
  return examType === ExamType.PUBLIC ? region.recruitCount : region.recruitCountCareer;
}

function getRegionApplicantCount(region: RegionRow, examType: ExamType, recruitCount: number): number {
  const actual = examType === ExamType.PUBLIC ? region.applicantCount : region.applicantCountCareer;
  if (typeof actual === "number" && Number.isFinite(actual) && actual >= 0) {
    return Math.floor(actual);
  }
  return Math.max(0, Math.round(recruitCount * ESTIMATED_APPLICANTS_MULTIPLIER));
}

async function getRegionsWithApplicants(): Promise<RegionRow[]> {
  try {
    return await prisma.$queryRaw<RegionRow[]>`
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("applicantCount")) {
      throw error;
    }

    const legacyRows = await prisma.$queryRaw<RegionRowLegacy[]>`
      SELECT
        id,
        name,
        recruitCount,
        recruitCountCareer
      FROM Region
      ORDER BY name ASC
    `;

    return legacyRows.map((row) => ({
      ...row,
      applicantCount: null,
      applicantCountCareer: null,
    }));
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

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
    const refreshInterval = toSafePositiveInt(settings["site.mainPageRefreshInterval"], 60);

    if (!activeExam) {
      return NextResponse.json({
        updatedAt: new Date().toISOString(),
        liveStats: null,
        notices,
        difficulty: null,
        rows: [],
        topCompetitive: [],
        leastCompetitive: [],
        subjectScoreDistribution: {
          buckets: ["69% 이하", "70~79%", "80~89%", "90% 이상"],
          series: [],
        },
        refresh: {
          enabled: Boolean(settings["site.mainPageAutoRefresh"]),
          intervalSec: refreshInterval,
        },
      });
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const [totalParticipants, examTypeStats, recentParticipants, latestSubmission, difficulty, regions] =
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
        getRegionsWithApplicants(),
      ]);

    const publicParticipants =
      examTypeStats.find((item) => item.examType === ExamType.PUBLIC)?._count._all ?? 0;
    const careerParticipants =
      examTypeStats.find((item) => item.examType === ExamType.CAREER)?._count._all ?? 0;

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
      subjectScores: {
        some: {},
        none: {
          isFailed: true,
        },
      },
    };

    const [participantStats, scoreBandStats, subjectDistributionRaw] = await Promise.all([
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
      prisma.$queryRaw<
        Array<{
          subjectId: number;
          subjectName: string;
          examType: ExamType;
          bucket0: bigint | number;
          bucket1: bigint | number;
          bucket2: bigint | number;
          bucket3: bigint | number;
        }>
      >(
        Prisma.sql`
          SELECT
            sub.id AS subjectId,
            sub.name AS subjectName,
            sub.examType AS examType,
            SUM(CASE WHEN (ss.rawScore / NULLIF(sub.maxScore, 0)) * 100 < 70 THEN 1 ELSE 0 END) AS bucket0,
            SUM(CASE WHEN (ss.rawScore / NULLIF(sub.maxScore, 0)) * 100 >= 70 AND (ss.rawScore / NULLIF(sub.maxScore, 0)) * 100 < 80 THEN 1 ELSE 0 END) AS bucket1,
            SUM(CASE WHEN (ss.rawScore / NULLIF(sub.maxScore, 0)) * 100 >= 80 AND (ss.rawScore / NULLIF(sub.maxScore, 0)) * 100 < 90 THEN 1 ELSE 0 END) AS bucket2,
            SUM(CASE WHEN (ss.rawScore / NULLIF(sub.maxScore, 0)) * 100 >= 90 THEN 1 ELSE 0 END) AS bucket3
          FROM SubjectScore ss
          INNER JOIN Submission s ON s.id = ss.submissionId
          INNER JOIN Subject sub ON sub.id = ss.subjectId
          WHERE s.examId = ${activeExam.id}
          GROUP BY sub.id, sub.name, sub.examType
          ORDER BY sub.examType ASC, sub.id ASC
        `
      ),
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

    for (const region of regions) {
      for (const examType of [ExamType.PUBLIC, ExamType.CAREER] as const) {
        const recruitCount = getRegionRecruitCount(region, examType);
        if (recruitCount < 1) {
          continue;
        }

        const key = `${region.id}-${examType}`;
        const participant = participantMap.get(key);
        const participantCount = participant?.participantCount ?? 0;
        const averageFinalScore = participant?.averageFinalScore ?? null;
        const estimatedApplicants = getRegionApplicantCount(region, examType, recruitCount);
        const competitionRate = recruitCount > 0 ? roundNumber(estimatedApplicants / recruitCount) : 0;

        const scoreBands = buildScoreBands(scoreBandMap.get(key) ?? []);
        const oneMultipleCutScore = getScoreAtRank(scoreBands, recruitCount);

        const passMultiple = getPassMultiple(recruitCount);
        const likelyMultiple = passMultiple * 0.8;
        const likelyMaxRank = Math.max(1, Math.floor(recruitCount * likelyMultiple));
        const passCount = Math.ceil(recruitCount * passMultiple);

        const likelyRange = getScoreRange(scoreBands, recruitCount + 1, likelyMaxRank);
        const possibleRange = getScoreRange(scoreBands, likelyMaxRank + 1, passCount);
        const sureMinScore = getScoreAtRank(scoreBands, recruitCount);

        rows.push({
          regionId: region.id,
          regionName: region.name,
          examType,
          examTypeLabel: examTypeLabel(examType),
          recruitCount,
          estimatedApplicants,
          competitionRate,
          participantCount,
          averageFinalScore,
          oneMultipleCutScore,
          possibleRange,
          likelyRange,
          sureMinScore,
        });
      }
    }

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

    const subjectScoreDistribution = {
      buckets: ["69% 이하", "70~79%", "80~89%", "90% 이상"],
      series: subjectDistributionRaw.map((row) => ({
        subjectId: row.subjectId,
        subjectName: row.subjectName,
        examType: row.examType,
        counts: [
          typeof row.bucket0 === "bigint" ? Number(row.bucket0) : Number(row.bucket0),
          typeof row.bucket1 === "bigint" ? Number(row.bucket1) : Number(row.bucket1),
          typeof row.bucket2 === "bigint" ? Number(row.bucket2) : Number(row.bucket2),
          typeof row.bucket3 === "bigint" ? Number(row.bucket3) : Number(row.bucket3),
        ],
      })),
    };

    return NextResponse.json(
      {
        updatedAt: new Date().toISOString(),
        liveStats,
        notices,
        difficulty,
        rows,
        topCompetitive,
        leastCompetitive,
        subjectScoreDistribution,
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
