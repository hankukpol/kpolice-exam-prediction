import {
  BonusType,
  DifficultyRatingLevel,
  ExamType,
  Gender,
  Prisma,
  Role,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

const MOCK_USER_PREFIX = "[MOCK]";
const MOCK_PHONE_PREFIX = "090999";
const MOCK_EXAM_NUMBER_PREFIX = "MOCK";
const MOCK_PASSWORD_HASH = "$2b$10$HAfAnxSKfZT/tKe9Gy7TquBLOLCOYOcunzMXDAbmX0CtjayhJBb5S";

const DEFAULT_PUBLIC_PER_REGION = 40;
const DEFAULT_CAREER_PER_REGION = 20;
const MIN_PER_REGION = 1;
const MAX_PER_REGION = 200;

interface SubjectInfo {
  id: number;
  name: string;
  examType: ExamType;
  maxScore: number;
}

interface RegionInfo {
  id: number;
  name: string;
  recruitCount: number;
  recruitCountCareer: number;
}

interface SubmissionDraft {
  phone: string;
  examType: ExamType;
  regionId: number;
  examNumber: string;
  gender: Gender;
  totalScore: number;
  bonusType: BonusType;
  bonusRate: number;
  finalScore: number;
  subjectScores: Array<{
    subjectId: number;
    rawScore: number;
    isFailed: boolean;
    rating: DifficultyRatingLevel;
  }>;
}

export interface GenerateMockDataOptions {
  examId?: number;
  publicPerRegion?: number;
  careerPerRegion?: number;
  careerEnabled?: boolean;
  resetBeforeGenerate?: boolean;
}

export interface GenerateMockDataResult {
  examId: number;
  examName: string;
  runKey: string;
  deletedBeforeGenerate: {
    submissions: number;
    users: number;
  };
  created: {
    users: number;
    submissions: number;
    subjectScores: number;
    difficultyRatings: number;
  };
}

export interface ResetMockDataOptions {
  examId?: number;
}

export interface ResetMockDataResult {
  examId: number | null;
  deleted: {
    submissions: number;
    users: number;
  };
}

type MockDbClient = Prisma.TransactionClient | typeof prisma;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toSafeInt(value: unknown, fallbackValue: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallbackValue;
  return clamp(Math.floor(parsed), min, max);
}

function roundOne(value: number): number {
  return Number(value.toFixed(1));
}

function roundTwo(value: number): number {
  return Number(value.toFixed(2));
}

function randomGender(): Gender {
  return Math.random() < 0.7 ? Gender.MALE : Gender.FEMALE;
}

function chooseBonusType(recruitCount: number): BonusType {
  const roll = Math.random();
  if (roll < 0.8) return BonusType.NONE;
  if (roll < 0.9) return BonusType.VETERAN_5;
  if (roll < 0.95) return BonusType.VETERAN_10;

  if (recruitCount >= 10) {
    return roll < 0.975 ? BonusType.HERO_3 : BonusType.HERO_5;
  }

  return BonusType.NONE;
}

function bonusRateOf(type: BonusType): number {
  if (type === BonusType.VETERAN_5) return 0.05;
  if (type === BonusType.VETERAN_10) return 0.1;
  if (type === BonusType.HERO_3) return 0.03;
  if (type === BonusType.HERO_5) return 0.05;
  return 0;
}

function pickDifficultyByPercent(percent: number): DifficultyRatingLevel {
  if (percent >= 90) return DifficultyRatingLevel.VERY_EASY;
  if (percent >= 80) return DifficultyRatingLevel.EASY;
  if (percent >= 65) return DifficultyRatingLevel.NORMAL;
  if (percent >= 50) return DifficultyRatingLevel.HARD;
  return DifficultyRatingLevel.VERY_HARD;
}

function createScoreDraft(
  subjects: SubjectInfo[],
  scorePercent: number,
  allowFailNoise: boolean
): SubmissionDraft["subjectScores"] {
  return subjects.map((subject) => {
    const localNoise = (Math.random() - 0.5) * 0.12;
    let percent = clamp(scorePercent + localNoise, 0.22, 0.99);

    // Keep a small low-tail to mimic real-world cutoff failures.
    if (allowFailNoise && Math.random() < 0.07) {
      percent = clamp(percent - 0.28, 0.18, 0.5);
    }

    const rawScore = roundOne(subject.maxScore * percent);
    const isFailed = rawScore < subject.maxScore * 0.4;
    const rating = pickDifficultyByPercent((rawScore / subject.maxScore) * 100);

    return {
      subjectId: subject.id,
      rawScore,
      isFailed,
      rating,
    };
  });
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (items.length < 1) return [];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

async function resolveExam(examId?: number, db: MockDbClient = prisma) {
  if (examId && Number.isInteger(examId) && examId > 0) {
    const selected = await db.exam.findUnique({
      where: { id: examId },
      select: { id: true, name: true },
    });
    if (selected) return selected;
  }

  return db.exam.findFirst({
    where: { isActive: true },
    orderBy: [{ examDate: "desc" }, { id: "desc" }],
    select: { id: true, name: true },
  });
}

async function resetMockDataWithClient(
  db: MockDbClient,
  options: ResetMockDataOptions = {}
): Promise<ResetMockDataResult> {
  const examId = options.examId;
  const submissionWhere: Prisma.SubmissionWhereInput = {
    examNumber: {
      startsWith: `${MOCK_EXAM_NUMBER_PREFIX}-`,
    },
    ...(examId ? { examId } : {}),
  };

  const existing = await db.submission.findMany({
    where: submissionWhere,
    select: {
      id: true,
      userId: true,
    },
  });

  const submissionIds = existing.map((row) => row.id);
  const candidateUserIds: number[] = Array.from(new Set<number>(existing.map((row) => row.userId)));

  let deletedSubmissionCount = 0;
  for (const ids of chunkArray(submissionIds, 500)) {
    const deleted = await db.submission.deleteMany({
      where: {
        id: { in: ids },
      },
    });
    deletedSubmissionCount += deleted.count;
  }

  const userDeleteWhere: Prisma.UserWhereInput =
    examId && candidateUserIds.length > 0
      ? {
          id: { in: candidateUserIds },
          name: { startsWith: `${MOCK_USER_PREFIX}:` },
          phone: { startsWith: MOCK_PHONE_PREFIX },
          role: Role.USER,
          submissions: { none: {} },
          comments: { none: {} },
          answerKeyLogs: { none: {} },
        }
      : {
          name: { startsWith: `${MOCK_USER_PREFIX}:` },
          phone: { startsWith: MOCK_PHONE_PREFIX },
          role: Role.USER,
          submissions: { none: {} },
          comments: { none: {} },
          answerKeyLogs: { none: {} },
        };

  let deletedUserCount = 0;
  const deletableUsers = await db.user.findMany({
    where: userDeleteWhere,
    select: { id: true },
  });

  for (const ids of chunkArray(deletableUsers.map((row) => row.id), 500)) {
    const deleted = await db.user.deleteMany({
      where: { id: { in: ids } },
    });
    deletedUserCount += deleted.count;
  }

  return {
    examId: examId ?? null,
    deleted: {
      submissions: deletedSubmissionCount,
      users: deletedUserCount,
    },
  };
}

export async function resetMockData(options: ResetMockDataOptions = {}): Promise<ResetMockDataResult> {
  return prisma.$transaction(async (tx) => resetMockDataWithClient(tx, options));
}

export async function generateMockData(
  options: GenerateMockDataOptions = {}
): Promise<GenerateMockDataResult> {
  const targetExam = await resolveExam(options.examId);
  if (!targetExam) {
    throw new Error("활성 시험이 없어 목업 데이터를 생성할 수 없습니다.");
  }

  const publicPerRegion = toSafeInt(
    options.publicPerRegion,
    DEFAULT_PUBLIC_PER_REGION,
    MIN_PER_REGION,
    MAX_PER_REGION
  );
  const careerPerRegion = toSafeInt(
    options.careerPerRegion,
    DEFAULT_CAREER_PER_REGION,
    MIN_PER_REGION,
    MAX_PER_REGION
  );
  const careerEnabled = options.careerEnabled !== false;
  const resetBeforeGenerate = options.resetBeforeGenerate !== false;

  const [regions, subjects] = await Promise.all([
    prisma.region.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        recruitCount: true,
        recruitCountCareer: true,
      },
    }),
    prisma.subject.findMany({
      orderBy: [{ examType: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        examType: true,
        maxScore: true,
      },
    }),
  ]);

  const subjectsByType: Record<ExamType, SubjectInfo[]> = {
    [ExamType.PUBLIC]: subjects
      .filter((subject) => subject.examType === ExamType.PUBLIC)
      .map((subject) => ({
        ...subject,
        maxScore: Number(subject.maxScore),
      })),
    [ExamType.CAREER]: subjects
      .filter((subject) => subject.examType === ExamType.CAREER)
      .map((subject) => ({
        ...subject,
        maxScore: Number(subject.maxScore),
      })),
  };

  const runKey = `${Date.now()}`;
  const runPhoneSeed = runKey.slice(-8);

  const drafts: SubmissionDraft[] = [];
  const mockUsers: Array<{
    name: string;
    phone: string;
    password: string;
    role: Role;
  }> = [];

  let serial = 0;

  for (let regionIndex = 0; regionIndex < regions.length; regionIndex += 1) {
    const region: RegionInfo = regions[regionIndex];

    const examTypes = careerEnabled
      ? ([ExamType.PUBLIC, ExamType.CAREER] as const)
      : ([ExamType.PUBLIC] as const);

    for (const examType of examTypes) {
      const subjectsOfType = subjectsByType[examType];
      if (subjectsOfType.length < 1) continue;

      const recruitCount =
        examType === ExamType.PUBLIC ? region.recruitCount : region.recruitCountCareer;
      if (!Number.isInteger(recruitCount) || recruitCount < 1) continue;

      const perRegionCount = examType === ExamType.PUBLIC ? publicPerRegion : careerPerRegion;
      const maxTotal = subjectsOfType.reduce((sum, subject) => sum + subject.maxScore, 0);
      const regionBias = ((regionIndex % 9) - 4) * 0.028;

      for (let localIndex = 0; localIndex < perRegionCount; localIndex += 1) {
        serial += 1;
        const rankRatio = perRegionCount > 1 ? localIndex / (perRegionCount - 1) : 0;
        const basePercent = 0.92 - rankRatio * 0.36 + regionBias + (Math.random() - 0.5) * 0.03;
        const scorePercent = clamp(basePercent, 0.4, 0.98);
        const subjectScores = createScoreDraft(subjectsOfType, scorePercent, rankRatio > 0.82);

        const totalScore = roundOne(subjectScores.reduce((sum, item) => sum + item.rawScore, 0));
        const bonusType = chooseBonusType(recruitCount);
        const bonusRate = bonusRateOf(bonusType);
        const finalScore = roundTwo(totalScore * (1 + bonusRate));

        const phone = `${MOCK_PHONE_PREFIX}${runPhoneSeed}${String(serial).padStart(4, "0")}`;
        const examNumber = `${MOCK_EXAM_NUMBER_PREFIX}-${targetExam.id}-${runKey}-${region.id}-${examType}-${String(
          localIndex + 1
        ).padStart(3, "0")}`;

        mockUsers.push({
          name: `${MOCK_USER_PREFIX}:${targetExam.id}:${runKey}:${serial}`,
          phone,
          password: MOCK_PASSWORD_HASH,
          role: Role.USER,
        });

        drafts.push({
          phone,
          examType,
          regionId: region.id,
          examNumber,
          gender: randomGender(),
          totalScore: clamp(totalScore, 0, maxTotal),
          bonusType,
          bonusRate,
          finalScore: clamp(finalScore, 0, maxTotal * 1.12),
          subjectScores,
        });
      }
    }
  }

  if (drafts.length < 1) {
    throw new Error("생성 가능한 지역/직렬 데이터가 없어 목업 데이터 생성을 건너뛰었습니다.");
  }

  return prisma.$transaction(async (tx) => {
    const deletedBeforeGenerate = resetBeforeGenerate
      ? await resetMockDataWithClient(tx, { examId: targetExam.id })
      : { examId: targetExam.id, deleted: { submissions: 0, users: 0 } };

    await tx.user.createMany({
      data: mockUsers,
    });

    const createdUsers = await tx.user.findMany({
      where: {
        name: {
          startsWith: `${MOCK_USER_PREFIX}:${targetExam.id}:${runKey}:`,
        },
        phone: {
          startsWith: `${MOCK_PHONE_PREFIX}${runPhoneSeed}`,
        },
      },
      select: {
        id: true,
        phone: true,
      },
    });

    const userIdByPhone = new Map<string, number>(
      createdUsers.map((user) => [user.phone, user.id] as const)
    );
    const submissionCreateData: Prisma.SubmissionCreateManyInput[] = drafts.map((draft) => {
      const userId = userIdByPhone.get(draft.phone);
      if (!userId) {
        throw new Error("Failed to map generated mock users.");
      }

      return {
        examId: targetExam.id,
        userId,
        regionId: draft.regionId,
        examType: draft.examType,
        gender: draft.gender,
        examNumber: draft.examNumber,
        totalScore: draft.totalScore,
        bonusType: draft.bonusType,
        bonusRate: draft.bonusRate,
        finalScore: draft.finalScore,
      };
    });

    for (const chunk of chunkArray(submissionCreateData, 500)) {
      await tx.submission.createMany({
        data: chunk,
      });
    }

    const createdSubmissions = await tx.submission.findMany({
      where: {
        examId: targetExam.id,
        examNumber: {
          startsWith: `${MOCK_EXAM_NUMBER_PREFIX}-${targetExam.id}-${runKey}-`,
        },
      },
      select: {
        id: true,
        examNumber: true,
      },
    });

    const submissionIdByExamNumber = new Map<string, number>(
      createdSubmissions.map((submission) => [submission.examNumber, submission.id] as const)
    );

    const subjectScoreRows: Prisma.SubjectScoreCreateManyInput[] = [];
    const difficultyRows: Prisma.DifficultyRatingCreateManyInput[] = [];

    for (const draft of drafts) {
      const submissionId = submissionIdByExamNumber.get(draft.examNumber);
      if (!submissionId) {
        throw new Error("Failed to map generated mock submissions.");
      }

      for (const score of draft.subjectScores) {
        subjectScoreRows.push({
          submissionId,
          subjectId: score.subjectId,
          rawScore: score.rawScore,
          isFailed: score.isFailed,
        });

        difficultyRows.push({
          submissionId,
          subjectId: score.subjectId,
          rating: score.rating,
        });
      }
    }

    for (const chunk of chunkArray(subjectScoreRows, 1000)) {
      await tx.subjectScore.createMany({
        data: chunk,
      });
    }

    for (const chunk of chunkArray(difficultyRows, 1000)) {
      await tx.difficultyRating.createMany({
        data: chunk,
      });
    }

    return {
      examId: targetExam.id,
      examName: targetExam.name,
      runKey,
      deletedBeforeGenerate: deletedBeforeGenerate.deleted,
      created: {
        users: createdUsers.length,
        submissions: createdSubmissions.length,
        subjectScores: subjectScoreRows.length,
        difficultyRatings: difficultyRows.length,
      },
    };
  });
}

