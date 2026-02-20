import { ExamType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const SMALL_RECRUIT_PASS_COUNTS: Record<number, number> = {
  1: 3,
  2: 6,
  3: 8,
  4: 9,
  5: 10,
};

const SCORE_COMPARE_EPSILON = 1e-9;

export const PREDICTION_DISCLAIMER =
  "본 서비스는 참여자 데이터 기반 예측이며, 실제 합격 결과와 다를 수 있습니다.";

export type PredictionGrade = "확실권" | "유력권" | "가능권" | "도전권";

export type PyramidLevelKey = "sure" | "likely" | "possible" | "challenge" | "belowChallenge";

export interface PredictionCompetitor {
  submissionId: number;
  userId: number;
  rank: number;
  score: number;
  maskedName: string;
  isMine: boolean;
}

export interface PredictionLevel {
  key: PyramidLevelKey;
  label: string;
  count: number;
  minScore: number | null;
  maxScore: number | null;
  minMultiple: number | null;
  maxMultiple: number | null;
  isCurrent: boolean;
}

export interface PredictionSummary {
  submissionId: number;
  examId: number;
  examName: string;
  examYear: number;
  examRound: number;
  userName: string;
  examType: ExamType;
  examTypeLabel: string;
  regionId: number;
  regionName: string;
  recruitCount: number;
  estimatedApplicants: number;
  totalParticipants: number;
  myScore: number;
  myRank: number;
  myMultiple: number;
  passMultiple: number;
  likelyMultiple: number;
  passCount: number;
  passLineScore: number | null;
  predictionGrade: PredictionGrade;
  disclaimer: string;
}

export interface PredictionResult {
  summary: PredictionSummary;
  pyramid: {
    levels: PredictionLevel[];
    counts: Record<PyramidLevelKey, number>;
  };
  competitors: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    items: PredictionCompetitor[];
  };
  updatedAt: string;
}

interface RankedParticipant {
  submissionId: number;
  userId: number;
  name: string;
  score: number;
  rank: number;
}

interface CalculatePredictionOptions {
  submissionId?: number;
  page?: number;
  limit?: number;
}

export class PredictionError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PredictionError";
    this.status = status;
  }
}

function toSafeNumber(value: number): number {
  return Number(value.toFixed(2));
}

function isSameScore(a: number, b: number): boolean {
  return Math.abs(a - b) <= SCORE_COMPARE_EPSILON;
}

function toExamTypeLabel(examType: ExamType): string {
  return examType === ExamType.CAREER ? "경행경채" : "공채";
}

export function maskKoreanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "익명**";

  const chars = Array.from(trimmed);
  return `${chars[0]}**`;
}

export function getPassMultiple(recruitCount: number): number {
  if (recruitCount >= 150) return 1.5;
  if (recruitCount >= 100) return 1.6;
  if (recruitCount >= 50) return 1.7;
  if (recruitCount >= 6) return 1.8;

  const passCount = SMALL_RECRUIT_PASS_COUNTS[recruitCount];
  if (!passCount) {
    throw new PredictionError("유효하지 않은 선발인원입니다.", 500);
  }

  return passCount / recruitCount;
}

function getRecruitCount(
  region: { recruitCount: number; recruitCountCareer: number },
  examType: ExamType
): number {
  if (examType === ExamType.CAREER) {
    return region.recruitCountCareer > 0 ? region.recruitCountCareer : region.recruitCount;
  }
  return region.recruitCount;
}

function classifyGrade(myMultiple: number, passMultiple: number): PredictionGrade {
  const likelyMultiple = passMultiple * 0.8;

  if (myMultiple <= 1) return "확실권";
  if (myMultiple <= likelyMultiple) return "유력권";
  if (myMultiple <= passMultiple) return "가능권";
  return "도전권";
}

function getMaxRankByMultiple(recruitCount: number, multiple: number): number {
  return Math.max(1, Math.floor(recruitCount * multiple));
}

function getMinScoreWithinRank(participants: RankedParticipant[], maxRank: number): number | null {
  const selected = participants.filter((participant) => participant.rank <= maxRank);
  if (selected.length === 0) {
    return null;
  }

  return selected[selected.length - 1].score;
}

function getMaxScoreWithinRank(participants: RankedParticipant[], minRank: number): number | null {
  const selected = participants.find((participant) => participant.rank >= minRank);
  return selected ? selected.score : null;
}

function rankParticipants(
  participants: Array<{
    id: number;
    userId: number;
    finalScore: number;
    user: { name: string };
  }>
): RankedParticipant[] {
  const sorted = [...participants].sort((a, b) => {
    if (!isSameScore(b.finalScore, a.finalScore)) {
      return b.finalScore - a.finalScore;
    }
    return a.id - b.id;
  });

  let currentRank = 0;
  let previousScore: number | null = null;

  return sorted.map((participant, index) => {
    if (previousScore === null || !isSameScore(participant.finalScore, previousScore)) {
      currentRank = index + 1;
      previousScore = participant.finalScore;
    }

    return {
      submissionId: participant.id,
      userId: participant.userId,
      name: participant.user.name,
      score: toSafeNumber(participant.finalScore),
      rank: currentRank,
    };
  });
}

function parsePage(value: number | undefined): number {
  if (!value || !Number.isInteger(value) || value < 1) return 1;
  return value;
}

function parseLimit(value: number | undefined): number {
  if (!value || !Number.isInteger(value) || value < 1) return 20;
  return Math.min(value, 50);
}

function toLevel(
  key: PyramidLevelKey,
  label: string,
  count: number,
  minScore: number | null,
  maxScore: number | null,
  minMultiple: number | null,
  maxMultiple: number | null,
  isCurrent: boolean
): PredictionLevel {
  return {
    key,
    label,
    count,
    minScore: minScore === null ? null : toSafeNumber(minScore),
    maxScore: maxScore === null ? null : toSafeNumber(maxScore),
    minMultiple: minMultiple === null ? null : toSafeNumber(minMultiple),
    maxMultiple: maxMultiple === null ? null : toSafeNumber(maxMultiple),
    isCurrent,
  };
}

export async function calculatePrediction(
  userId: number,
  options: CalculatePredictionOptions = {}
): Promise<PredictionResult> {
  const page = parsePage(options.page);
  const limit = parseLimit(options.limit);

  const submission = options.submissionId
    ? await prisma.submission.findFirst({
        where: {
          id: options.submissionId,
          userId,
        },
        select: {
          id: true,
          examId: true,
          regionId: true,
          examType: true,
          finalScore: true,
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
          user: {
            select: {
              name: true,
            },
          },
          subjectScores: {
            select: {
              isFailed: true,
            },
          },
        },
      })
    : await prisma.submission.findFirst({
        where: { userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          examId: true,
          regionId: true,
          examType: true,
          finalScore: true,
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
          user: {
            select: {
              name: true,
            },
          },
          subjectScores: {
            select: {
              isFailed: true,
            },
          },
        },
      });

  if (!submission) {
    throw new PredictionError("합격예측을 위한 제출 데이터가 없습니다.", 404);
  }

  if (submission.subjectScores.some((subjectScore) => subjectScore.isFailed)) {
    throw new PredictionError("과락으로 인해 합격예측을 제공할 수 없습니다.", 400);
  }

  const recruitCount = getRecruitCount(submission.region, submission.examType);
  if (!Number.isInteger(recruitCount) || recruitCount < 1) {
    throw new PredictionError("선발인원 정보가 올바르지 않습니다.", 500);
  }

  const passMultiple = getPassMultiple(recruitCount);
  const likelyMultiple = passMultiple * 0.8;
  const challengeMultiple = passMultiple * 1.3;
  const passCount = Math.ceil(recruitCount * passMultiple);
  const likelyMaxRank = getMaxRankByMultiple(recruitCount, likelyMultiple);
  const challengeMaxRank = getMaxRankByMultiple(recruitCount, challengeMultiple);

  const participants = await prisma.submission.findMany({
    where: {
      examId: submission.examId,
      regionId: submission.regionId,
      examType: submission.examType,
      subjectScores: {
        some: {},
        none: {
          isFailed: true,
        },
      },
    },
    select: {
      id: true,
      userId: true,
      finalScore: true,
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  if (participants.length === 0) {
    throw new PredictionError("합격예측을 위한 참여 데이터가 아직 없습니다.", 404);
  }

  const rankedParticipants = rankParticipants(participants);
  const totalParticipants = rankedParticipants.length;
  const myParticipant = rankedParticipants.find((participant) => participant.submissionId === submission.id);

  if (!myParticipant) {
    throw new PredictionError("합격예측 대상 데이터가 없습니다.", 404);
  }

  const myRank = myParticipant.rank;
  const myScore = toSafeNumber(submission.finalScore);
  const myMultiple = myRank / recruitCount;
  const predictionGrade = classifyGrade(myMultiple, passMultiple);

  const passCandidates = rankedParticipants.filter((participant) => participant.rank <= passCount);
  const passLineScore = passCandidates.length > 0 ? passCandidates[passCandidates.length - 1].score : null;

  const sureCount = rankedParticipants.filter((participant) => participant.rank <= recruitCount).length;
  const likelyCount = rankedParticipants.filter(
    (participant) => participant.rank > recruitCount && participant.rank <= likelyMaxRank
  ).length;
  const possibleCount = rankedParticipants.filter(
    (participant) => participant.rank > likelyMaxRank && participant.rank <= passCount
  ).length;
  const challengeCount = rankedParticipants.filter(
    (participant) => participant.rank > passCount && participant.rank <= challengeMaxRank
  ).length;
  const belowChallengeCount = rankedParticipants.filter(
    (participant) => participant.rank > challengeMaxRank
  ).length;

  const myLevelKey: PyramidLevelKey =
    myMultiple <= 1
      ? "sure"
      : myMultiple <= likelyMultiple
        ? "likely"
        : myMultiple <= passMultiple
          ? "possible"
          : myMultiple <= challengeMultiple
            ? "challenge"
            : "belowChallenge";

  const levels: PredictionLevel[] = [
    toLevel(
      "sure",
      "확실권",
      sureCount,
      getMinScoreWithinRank(rankedParticipants, recruitCount),
      getMaxScoreWithinRank(rankedParticipants, 1),
      null,
      1,
      myLevelKey === "sure"
    ),
    toLevel(
      "likely",
      "유력권",
      likelyCount,
      getMinScoreWithinRank(rankedParticipants, likelyMaxRank),
      getMaxScoreWithinRank(rankedParticipants, recruitCount + 1),
      1,
      likelyMultiple,
      myLevelKey === "likely"
    ),
    toLevel(
      "possible",
      "가능권",
      possibleCount,
      getMinScoreWithinRank(rankedParticipants, passCount),
      getMaxScoreWithinRank(rankedParticipants, likelyMaxRank + 1),
      likelyMultiple,
      passMultiple,
      myLevelKey === "possible"
    ),
    toLevel(
      "challenge",
      "도전권",
      challengeCount,
      getMinScoreWithinRank(rankedParticipants, challengeMaxRank),
      getMaxScoreWithinRank(rankedParticipants, passCount + 1),
      passMultiple,
      challengeMultiple,
      myLevelKey === "challenge"
    ),
    toLevel(
      "belowChallenge",
      "도전권 이하",
      belowChallengeCount,
      null,
      getMaxScoreWithinRank(rankedParticipants, challengeMaxRank + 1),
      challengeMultiple,
      null,
      myLevelKey === "belowChallenge"
    ),
  ];

  const totalPages = Math.max(1, Math.ceil(totalParticipants / limit));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * limit;
  const endIndex = startIndex + limit;

  const competitorItems: PredictionCompetitor[] = rankedParticipants.slice(startIndex, endIndex).map((item) => ({
    submissionId: item.submissionId,
    userId: item.userId,
    rank: item.rank,
    score: item.score,
    maskedName: maskKoreanName(item.name),
    isMine: item.submissionId === submission.id,
  }));

  return {
    summary: {
      submissionId: submission.id,
      examId: submission.exam.id,
      examName: submission.exam.name,
      examYear: submission.exam.year,
      examRound: submission.exam.round,
      userName: submission.user.name,
      examType: submission.examType,
      examTypeLabel: toExamTypeLabel(submission.examType),
      regionId: submission.region.id,
      regionName: submission.region.name,
      recruitCount,
      estimatedApplicants: recruitCount * 20,
      totalParticipants,
      myScore,
      myRank,
      myMultiple: toSafeNumber(myMultiple),
      passMultiple: toSafeNumber(passMultiple),
      likelyMultiple: toSafeNumber(likelyMultiple),
      passCount,
      passLineScore: passLineScore === null ? null : toSafeNumber(passLineScore),
      predictionGrade,
      disclaimer: PREDICTION_DISCLAIMER,
    },
    pyramid: {
      levels,
      counts: {
        sure: sureCount,
        likely: likelyCount,
        possible: possibleCount,
        challenge: challengeCount,
        belowChallenge: belowChallengeCount,
      },
    },
    competitors: {
      page: safePage,
      limit,
      totalCount: totalParticipants,
      totalPages,
      items: competitorItems,
    },
    updatedAt: new Date().toISOString(),
  };
}
