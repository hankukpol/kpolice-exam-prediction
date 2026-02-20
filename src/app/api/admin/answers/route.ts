import { ExamType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { rescoreExam } from "@/lib/scoring";

export const runtime = "nodejs";

type RawAnswerRow = {
  subjectId?: number;
  subjectName?: string;
  questionNumber?: number;
  questionNo?: number;
  answer?: number;
  correctAnswer?: number;
};

type NormalizedAnswerRow = {
  subjectId: number;
  questionNumber: number;
  answer: number;
};

interface SubjectMeta {
  id: number;
  name: string;
  questionCount: number;
}

function parseExamType(value: string | null): ExamType | null {
  if (value === ExamType.PUBLIC) return ExamType.PUBLIC;
  if (value === ExamType.CAREER) return ExamType.CAREER;
  return null;
}

function parseBoolean(value: string | null, fallback = false): boolean {
  if (value === null) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function parsePositiveInt(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function parseAnswerNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isInteger(parsed) ? parsed : null;
  }

  return null;
}

function normalizeSubjectName(name: string): string {
  return name.replace(/\s+/g, "").trim().toLowerCase();
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      const nextChar = line[index + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsvRows(csvText: string): RawAnswerRow[] {
  const rawLines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (rawLines.length === 0) return [];

  const firstLineColumns = parseCsvLine(rawLines[0]).map((column) =>
    column.toLowerCase().replace(/\s+/g, "")
  );
  const looksLikeHeader = firstLineColumns.some((column) =>
    ["subject", "subjectname", "과목", "문항", "question", "answer", "정답"].includes(column)
  );

  const dataLines = looksLikeHeader ? rawLines.slice(1) : rawLines;

  return dataLines.map((line) => {
    const [subjectName, questionNumber, answer] = parseCsvLine(line);
    return {
      subjectName,
      questionNumber: Number(questionNumber),
      answer: Number(answer),
    };
  });
}

function normalizeAnswerRows(
  rows: RawAnswerRow[],
  subjects: SubjectMeta[]
): { data?: NormalizedAnswerRow[]; error?: string } {
  if (rows.length === 0) {
    return { error: "정답 데이터가 비어 있습니다." };
  }

  const subjectById = new Map<number, SubjectMeta>();
  const subjectByName = new Map<string, SubjectMeta>();

  for (const subject of subjects) {
    subjectById.set(subject.id, subject);
    subjectByName.set(normalizeSubjectName(subject.name), subject);
  }

  const normalizedRows: NormalizedAnswerRow[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const parsedSubjectId = parsePositiveInt(row.subjectId);
    const parsedQuestionNumber = parsePositiveInt(row.questionNumber ?? row.questionNo);
    const parsedAnswer = parseAnswerNumber(row.answer ?? row.correctAnswer);

    let subject: SubjectMeta | undefined;

    if (parsedSubjectId) {
      subject = subjectById.get(parsedSubjectId);
    } else if (typeof row.subjectName === "string" && row.subjectName.trim()) {
      subject = subjectByName.get(normalizeSubjectName(row.subjectName));
    }

    if (!subject) {
      return { error: "정답 데이터에 유효하지 않은 과목이 포함되어 있습니다." };
    }

    if (!parsedQuestionNumber || parsedQuestionNumber > subject.questionCount) {
      return {
        error: `${subject.name} 과목 문항 번호가 올바르지 않습니다. (입력값: ${row.questionNumber ?? row.questionNo})`,
      };
    }

    if (!parsedAnswer || parsedAnswer < 1 || parsedAnswer > 4) {
      return {
        error: `${subject.name} ${parsedQuestionNumber}번 문항 정답은 1~4 사이 값이어야 합니다.`,
      };
    }

    const key = `${subject.id}:${parsedQuestionNumber}`;
    if (seen.has(key)) {
      return {
        error: `${subject.name} ${parsedQuestionNumber}번 문항이 중복 입력되었습니다.`,
      };
    }

    seen.add(key);
    normalizedRows.push({
      subjectId: subject.id,
      questionNumber: parsedQuestionNumber,
      answer: parsedAnswer,
    });
  }

  const expectedCount = subjects.reduce((sum, subject) => sum + subject.questionCount, 0);
  if (normalizedRows.length !== expectedCount) {
    return {
      error: `정답 문항 수가 올바르지 않습니다. (${normalizedRows.length}/${expectedCount})`,
    };
  }

  return { data: normalizedRows };
}

async function getSubjectsByExamType(examType: ExamType) {
  return prisma.subject.findMany({
    where: { examType },
    select: {
      id: true,
      name: true,
      questionCount: true,
    },
    orderBy: { id: "asc" },
  });
}

export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if ("error" in guard) return guard.error;

  const { searchParams } = new URL(request.url);
  const examId = parsePositiveInt(searchParams.get("examId"));
  const examType = parseExamType(searchParams.get("examType"));

  if (!examId) {
    return NextResponse.json({ error: "examId는 필수입니다." }, { status: 400 });
  }

  if (!examType) {
    return NextResponse.json({ error: "examType은 PUBLIC 또는 CAREER여야 합니다." }, { status: 400 });
  }

  const confirmedParam = searchParams.get("confirmed");
  const confirmedFilter =
    confirmedParam === null ? undefined : parseBoolean(confirmedParam, false);

  const subjects = await getSubjectsByExamType(examType);

  const answerKeys = await prisma.answerKey.findMany({
    where: {
      examId,
      subjectId: { in: subjects.map((subject) => subject.id) },
      ...(confirmedFilter === undefined ? {} : { isConfirmed: confirmedFilter }),
    },
    orderBy: [{ subjectId: "asc" }, { questionNumber: "asc" }],
    include: {
      subject: {
        select: {
          name: true,
        },
      },
    },
  });

  return NextResponse.json({
    examId,
    examType,
    confirmed: confirmedFilter ?? null,
    subjects,
    answers: answerKeys.map((answerKey) => ({
      subjectId: answerKey.subjectId,
      subjectName: answerKey.subject.name,
      questionNumber: answerKey.questionNumber,
      answer: answerKey.correctAnswer,
      isConfirmed: answerKey.isConfirmed,
    })),
  });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if ("error" in guard) return guard.error;

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let examId: number | null = null;
    let examType: ExamType | null = null;
    let isConfirmed = false;
    let rawRows: RawAnswerRow[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      examId = parsePositiveInt(formData.get("examId")?.toString());
      examType = parseExamType(formData.get("examType")?.toString() ?? null);
      isConfirmed = parseBoolean(formData.get("isConfirmed")?.toString() ?? null, false);

      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "CSV 파일을 첨부해 주세요." }, { status: 400 });
      }

      const csvText = await file.text();
      rawRows = parseCsvRows(csvText);
    } else {
      const body = (await request.json()) as {
        examId?: number;
        examType?: string;
        isConfirmed?: boolean;
        answers?: RawAnswerRow[];
      };

      examId = parsePositiveInt(body.examId);
      examType = parseExamType(body.examType ?? null);
      isConfirmed = body.isConfirmed ?? false;
      rawRows = Array.isArray(body.answers) ? body.answers : [];
    }

    if (!examId) {
      return NextResponse.json({ error: "examId는 필수입니다." }, { status: 400 });
    }

    if (!examType) {
      return NextResponse.json({ error: "examType은 PUBLIC 또는 CAREER여야 합니다." }, { status: 400 });
    }

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true },
    });

    if (!exam) {
      return NextResponse.json({ error: "해당 시험을 찾을 수 없습니다." }, { status: 404 });
    }

    const subjects = await getSubjectsByExamType(examType);
    if (subjects.length === 0) {
      return NextResponse.json({ error: "시험 과목 정보를 찾을 수 없습니다." }, { status: 400 });
    }

    const normalized = normalizeAnswerRows(rawRows, subjects);
    if (!normalized.data) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }
    const normalizedRows = normalized.data;

    await prisma.$transaction(async (tx) => {
      await tx.answerKey.deleteMany({
        where: {
          examId,
          subjectId: { in: subjects.map((subject) => subject.id) },
        },
      });

      await tx.answerKey.createMany({
        data: normalizedRows.map((row) => ({
          examId,
          subjectId: row.subjectId,
          questionNumber: row.questionNumber,
          correctAnswer: row.answer,
          isConfirmed,
        })),
      });
    });

    const rescoredCount = await rescoreExam(examId);

    return NextResponse.json(
      {
        success: true,
        savedCount: normalizedRows.length,
        isConfirmed,
        rescoredCount,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("정답 저장 중 오류가 발생했습니다.", error);
    return NextResponse.json({ error: "정답 저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}
