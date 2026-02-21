import { BonusType, ExamType, Gender, Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { invalidateCorrectRateCache } from "@/lib/correct-rate";
import { getRegionRecruitCount, normalizeSubjectName, parsePositiveInt } from "@/lib/exam-utils";
import { getPassMultiple } from "@/lib/prediction";
import { prisma } from "@/lib/prisma";
import { getSiteSettingsUncached } from "@/lib/site-settings";
import {
  calculateScore,
  getBonusPercent,
  getBonusTypeFromPercent,
  isValidBonusType,
  type AnswerInput,
} from "@/lib/scoring";

export const runtime = "nodejs";

const BAD_REQUEST_ERROR_PATTERNS = [
  "정답키",
  "올바르지",
  "유효하지 않은",
  "유효한",
  "중복",
  "가산점",
  "문항",
  "답안",
  "과목",
  "채용유형",
  "성별",
  "응시번호",
  "체감 난이도",
  "지역",
  "최소",
  "동시에 적용",
  "가능합니다",
];

interface SubmissionRequestBody {
  examId?: unknown;
  examType?: unknown;
  gender?: unknown;
  regionId?: unknown;
  examNumber?: unknown;
  difficulty?: unknown;
  bonusType?: unknown;
  veteranPercent?: unknown;
  heroPercent?: unknown;
  answers?: unknown;
}

type DifficultyRatingValue = "VERY_EASY" | "EASY" | "NORMAL" | "HARD" | "VERY_HARD";

const ALLOWED_DIFFICULTY_RATINGS: ReadonlySet<DifficultyRatingValue> = new Set([
  "VERY_EASY",
  "EASY",
  "NORMAL",
  "HARD",
  "VERY_HARD",
]);

function parseExamType(value: unknown): ExamType | null {
  if (value === ExamType.PUBLIC) return ExamType.PUBLIC;
  if (value === ExamType.CAREER) return ExamType.CAREER;
  return null;
}

function parseGender(value: unknown): Gender | null {
  if (value === Gender.MALE) return Gender.MALE;
  if (value === Gender.FEMALE) return Gender.FEMALE;
  return null;
}

function parsePercent(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseExamNumber(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, 50);
}

function parseDifficulty(
  value: unknown
): Array<{
  subjectName: string;
  rating: DifficultyRatingValue;
}> {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("체감 난이도 형식이 올바르지 않습니다.");
  }

  const deduped = new Map<
    string,
    {
      subjectName: string;
      rating: DifficultyRatingValue;
    }
  >();

  for (const item of value) {
    if (!item || typeof item !== "object") {
      throw new Error("체감 난이도 항목 형식이 올바르지 않습니다.");
    }

    const subjectNameRaw = (item as { subjectName?: unknown }).subjectName;
    const ratingRaw = (item as { rating?: unknown }).rating;

    const subjectName = typeof subjectNameRaw === "string" ? subjectNameRaw.trim() : "";
    if (!subjectName) {
      continue;
    }

    if (typeof ratingRaw !== "string") {
      throw new Error("체감 난이도 값이 올바르지 않습니다.");
    }

    const normalizedRating = ratingRaw.trim().toUpperCase() as DifficultyRatingValue;
    if (!ALLOWED_DIFFICULTY_RATINGS.has(normalizedRating)) {
      throw new Error("체감 난이도 값은 VERY_EASY, EASY, NORMAL, HARD, VERY_HARD만 가능합니다.");
    }

    deduped.set(normalizeSubjectName(subjectName), {
      subjectName,
      rating: normalizedRating,
    });
  }

  return Array.from(deduped.values());
}

function parseAnswers(value: unknown): AnswerInput[] {
  if (!Array.isArray(value)) {
    throw new Error("답안 데이터 형식이 올바르지 않습니다.");
  }

  const parsed: AnswerInput[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!item || typeof item !== "object") {
      throw new Error("답안 항목 형식이 올바르지 않습니다.");
    }

    const subjectNameRaw = (item as { subjectName?: unknown }).subjectName;
    const questionNoRaw = (item as { questionNo?: unknown }).questionNo;
    const answerRaw = (item as { answer?: unknown }).answer;

    const subjectName = typeof subjectNameRaw === "string" ? subjectNameRaw.trim() : "";
    const questionNo = parsePositiveInt(questionNoRaw);
    const answer = parsePositiveInt(answerRaw);

    if (!subjectName) {
      throw new Error("과목명이 누락된 답안이 있습니다.");
    }
    if (!questionNo) {
      throw new Error(`${subjectName} 문항 번호가 올바르지 않습니다.`);
    }
    if (!answer || answer > 4) {
      throw new Error(`${subjectName} ${questionNo}번 답안은 1~4만 가능합니다.`);
    }

    const duplicateKey = `${normalizeSubjectName(subjectName)}:${questionNo}`;
    if (seen.has(duplicateKey)) {
      throw new Error(`${subjectName} ${questionNo}번 문항이 중복 제출되었습니다.`);
    }
    seen.add(duplicateKey);

    parsed.push({
      subjectName,
      questionNo,
      answer,
    });
  }

  return parsed;
}

function resolveBonusType(body: SubmissionRequestBody): BonusType {
  if (typeof body.bonusType === "string") {
    if (!isValidBonusType(body.bonusType)) {
      throw new Error("가산점 유형이 올바르지 않습니다.");
    }
    return body.bonusType;
  }

  const veteranPercent = parsePercent(body.veteranPercent);
  const heroPercent = parsePercent(body.heroPercent);
  return getBonusTypeFromPercent(veteranPercent, heroPercent);
}

function inferErrorStatus(message: string): number {
  if (message.includes("가산점") || message.includes("상한")) {
    return 400;
  }
  return BAD_REQUEST_ERROR_PATTERNS.some((pattern) => message.includes(pattern)) ? 400 : 500;
}

function isHeroBonusType(bonusType: BonusType): boolean {
  return bonusType === BonusType.HERO_3 || bonusType === BonusType.HERO_5;
}

async function validateHeroBonusPassCap(params: {
  examId: number;
  regionId: number;
  examType: ExamType;
  recruitCount: number;
  submissionId?: number;
  bonusType: BonusType;
  totalScore: number;
  finalScore: number;
  hasCutoff: boolean;
}): Promise<void> {
  if (!isHeroBonusType(params.bonusType) || params.hasCutoff) {
    return;
  }

  const capCount = Math.floor(params.recruitCount * 0.1);
  if (capCount < 1) {
    throw new Error("의사상자 가산점 합격 상한(선발예정인원 10%)을 적용할 수 없는 모집단입니다.");
  }

  const passMultiple = getPassMultiple(params.recruitCount);
  const passCount = Math.ceil(params.recruitCount * passMultiple);
  if (passCount < 1) {
    return;
  }

  const existingRows = await prisma.submission.findMany({
    where: {
      examId: params.examId,
      regionId: params.regionId,
      examType: params.examType,
      subjectScores: {
        some: {},
        none: {
          isFailed: true,
        },
      },
    },
    select: {
      id: true,
      totalScore: true,
      finalScore: true,
      bonusType: true,
    },
  });

  const fallbackId =
    existingRows.reduce((maxId, row) => (row.id > maxId ? row.id : maxId), 0) + 1;
  const candidateId = params.submissionId ?? fallbackId;

  const rows = existingRows
    .filter((row) => row.id !== candidateId)
    .map((row) => ({
      id: row.id,
      totalScore: Number(row.totalScore),
      finalScore: Number(row.finalScore),
      bonusType: row.bonusType,
    }));

  rows.push({
    id: candidateId,
    totalScore: params.totalScore,
    finalScore: params.finalScore,
    bonusType: params.bonusType,
  });

  const passByFinal = [...rows]
    .sort((left, right) => right.finalScore - left.finalScore || left.id - right.id)
    .slice(0, passCount);
  const passByRaw = [...rows]
    .sort((left, right) => right.totalScore - left.totalScore || left.id - right.id)
    .slice(0, passCount);
  const rawPasserIds = new Set(passByRaw.map((row) => row.id));
  const heroBeneficiaries = passByFinal.filter(
    (row) => isHeroBonusType(row.bonusType) && !rawPasserIds.has(row.id)
  );

  if (heroBeneficiaries.length > capCount) {
    throw new Error(
      `의사상자 가산점으로 합격 가능한 인원 상한(${capCount}명, 선발예정인원의 10%)을 초과합니다.`
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    let body: SubmissionRequestBody;
    try {
      body = (await request.json()) as SubmissionRequestBody;
    } catch {
      return NextResponse.json({ error: "요청 본문(JSON) 형식이 올바르지 않습니다." }, { status: 400 });
    }

    const userId = parsePositiveInt(session.user.id);
    if (!userId) {
      return NextResponse.json({ error: "사용자 정보를 확인할 수 없습니다." }, { status: 401 });
    }

    const examType = parseExamType(body.examType);
    if (!examType) {
      return NextResponse.json({ error: "채용유형은 PUBLIC 또는 CAREER만 가능합니다." }, { status: 400 });
    }

    const settings = await getSiteSettingsUncached();
    const careerExamEnabled = Boolean(settings["site.careerExamEnabled"] ?? true);
    if (examType === ExamType.CAREER && !careerExamEnabled) {
      return NextResponse.json(
        { error: "현재 경행경채 시험이 비활성화되어 제출할 수 없습니다." },
        { status: 400 }
      );
    }

    const gender = parseGender(body.gender);
    if (!gender) {
      return NextResponse.json({ error: "성별 정보가 올바르지 않습니다." }, { status: 400 });
    }

    const regionId = parsePositiveInt(body.regionId);
    if (!regionId) {
      return NextResponse.json({ error: "지역 정보가 올바르지 않습니다." }, { status: 400 });
    }

    const answers = parseAnswers(body.answers);
    if (answers.length === 0) {
      return NextResponse.json({ error: "최소 1개 이상의 답안을 입력해 주세요." }, { status: 400 });
    }

    const difficulty = parseDifficulty(body.difficulty);

    const requestedExamId = parsePositiveInt(body.examId);
    const exam = requestedExamId
      ? await prisma.exam.findUnique({
        where: { id: requestedExamId },
        select: { id: true, name: true, isActive: true },
      })
      : await prisma.exam.findFirst({
        where: { isActive: true },
        orderBy: [{ examDate: "desc" }, { id: "desc" }],
        select: { id: true, name: true, isActive: true },
      });

    if (!exam) {
      return NextResponse.json({ error: "제출 가능한 시험이 없습니다." }, { status: 404 });
    }
    if (!exam.isActive) {
      return NextResponse.json({ error: "현재 활성화된 시험에만 성적 입력이 가능합니다." }, { status: 400 });
    }

    const existingSubmission = await prisma.submission.findFirst({
      where: {
        userId,
        examId: exam.id,
      },
      select: {
        id: true,
      },
    });
    if (existingSubmission) {
      return NextResponse.json(
        { error: "이미 해당 시험에 제출한 기록이 있습니다." },
        { status: 409 }
      );
    }

    const region = await prisma.region.findUnique({
      where: { id: regionId },
      select: {
        id: true,
        name: true,
        isActive: true,
        recruitCount: true,
        recruitCountCareer: true,
      },
    });

    if (!region) {
      return NextResponse.json({ error: "선택한 지역을 찾을 수 없습니다." }, { status: 404 });
    }
    if (!region.isActive) {
      return NextResponse.json(
        { error: "비활성화된 지역은 성적 입력이 불가능합니다. 관리자에게 문의해주세요." },
        { status: 400 }
      );
    }

    const examNumber = parseExamNumber(body.examNumber);
    if (!examNumber) {
      return NextResponse.json({ error: "응시번호는 필수 입력 항목입니다." }, { status: 400 });
    }

    const bonusType = resolveBonusType(body);
    const bonusRate = getBonusPercent(bonusType);
    const recruitCount = getRegionRecruitCount(region, examType);
    if (!Number.isInteger(recruitCount) || recruitCount < 1) {
      const message =
        examType === ExamType.CAREER
          ? "선택한 지역의 경행경채 모집인원이 설정되지 않았습니다. 관리자에게 문의해주세요."
          : "선택한 지역의 모집인원이 올바르지 않습니다.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if ((bonusType === BonusType.HERO_3 || bonusType === BonusType.HERO_5) && recruitCount < 10) {
      return NextResponse.json(
        { error: "의사상자 가산점은 모집인원 10명 이상 지역에서만 선택 가능합니다." },
        { status: 400 }
      );
    }

    const scoreResult = await calculateScore({
      examId: exam.id,
      examType,
      answers,
      bonusType,
      bonusRate,
    });

    if (isHeroBonusType(bonusType)) {
      await validateHeroBonusPassCap({
        examId: exam.id,
        regionId: region.id,
        examType,
        recruitCount,
        bonusType,
        totalScore: scoreResult.totalScore,
        finalScore: scoreResult.finalScore,
        hasCutoff: scoreResult.hasCutoff,
      });
    }

    const submission = await prisma.$transaction(async (tx) => {
      const savedSubmission = await tx.submission.create({
        data: {
          examId: exam.id,
          userId,
          regionId: region.id,
          examType,
          gender,
          examNumber,
          totalScore: scoreResult.totalScore,
          bonusType,
          bonusRate,
          finalScore: scoreResult.finalScore,
        },
      });

      if (scoreResult.userAnswers.length > 0) {
        await tx.userAnswer.createMany({
          data: scoreResult.userAnswers.map((answer) => ({
            submissionId: savedSubmission.id,
            subjectId: answer.subjectId,
            questionNumber: answer.questionNo,
            selectedAnswer: answer.selectedAnswer,
            isCorrect: answer.isCorrect,
          })),
        });
      }

      await tx.subjectScore.createMany({
        data: scoreResult.scores.map((score) => ({
          submissionId: savedSubmission.id,
          subjectId: score.subjectId,
          rawScore: score.rawScore,
          isFailed: score.isCutoff,
        })),
      });

      if (difficulty.length > 0) {
        const subjectIdByName = new Map(
          scoreResult.scores.map((score) => [normalizeSubjectName(score.subjectName), score.subjectId] as const)
        );

        const difficultyData = difficulty
          .map((item) => {
            const subjectId = subjectIdByName.get(normalizeSubjectName(item.subjectName));
            if (!subjectId) return null;

            return {
              submissionId: savedSubmission.id,
              subjectId,
              rating: item.rating,
            };
          })
          .filter(
            (
              row
            ): row is {
              submissionId: number;
              subjectId: number;
              rating: DifficultyRatingValue;
            } => row !== null
          );

        if (difficultyData.length > 0) {
          await tx.difficultyRating.createMany({
            data: difficultyData,
          });
        }
      }

      return savedSubmission;
    });

    invalidateCorrectRateCache(exam.id, examType);

    return NextResponse.json({
      success: true,
      submissionId: submission.id,
      result: scoreResult,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const targetRaw = error.meta?.target;
      const target = Array.isArray(targetRaw)
        ? targetRaw.map((item) => String(item))
        : typeof targetRaw === "string"
          ? [targetRaw]
          : [];

      if (target.some((item) => item.includes("examNumber"))) {
        return NextResponse.json(
          { error: "해당 지역에 동일한 응시번호가 이미 존재합니다. 응시번호를 확인해 주세요." },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "이미 해당 시험에 제출한 기록이 있습니다." },
        { status: 409 }
      );
    }
    const message = error instanceof Error ? error.message : "답안 제출 처리 중 오류가 발생했습니다.";
    const status = inferErrorStatus(message);

    if (status === 500) {
      console.error("답안 제출 처리 중 오류가 발생했습니다.", error);
    }

    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    let body: SubmissionRequestBody & { submissionId: unknown };
    try {
      body = (await request.json()) as SubmissionRequestBody & { submissionId: unknown };
    } catch {
      return NextResponse.json({ error: "요청 본문(JSON) 형식이 올바르지 않습니다." }, { status: 400 });
    }
    const submissionId = parsePositiveInt(body.submissionId);

    if (!submissionId) {
      return NextResponse.json({ error: "수정할 답안의 ID가 누락되었습니다." }, { status: 400 });
    }

    const userId = parsePositiveInt(session.user.id);
    if (!userId) {
      return NextResponse.json({ error: "사용자 정보를 확인할 수 없습니다." }, { status: 401 });
    }

    const existingSubmission = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: { id: true, userId: true, examId: true, editCount: true },
    });

    if (!existingSubmission || existingSubmission.userId !== userId) {
      return NextResponse.json({ error: "수정 권한이 없거나 답안을 찾을 수 없습니다." }, { status: 403 });
    }

    const settings = await getSiteSettingsUncached();
    const maxEditLimit = (settings["site.submissionEditLimit"] as number) ?? 3;
    const careerExamEnabled = Boolean(settings["site.careerExamEnabled"] ?? true);
    if (maxEditLimit === 0 || existingSubmission.editCount >= maxEditLimit) {
      return NextResponse.json({ error: "답안 수정 제한 횟수를 초과했거나 수정이 불가능합니다." }, { status: 403 });
    }

    const examType = parseExamType(body.examType);
    if (!examType) {
      return NextResponse.json({ error: "채용유형은 PUBLIC 또는 CAREER만 가능합니다." }, { status: 400 });
    }

    if (examType === ExamType.CAREER && !careerExamEnabled) {
      return NextResponse.json(
        { error: "현재 경행경채 시험이 비활성화되어 수정할 수 없습니다." },
        { status: 400 }
      );
    }

    const gender = parseGender(body.gender);
    if (!gender) {
      return NextResponse.json({ error: "성별 정보가 올바르지 않습니다." }, { status: 400 });
    }

    const regionId = parsePositiveInt(body.regionId);
    if (!regionId) {
      return NextResponse.json({ error: "지역 정보가 올바르지 않습니다." }, { status: 400 });
    }

    const answers = parseAnswers(body.answers);
    if (answers.length === 0) {
      return NextResponse.json({ error: "최소 1개 이상의 답안을 입력해 주세요." }, { status: 400 });
    }

    const difficulty = parseDifficulty(body.difficulty);

    const requestedExamId = parsePositiveInt(body.examId);
    if (requestedExamId && requestedExamId !== existingSubmission.examId) {
      return NextResponse.json(
        { error: "기존 제출과 다른 시험으로는 수정할 수 없습니다." },
        { status: 400 }
      );
    }

    const exam = await prisma.exam.findUnique({
      where: { id: existingSubmission.examId },
      select: { id: true, name: true, isActive: true },
    });

    if (!exam) {
      return NextResponse.json({ error: "기존 제출의 시험 정보를 찾을 수 없습니다." }, { status: 404 });
    }
    if (!exam.isActive) {
      return NextResponse.json({ error: "현재 활성화된 시험에만 성적 수정이 가능합니다." }, { status: 400 });
    }

    const region = await prisma.region.findUnique({
      where: { id: regionId },
      select: {
        id: true,
        name: true,
        isActive: true,
        recruitCount: true,
        recruitCountCareer: true,
      },
    });

    if (!region) {
      return NextResponse.json({ error: "선택한 지역을 찾을 수 없습니다." }, { status: 404 });
    }
    if (!region.isActive) {
      return NextResponse.json(
        { error: "비활성화된 지역은 성적 입력이 불가능합니다. 관리자에게 문의해주세요." },
        { status: 400 }
      );
    }

    const examNumber = parseExamNumber(body.examNumber);
    if (!examNumber) {
      return NextResponse.json({ error: "응시번호는 필수 입력 항목입니다." }, { status: 400 });
    }

    const bonusType = resolveBonusType(body);
    const bonusRate = getBonusPercent(bonusType);
    const recruitCount = getRegionRecruitCount(region, examType);
    if (!Number.isInteger(recruitCount) || recruitCount < 1) {
      const message =
        examType === ExamType.CAREER
          ? "선택한 지역의 경행경채 모집인원이 설정되지 않았습니다. 관리자에게 문의해주세요."
          : "선택한 지역의 모집인원이 올바르지 않습니다.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if ((bonusType === BonusType.HERO_3 || bonusType === BonusType.HERO_5) && recruitCount < 10) {
      return NextResponse.json(
        { error: "의사상자 가산점은 모집인원 10명 이상 지역에서만 선택 가능합니다." },
        { status: 400 }
      );
    }

    const scoreResult = await calculateScore({
      examId: exam.id,
      examType,
      answers,
      bonusType,
      bonusRate,
    });

    if (isHeroBonusType(bonusType)) {
      await validateHeroBonusPassCap({
        examId: exam.id,
        regionId: region.id,
        examType,
        recruitCount,
        submissionId,
        bonusType,
        totalScore: scoreResult.totalScore,
        finalScore: scoreResult.finalScore,
        hasCutoff: scoreResult.hasCutoff,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.userAnswer.deleteMany({ where: { submissionId } });
      await tx.subjectScore.deleteMany({ where: { submissionId } });
      await tx.difficultyRating.deleteMany({ where: { submissionId } });

      const savedSubmission = await tx.submission.update({
        where: { id: submissionId },
        data: {
          examId: exam.id,
          regionId: region.id,
          examType,
          gender,
          examNumber,
          totalScore: scoreResult.totalScore,
          bonusType,
          bonusRate,
          finalScore: scoreResult.finalScore,
          editCount: { increment: 1 },
        },
      });

      if (scoreResult.userAnswers.length > 0) {
        await tx.userAnswer.createMany({
          data: scoreResult.userAnswers.map((answer) => ({
            submissionId,
            subjectId: answer.subjectId,
            questionNumber: answer.questionNo,
            selectedAnswer: answer.selectedAnswer,
            isCorrect: answer.isCorrect,
          })),
        });
      }

      await tx.subjectScore.createMany({
        data: scoreResult.scores.map((score) => ({
          submissionId,
          subjectId: score.subjectId,
          rawScore: score.rawScore,
          isFailed: score.isCutoff,
        })),
      });

      if (difficulty.length > 0) {
        const subjectIdByName = new Map(
          scoreResult.scores.map((score) => [normalizeSubjectName(score.subjectName), score.subjectId] as const)
        );

        const difficultyData = difficulty
          .map((item) => {
            const subjectId = subjectIdByName.get(normalizeSubjectName(item.subjectName));
            if (!subjectId) return null;

            return {
              submissionId,
              subjectId,
              rating: item.rating,
            };
          })
          .filter(
            (row): row is { submissionId: number; subjectId: number; rating: DifficultyRatingValue } => row !== null
          );

        if (difficultyData.length > 0) {
          await tx.difficultyRating.createMany({
            data: difficultyData,
          });
        }
      }

      return savedSubmission;
    });

    invalidateCorrectRateCache(exam.id, examType);

    return NextResponse.json({
      success: true,
      submissionId: updated.id,
      result: scoreResult,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const targetRaw = error.meta?.target;
      const target = Array.isArray(targetRaw)
        ? targetRaw.map((item) => String(item))
        : typeof targetRaw === "string"
          ? [targetRaw]
          : [];

      if (target.some((item) => item.includes("examNumber"))) {
        return NextResponse.json(
          { error: "해당 지역에 동일한 응시번호가 이미 존재합니다. 응시번호를 확인해 주세요." },
          { status: 409 }
        );
      }
    }
    const message = error instanceof Error ? error.message : "답안 수정 처리 중 오류가 발생했습니다.";
    const status = inferErrorStatus(message);

    if (status === 500) {
      console.error("답안 수정 처리 중 오류가 발생했습니다.", error);
    }

    return NextResponse.json({ error: message }, { status });
  }
}
