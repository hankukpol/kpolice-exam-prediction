import "server-only";
import { ExamType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const DIFFICULTY_RATINGS = ["EASY", "NORMAL", "HARD"] as const;
export type DifficultyRatingValue = (typeof DIFFICULTY_RATINGS)[number];

interface CountAccumulator {
  EASY: number;
  NORMAL: number;
  HARD: number;
}

export interface DifficultyOverallStat {
  easy: number;
  normal: number;
  hard: number;
  dominantLabel: "쉬움" | "보통" | "어려움";
}

export interface DifficultySubjectStat extends DifficultyOverallStat {
  subjectId: number;
  subjectName: string;
  examType: ExamType;
  responses: number;
}

export interface DifficultyStatsResult {
  examId: number;
  examName: string;
  totalResponses: number;
  overall: DifficultyOverallStat;
  subjects: DifficultySubjectStat[];
}

function toPercent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Number(((part / total) * 100).toFixed(1));
}

export function getDominantLabel(
  easy: number,
  normal: number,
  hard: number
): "쉬움" | "보통" | "어려움" {
  if (hard >= easy && hard >= normal) return "어려움";
  if (easy >= normal && easy >= hard) return "쉬움";
  return "보통";
}

async function getTargetExam(examId?: number) {
  if (examId && Number.isInteger(examId) && examId > 0) {
    const selected = await prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, name: true },
    });
    if (selected) return selected;
  }

  const active = await prisma.exam.findFirst({
    where: { isActive: true },
    orderBy: [{ examDate: "desc" }, { id: "desc" }],
    select: { id: true, name: true },
  });
  if (active) return active;

  const latest = await prisma.exam.findFirst({
    orderBy: [{ examDate: "desc" }, { id: "desc" }],
    select: { id: true, name: true },
  });

  return latest;
}

export async function getDifficultyStats(examId?: number): Promise<DifficultyStatsResult | null> {
  const exam = await getTargetExam(examId);
  if (!exam) return null;

  const grouped = await prisma.difficultyRating.groupBy({
    by: ["subjectId", "rating"],
    where: {
      submission: {
        examId: exam.id,
      },
    },
    _count: {
      _all: true,
    },
  });

  if (grouped.length === 0) {
    return {
      examId: exam.id,
      examName: exam.name,
      totalResponses: 0,
      overall: {
        easy: 0,
        normal: 0,
        hard: 0,
        dominantLabel: "보통",
      },
      subjects: [],
    };
  }

  const subjectIds = Array.from(new Set(grouped.map((row) => row.subjectId)));
  const subjects = await prisma.subject.findMany({
    where: {
      id: { in: subjectIds },
    },
    select: {
      id: true,
      name: true,
      examType: true,
    },
  });

  const subjectMap = new Map(subjects.map((subject) => [subject.id, subject] as const));
  const perSubject = new Map<number, CountAccumulator>();
  const overallCounts: CountAccumulator = {
    EASY: 0,
    NORMAL: 0,
    HARD: 0,
  };

  for (const row of grouped) {
    if (!DIFFICULTY_RATINGS.includes(row.rating as DifficultyRatingValue)) {
      continue;
    }

    const rating = row.rating as DifficultyRatingValue;
    const count = row._count._all;
    const current = perSubject.get(row.subjectId) ?? { EASY: 0, NORMAL: 0, HARD: 0 };
    current[rating] += count;
    perSubject.set(row.subjectId, current);
    overallCounts[rating] += count;
  }

  const subjectStats: DifficultySubjectStat[] = [];

  for (const [subjectId, counts] of perSubject.entries()) {
    const subject = subjectMap.get(subjectId);
    if (!subject) continue;

    const responses = counts.EASY + counts.NORMAL + counts.HARD;
    const easy = toPercent(counts.EASY, responses);
    const normal = toPercent(counts.NORMAL, responses);
    const hard = toPercent(counts.HARD, responses);

    subjectStats.push({
      subjectId,
      subjectName: subject.name,
      examType: subject.examType,
      responses,
      easy,
      normal,
      hard,
      dominantLabel: getDominantLabel(easy, normal, hard),
    });
  }

  subjectStats.sort((a, b) => {
    if (a.examType !== b.examType) {
      return a.examType === ExamType.PUBLIC ? -1 : 1;
    }
    return a.subjectId - b.subjectId;
  });

  const totalResponses = overallCounts.EASY + overallCounts.NORMAL + overallCounts.HARD;
  const overallEasy = toPercent(overallCounts.EASY, totalResponses);
  const overallNormal = toPercent(overallCounts.NORMAL, totalResponses);
  const overallHard = toPercent(overallCounts.HARD, totalResponses);

  return {
    examId: exam.id,
    examName: exam.name,
    totalResponses,
    overall: {
      easy: overallEasy,
      normal: overallNormal,
      hard: overallHard,
      dominantLabel: getDominantLabel(overallEasy, overallNormal, overallHard),
    },
    subjects: subjectStats,
  };
}
