"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const ADMIN_EXAM_API = "/exam/api/admin/exam";
const ADMIN_ANSWERS_API = "/exam/api/admin/answers";

interface ExamItem {
  id: number;
  name: string;
  year: number;
  round: number;
  isActive: boolean;
}

type RecruitExamType = "PUBLIC" | "CAREER";

const EXAM_TYPE_PUBLIC: RecruitExamType = "PUBLIC";
const EXAM_TYPE_CAREER: RecruitExamType = "CAREER";

interface SubjectItem {
  id: number;
  name: string;
  questionCount: number;
}

interface AnswerItem {
  subjectId: number;
  questionNumber: number;
  answer: number;
}

interface AnswersResponse {
  examId: number;
  examType: RecruitExamType;
  subjects: SubjectItem[];
  answers: AnswerItem[];
}

type NoticeState = {
  type: "success" | "error";
  message: string;
} | null;

function buildAnswerKey(subjectId: number, questionNumber: number) {
  return `${subjectId}:${questionNumber}`;
}

export default function AdminAnswersPage() {
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [examType, setExamType] = useState<RecruitExamType>(EXAM_TYPE_PUBLIC);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [answerMap, setAnswerMap] = useState<Record<string, number>>({});
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);

  const expectedAnswerCount = useMemo(
    () => subjects.reduce((sum, subject) => sum + subject.questionCount, 0),
    [subjects]
  );
  const currentAnswerCount = useMemo(() => Object.keys(answerMap).length, [answerMap]);

  async function loadExamOptions() {
    const response = await fetch(ADMIN_EXAM_API, { method: "GET", cache: "no-store" });
    const data = (await response.json()) as { exams?: ExamItem[]; error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? "시험 목록을 불러오지 못했습니다.");
    }

    const examList = data.exams ?? [];
    setExams(examList);
    if (!selectedExamId && examList.length > 0) {
      const activeExam = examList.find((exam) => exam.isActive) ?? examList[0];
      setSelectedExamId(activeExam.id);
    }
  }

  async function loadAnswers(
    examId: number,
    nextExamType: RecruitExamType,
    nextConfirmed: boolean
  ) {
    const query = new URLSearchParams({
      examId: String(examId),
      examType: nextExamType,
      confirmed: String(nextConfirmed),
    });

    const response = await fetch(`${ADMIN_ANSWERS_API}?${query.toString()}`, {
      method: "GET",
      cache: "no-store",
    });

    const data = (await response.json()) as AnswersResponse & { error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? "정답 데이터를 불러오지 못했습니다.");
    }

    const nextMap: Record<string, number> = {};
    for (const answer of data.answers ?? []) {
      nextMap[buildAnswerKey(answer.subjectId, answer.questionNumber)] = answer.answer;
    }

    setSubjects(data.subjects ?? []);
    setAnswerMap(nextMap);
  }

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setNotice(null);
      try {
        await loadExamOptions();
      } catch (error) {
        setNotice({
          type: "error",
          message: error instanceof Error ? error.message : "시험 목록 조회에 실패했습니다.",
        });
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedExamId) return;

    (async () => {
      setIsLoading(true);
      setNotice(null);
      try {
        await loadAnswers(selectedExamId, examType, isConfirmed);
      } catch (error) {
        setSubjects([]);
        setAnswerMap({});
        setNotice({
          type: "error",
          message: error instanceof Error ? error.message : "정답 조회에 실패했습니다.",
        });
      } finally {
        setIsLoading(false);
      }
    })();
  }, [selectedExamId, examType, isConfirmed]);

  function updateAnswer(subjectId: number, questionNumber: number, answer: number) {
    const key = buildAnswerKey(subjectId, questionNumber);
    setAnswerMap((current) => ({
      ...current,
      [key]: answer,
    }));
  }

  async function saveFromGrid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    if (!selectedExamId) {
      setNotice({ type: "error", message: "시험을 먼저 선택해 주세요." });
      return;
    }

    const rows: Array<{ subjectId: number; questionNumber: number; answer: number }> = [];

    for (const subject of subjects) {
      for (let questionNumber = 1; questionNumber <= subject.questionCount; questionNumber += 1) {
        const key = buildAnswerKey(subject.id, questionNumber);
        const answer = answerMap[key];
        if (!answer) {
          setNotice({
            type: "error",
            message: `${subject.name} ${questionNumber}번 문항 정답을 선택해 주세요.`,
          });
          return;
        }
        rows.push({
          subjectId: subject.id,
          questionNumber,
          answer,
        });
      }
    }

    setIsSaving(true);
    try {
      const response = await fetch(ADMIN_ANSWERS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId: selectedExamId,
          examType,
          isConfirmed,
          answers: rows,
        }),
      });

      const data = (await response.json()) as { error?: string; rescoredCount?: number };
      if (!response.ok) {
        throw new Error(data.error ?? "정답 저장에 실패했습니다.");
      }

      setNotice({
        type: "success",
        message: `정답이 저장되었습니다. 재채점 처리: ${data.rescoredCount ?? 0}건`,
      });
      await loadAnswers(selectedExamId, examType, isConfirmed);
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "정답 저장 중 오류가 발생했습니다.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function uploadCsv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    if (!selectedExamId) {
      setNotice({ type: "error", message: "시험을 먼저 선택해 주세요." });
      return;
    }

    if (!csvFile) {
      setNotice({ type: "error", message: "업로드할 CSV 파일을 선택해 주세요." });
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append("examId", String(selectedExamId));
      formData.append("examType", examType);
      formData.append("isConfirmed", String(isConfirmed));
      formData.append("file", csvFile);

      const response = await fetch(ADMIN_ANSWERS_API, {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as { error?: string; rescoredCount?: number };
      if (!response.ok) {
        throw new Error(data.error ?? "CSV 저장에 실패했습니다.");
      }

      setNotice({
        type: "success",
        message: `CSV 정답 업로드가 완료되었습니다. 재채점 처리: ${data.rescoredCount ?? 0}건`,
      });
      setCsvFile(null);
      await loadAnswers(selectedExamId, examType, isConfirmed);
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "CSV 업로드 중 오류가 발생했습니다.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setCsvFile(file);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">정답 관리</h1>
        <p className="mt-1 text-sm text-slate-600">
          시험 선택 후 공채/경행경채 정답을 직접 입력하거나 CSV로 업로드할 수 있습니다.
        </p>
      </header>

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="exam-select">시험 선택</Label>
          <select
            id="exam-select"
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={selectedExamId ?? ""}
            onChange={(event) => setSelectedExamId(Number(event.target.value))}
            disabled={isLoading || exams.length === 0}
          >
            {exams.length === 0 ? <option value="">시험 없음</option> : null}
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.year}년 {exam.round}차 - {exam.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="exam-type">채용 유형</Label>
          <select
            id="exam-type"
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={examType}
            onChange={(event) => setExamType(event.target.value as RecruitExamType)}
          >
            <option value={EXAM_TYPE_PUBLIC}>공채 (헌법/형사법/경찰학)</option>
            <option value={EXAM_TYPE_CAREER}>경행경채 (범죄학/형사법/경찰학)</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label>정답 상태</Label>
          <div className="flex h-9 items-center gap-4 rounded-md border border-slate-300 bg-white px-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="answer-state"
                checked={!isConfirmed}
                onChange={() => setIsConfirmed(false)}
              />
              가답안
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="answer-state"
                checked={isConfirmed}
                onChange={() => setIsConfirmed(true)}
              />
              확정답안
            </label>
          </div>
        </div>
      </section>

      <div className="rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700">
        입력 진행: <span className="font-semibold">{currentAnswerCount}</span> / {expectedAnswerCount}
      </div>

      {notice ? (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            notice.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {notice.message}
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-slate-600">정답 데이터를 불러오는 중입니다...</p>
      ) : subjects.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-600">
          과목 정보가 없습니다.
        </p>
      ) : (
        <form className="space-y-6" onSubmit={saveFromGrid}>
          {subjects.map((subject) => (
            <section key={subject.id} className="space-y-3 rounded-lg border border-slate-200 p-4">
              <h2 className="text-base font-semibold text-slate-900">
                {subject.name} ({subject.questionCount}문항)
              </h2>

              <div className="space-y-3">
                {Array.from({ length: subject.questionCount }, (_, index) => index + 1).map(
                  (questionNumber) => {
                    const key = buildAnswerKey(subject.id, questionNumber);
                    const current = answerMap[key];

                    return (
                      <div
                        key={questionNumber}
                        className="flex flex-col gap-2 rounded-md border border-slate-100 bg-slate-50 p-3 md:flex-row md:items-center"
                      >
                        <p className="w-20 text-sm font-medium text-slate-800">{questionNumber}번</p>
                        <div className="flex flex-wrap items-center gap-4">
                          {[1, 2, 3, 4].map((choice) => (
                            <label key={choice} className="flex items-center gap-1 text-sm text-slate-700">
                              <input
                                type="radio"
                                name={`subject-${subject.id}-question-${questionNumber}`}
                                checked={current === choice}
                                onChange={() => updateAnswer(subject.id, questionNumber, choice)}
                              />
                              {choice}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </section>
          ))}

          <Button type="submit" disabled={isSaving}>
            {isSaving ? "저장 중..." : "정답 저장 + 재채점"}
          </Button>
        </form>
      )}

      <section className="space-y-3 rounded-lg border border-slate-200 p-4">
        <h2 className="text-base font-semibold text-slate-900">CSV 업로드</h2>
        <p className="text-sm text-slate-600">
          CSV는 `과목, 문항번호, 정답` 3개 컬럼 형식으로 업로드하세요. (예: 헌법,1,3)
        </p>

        <form className="flex flex-col gap-3 md:flex-row md:items-center" onSubmit={uploadCsv}>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-700 md:max-w-sm"
          />
          <Button type="submit" variant="outline" disabled={isSaving}>
            CSV 저장 + 재채점
          </Button>
        </form>
      </section>
    </div>
  );
}
