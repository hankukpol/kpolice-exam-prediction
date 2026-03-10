import { BonusType, ExamType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPassMultiple, getRecruitCount, maskKoreanName } from "@/lib/prediction";

interface RankRow {
  submissionId: number;
  score75: number;
  isVeteranPreferred: boolean;
  writtenScore: number;
  martialBonusPoint: number;
}

export interface KnownFinalScoreResult {
  writtenScore: number;
  written50: number;
  fitnessBase: number;
  martialBonusPoint: number;
  fitnessTotal: number;
  fitnessBonus25: number;
  fitness25: number;
  score75: number | null;
}

export function roundScore(value: number): number {
  return Number(value.toFixed(2));
}

function isVeteranBonusType(bonusType: BonusType): boolean {
  return bonusType === BonusType.VETERAN_5 || bonusType === BonusType.VETERAN_10;
}

function compareRankRow(left: RankRow, right: RankRow): number {
  if (right.score75 !== left.score75) {
    return right.score75 - left.score75;
  }

  if (right.isVeteranPreferred !== left.isVeteranPreferred) {
    return Number(right.isVeteranPreferred) - Number(left.isVeteranPreferred);
  }

  if (right.writtenScore !== left.writtenScore) {
    return right.writtenScore - left.writtenScore;
  }

  if (right.martialBonusPoint !== left.martialBonusPoint) {
    return right.martialBonusPoint - left.martialBonusPoint;
  }

  return left.submissionId - right.submissionId;
}

// Competition ranking: 동점자 공동등수, 다음 등수 건너뛰기
function toRankMap(rows: RankRow[]): Map<number, number> {
  const sorted = [...rows].sort(compareRankRow);
  const rankMap = new Map<number, number>();

  for (let index = 0; index < sorted.length; index += 1) {
    if (index === 0) {
      rankMap.set(sorted[index].submissionId, 1);
    } else {
      const prevScore75 = sorted[index - 1].score75;
      const currScore75 = sorted[index].score75;
      if (currScore75 === prevScore75) {
        rankMap.set(sorted[index].submissionId, rankMap.get(sorted[index - 1].submissionId)!);
      } else {
        rankMap.set(sorted[index].submissionId, index + 1);
      }
    }
  }

  return rankMap;
}

export function getMartialBonusPoint(danLevel: number): number {
  if (!Number.isFinite(danLevel)) return 0;
  if (danLevel >= 4) return 2;
  if (danLevel >= 2) return 1;
  return 0;
}

/**
 * 2026년 경찰 최종 환산 공식 (면접 제외)
 *
 * Written50 = (필기점수 / 250) × 100 × 0.5    → 필기 환산 (50점 만점)
 * 체력평가  = 48 + 무도가산(0~2)               → 체력 평가 (50점 만점)
 * Fitness25 = 체력평가 × 0.5                   → 체력 환산 (25점 만점)
 * Score75   = Written50 + Fitness25            → 면접 제외 환산 (75점 만점)
 *
 * ※ 필기점수는 submission.finalScore (원점수 + 취업지원/의사상자 가산점 포함)
 */
export function calculateKnownFinalScore(params: {
  writtenScore: number;
  fitnessPassed: boolean;
  martialDanLevel: number;
  bonusRate: number;
}): KnownFinalScoreResult {
  const writtenScore = Math.max(0, params.writtenScore);
  const written50 = roundScore((writtenScore / 250) * 100 * 0.5);
  const martialBonusPoint = getMartialBonusPoint(params.martialDanLevel);
  const fitnessBase = 48;
  const fitnessTotal = fitnessBase + martialBonusPoint;
  const fitnessBonus25 = roundScore(25 * (params.bonusRate || 0));
  const fitness25 = roundScore(fitnessTotal * 0.5 + fitnessBonus25);

  if (!params.fitnessPassed) {
    return {
      writtenScore,
      written50,
      fitnessBase,
      martialBonusPoint,
      fitnessTotal,
      fitnessBonus25,
      fitness25,
      score75: null,
    };
  }

  const score75 = roundScore(written50 + fitness25);

  return {
    writtenScore,
    written50,
    fitnessBase,
    martialBonusPoint,
    fitnessTotal,
    fitnessBonus25,
    fitness25,
    score75,
  };
}

// ─────────────────────────────────────────────────────────
// 최종 환산 순위 상세 (경쟁자 테이블·1배수 합격 판정 포함)
// ─────────────────────────────────────────────────────────

export interface FinalRankingCompetitor {
  rank: number;
  score: number;
  maskedName: string;
  isMine: boolean;
}

export interface FinalRankingDetails {
  finalRank: number | null;
  totalParticipants: number;
  recruitCount: number;
  passMultiple: number;
  oneMultipleCutScore: number | null;
  isWithinOneMultiple: boolean;
  examTypeLabel: string;
  regionName: string;
  userName: string;
  myScore: number | null;
  competitors: FinalRankingCompetitor[];
}

function toFinalExamTypeLabel(examType: ExamType): string {
  return examType === ExamType.CAREER ? "경행경채" : "공채";
}

/**
 * 최종 환산 순위 상세 계산
 * - 모집인원(1배수) 대비 합격 여부 판정
 * - 1배수 커트라인 점수 산출
 * - 경쟁자 순위 테이블 (상위 50명 + 본인)
 * - 경찰: 성별 구분 없음, interviewGrade=PASS 필터, competition ranking(동점 공동등수)
 */
export async function calculateFinalRankingDetails(params: {
  examId: number;
  regionId: number;
  examType: ExamType;
  submissionId: number;
}): Promise<FinalRankingDetails | null> {
  // 1. ExamRegionQuota 조회 (모집인원·지역명)
  const quota = await prisma.examRegionQuota.findUnique({
    where: {
      examId_regionId: {
        examId: params.examId,
        regionId: params.regionId,
      },
    },
    include: {
      region: { select: { name: true } },
    },
  });
  if (!quota) return null;

  const recruitCount = getRecruitCount(quota, params.examType);
  if (recruitCount < 1) return null;

  const passMultiple = getPassMultiple(recruitCount);

  // 2. 동일 모집단 FinalPrediction 조회 (체력 통과자만)
  const rows = await prisma.finalPrediction.findMany({
    where: {
      finalScore: { not: null },
      interviewGrade: "PASS",
      submission: {
        examId: params.examId,
        regionId: params.regionId,
        examType: params.examType,
      },
    },
    select: {
      submissionId: true,
      finalScore: true,
      fitnessScore: true,
      submission: {
        select: {
          finalScore: true,
          bonusType: true,
          user: { select: { name: true } },
        },
      },
    },
  });

  if (rows.length < 1) return null;

  // 3. 정렬 및 competition ranking (동점 공동등수)
  const rankRows: (RankRow & { userName: string })[] = rows.map((row) => {
    const martialBonusPoint = row.fitnessScore === null ? 0 : Number(row.fitnessScore);
    return {
      submissionId: row.submissionId,
      score75: Number(row.finalScore),
      isVeteranPreferred: isVeteranBonusType(row.submission.bonusType),
      writtenScore: Number(row.submission.finalScore),
      martialBonusPoint,
      userName: row.submission.user.name,
    };
  });

  const sorted = [...rankRows].sort(compareRankRow);

  // Competition ranking: 동점자 공동등수
  const ranks: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) {
      ranks.push(1);
    } else if (sorted[i].score75 === sorted[i - 1].score75) {
      ranks.push(ranks[i - 1]);
    } else {
      ranks.push(i + 1);
    }
  }

  const myIndex = sorted.findIndex((r) => r.submissionId === params.submissionId);
  const myRank = myIndex >= 0 ? ranks[myIndex] : null;
  const myRow = myIndex >= 0 ? sorted[myIndex] : null;

  // 4. 1배수 커트라인 점수
  let oneMultipleCutScore: number | null = null;
  if (sorted.length >= recruitCount) {
    oneMultipleCutScore = roundScore(sorted[recruitCount - 1].score75);
  }

  // 5. 경쟁자 목록 (상위 50명, 본인이 범위 밖이면 추가)
  const MAX_COMPETITORS = 50;
  const topSlice = sorted.slice(0, MAX_COMPETITORS);
  const userInTop = topSlice.some((r) => r.submissionId === params.submissionId);

  const competitorRows = userInTop || myIndex < 0
    ? topSlice
    : [...topSlice, sorted[myIndex]];

  const competitors: FinalRankingCompetitor[] = competitorRows.map((row) => {
    const idx = sorted.indexOf(row);
    return {
      rank: ranks[idx],
      score: roundScore(row.score75),
      maskedName: maskKoreanName(row.userName),
      isMine: row.submissionId === params.submissionId,
    };
  });

  return {
    finalRank: myRank,
    totalParticipants: sorted.length,
    recruitCount,
    passMultiple: roundScore(passMultiple),
    oneMultipleCutScore,
    isWithinOneMultiple: myRank !== null && myRank <= recruitCount,
    examTypeLabel: toFinalExamTypeLabel(params.examType),
    regionName: quota.region.name,
    userName: myRow ? myRow.userName : "",
    myScore: myRow ? roundScore(myRow.score75) : null,
    competitors,
  };
}

export async function calculateKnownFinalRank(params: {
  examId: number;
  regionId: number;
  examType: ExamType;
  submissionId: number;
}): Promise<{ finalRank: number | null; totalParticipants: number }> {
  const rows = await prisma.finalPrediction.findMany({
    where: {
      finalScore: { not: null },
      interviewGrade: "PASS",
      submission: {
        examId: params.examId,
        regionId: params.regionId,
        examType: params.examType,
      },
    },
    select: {
      submissionId: true,
      finalScore: true,
      fitnessScore: true,
      submission: {
        select: {
          finalScore: true,
          bonusType: true,
        },
      },
    },
  });

  if (rows.length < 1) {
    return { finalRank: null, totalParticipants: 0 };
  }

  const rankMap = toRankMap(
    rows.map((row) => {
      const martialBonusPoint = row.fitnessScore === null ? 0 : Number(row.fitnessScore);

      return {
        submissionId: row.submissionId,
        score75: Number(row.finalScore),
        isVeteranPreferred: isVeteranBonusType(row.submission.bonusType),
        writtenScore: Number(row.submission.finalScore),
        martialBonusPoint,
      };
    })
  );

  return {
    finalRank: rankMap.get(params.submissionId) ?? null,
    totalParticipants: rows.length,
  };
}
