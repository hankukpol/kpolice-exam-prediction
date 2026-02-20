import { ExamType } from "@prisma/client";
import { parseEstimatedApplicantsMultiplier } from "@/lib/policy";
import { getPassMultiple } from "@/lib/prediction";
import { prisma } from "@/lib/prisma";

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

export interface PassCutPredictionRow {
  regionId: number;
  regionName: string;
  examType: ExamType;
  recruitCount: number;
  estimatedApplicants: number;
  competitionRate: number;
  participantCount: number;
  averageScore: number | null;
  oneMultipleCutScore: number | null;
  sureMinScore: number | null;
  likelyMinScore: number | null;
  possibleMinScore: number | null;
}

function roundNumber(value: number): number {
  return Number(value.toFixed(2));
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

  return {
    max: getScoreAtRank(scoreBands, startRank),
    min: getScoreAtRank(scoreBands, endRank),
  };
}

function getRegionRecruitCount(region: RegionRow, examType: ExamType): number {
  return examType === ExamType.PUBLIC ? region.recruitCount : region.recruitCountCareer;
}

function getRegionApplicantCount(region: RegionRow, examType: ExamType, recruitCount: number): number {
  const raw = examType === ExamType.PUBLIC ? region.applicantCount : region.applicantCountCareer;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return Math.floor(raw);
  }
  return Math.max(0, Math.round(recruitCount * ESTIMATED_APPLICANTS_MULTIPLIER));
}

export async function buildPassCutPredictionRows(params: {
  examId: number;
  includeCareerExamType: boolean;
}): Promise<PassCutPredictionRow[]> {
  const examTypes: ExamType[] = params.includeCareerExamType
    ? [ExamType.PUBLIC, ExamType.CAREER]
    : [ExamType.PUBLIC];

  const [regions, participantStats, scoreBandStats] = await Promise.all([
    prisma.$queryRaw<RegionRow[]>`
      SELECT
        id,
        name,
        recruitCount,
        recruitCountCareer,
        applicantCount,
        applicantCountCareer
      FROM Region
      ORDER BY name ASC
    `,
    prisma.submission.groupBy({
      by: ["regionId", "examType"],
      where: {
        examId: params.examId,
        subjectScores: {
          some: {},
          none: {
            isFailed: true,
          },
        },
      },
      _count: {
        _all: true,
      },
      _avg: {
        finalScore: true,
      },
    }),
    prisma.submission.groupBy({
      by: ["regionId", "examType", "finalScore"],
      where: {
        examId: params.examId,
        subjectScores: {
          some: {},
          none: {
            isFailed: true,
          },
        },
      },
      _count: {
        _all: true,
      },
      orderBy: [{ regionId: "asc" }, { examType: "asc" }, { finalScore: "desc" }],
    }),
  ]);

  const participantMap = new Map(
    participantStats.map((item) => [
      `${item.regionId}-${item.examType}`,
      {
        participantCount: item._count._all,
        averageScore: item._avg.finalScore === null ? null : roundNumber(Number(item._avg.finalScore)),
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

  const rows: PassCutPredictionRow[] = [];

  for (const region of regions) {
    for (const examType of examTypes) {
      const recruitCount = getRegionRecruitCount(region, examType);
      if (!Number.isInteger(recruitCount) || recruitCount < 1) {
        continue;
      }

      const participant = participantMap.get(`${region.id}-${examType}`);
      const participantCount = participant?.participantCount ?? 0;
      const averageScore = participant?.averageScore ?? null;
      const estimatedApplicants = getRegionApplicantCount(region, examType, recruitCount);
      const competitionRate = recruitCount > 0 ? roundNumber(estimatedApplicants / recruitCount) : 0;

      const scoreBands = buildScoreBands(scoreBandMap.get(`${region.id}-${examType}`) ?? []);
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
        recruitCount,
        estimatedApplicants,
        competitionRate,
        participantCount,
        averageScore,
        oneMultipleCutScore,
        sureMinScore,
        likelyMinScore: likelyRange.min,
        possibleMinScore: possibleRange.min,
      });
    }
  }

  return rows;
}

export function getCurrentPassCutSnapshot(
  rows: PassCutPredictionRow[],
  regionId: number,
  examType: ExamType
): {
  participantCount: number;
  recruitCount: number;
  averageScore: number | null;
  oneMultipleCutScore: number | null;
  sureMinScore: number | null;
  likelyMinScore: number | null;
  possibleMinScore: number | null;
} {
  const matched = rows.find((row) => row.regionId === regionId && row.examType === examType);
  if (!matched) {
    return {
      participantCount: 0,
      recruitCount: 0,
      averageScore: null,
      oneMultipleCutScore: null,
      sureMinScore: null,
      likelyMinScore: null,
      possibleMinScore: null,
    };
  }

  return {
    participantCount: matched.participantCount,
    recruitCount: matched.recruitCount,
    averageScore: matched.averageScore,
    oneMultipleCutScore: matched.oneMultipleCutScore,
    sureMinScore: matched.sureMinScore,
    likelyMinScore: matched.likelyMinScore,
    possibleMinScore: matched.possibleMinScore,
  };
}
