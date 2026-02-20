import { BonusType, ExamType, Gender, Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

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

function normalizeSubjectName(name: string): string {
  return name.replace(/\s+/g, "").trim();
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

function getRegionRecruitCount(
  region: { recruitCount: number; recruitCountCareer: number },
  examType: ExamType
): number {
  if (examType === ExamType.CAREER) {
    return region.recruitCountCareer;
  }
  return region.recruitCount;
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
  return BAD_REQUEST_ERROR_PATTERNS.some((pattern) => message.includes(pattern)) ? 400 : 500;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as SubmissionRequestBody;

    const userId = parsePositiveInt(session.user.id);
    if (!userId) {
      return NextResponse.json({ error: "사용자 정보를 확인할 수 없습니다." }, { status: 401 });
    }

    const examType = parseExamType(body.examType);
    if (!examType) {
      return NextResponse.json({ error: "채용유형은 PUBLIC 또는 CAREER만 가능합니다." }, { status: 400 });
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
        recruitCount: true,
        recruitCountCareer: true,
      },
    });

    if (!region) {
      return NextResponse.json({ error: "선택한 지역을 찾을 수 없습니다." }, { status: 404 });
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
