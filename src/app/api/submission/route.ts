import { BonusType, ExamType, Gender } from "@prisma/client";
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

interface SubmissionRequestBody {
  examId?: unknown;
  examType?: unknown;
  gender?: unknown;
  regionId?: unknown;
  examNumber?: unknown;
  bonusType?: unknown;
  veteranPercent?: unknown;
  heroPercent?: unknown;
  answers?: unknown;
}

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

    const duplicateKey = `${subjectName}:${questionNo}`;
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
    return region.recruitCountCareer > 0 ? region.recruitCountCareer : region.recruitCount;
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

    const bonusType = resolveBonusType(body);
    const bonusRate = getBonusPercent(bonusType);
    const recruitCount = getRegionRecruitCount(region, examType);

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
      const savedSubmission = await tx.submission.upsert({
        where: {
          userId_examId_examType: {
            userId,
            examId: exam.id,
            examType,
          },
        },
        update: {
          regionId: region.id,
          gender,
          totalScore: scoreResult.totalScore,
          bonusType,
          bonusRate,
          finalScore: scoreResult.finalScore,
        },
        create: {
          examId: exam.id,
          userId,
          regionId: region.id,
          examType,
          gender,
          totalScore: scoreResult.totalScore,
          bonusType,
          bonusRate,
          finalScore: scoreResult.finalScore,
        },
      });

      await tx.userAnswer.deleteMany({
        where: { submissionId: savedSubmission.id },
      });

      await tx.subjectScore.deleteMany({
        where: { submissionId: savedSubmission.id },
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

      return savedSubmission;
    });

    return NextResponse.json({
      success: true,
      submissionId: submission.id,
      result: scoreResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "답안 제출 처리 중 오류가 발생했습니다.";
    const status = message.includes("정답키") || message.includes("올바르지") ? 400 : 500;

    if (status === 500) {
      console.error("답안 제출 처리 중 오류가 발생했습니다.", error);
    }

    return NextResponse.json({ error: message }, { status });
  }
}
