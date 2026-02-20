"use client";

import { ExamType, Gender } from "@prisma/client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import DifficultySelector, { type DifficultyRating } from "@/components/exam/DifficultySelector";
import OmrInputModeToggle, { type OmrInputMode } from "@/components/exam/OmrInputModeToggle";
import QuickOmrInput from "@/components/exam/QuickOmrInput";
import RadioOmrInput from "@/components/exam/RadioOmrInput";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type BonusVeteran = 0 | 5 | 10;
type BonusHero = 0 | 3 | 5;
type AnswersBySubject = Record<string, Record<number, number | null>>;
type DifficultyBySubject = Record<string, DifficultyRating>;

const OMR_INPUT_MODE_STORAGE_KEY = "exam.omr.input-mode";

interface ExamSummary {
  id: number;
  name: string;
  year: number;
  round: number;
  examDate: string;
  isActive: boolean;
}

interface RegionInfo {
  id: number;
  name: string;
  recruitCount: number;
  recruitCountCareer: number;
}

interface SubjectInfo {
  id: number;
  name: string;
  questionCount: number;
  pointPerQuestion: number;
  maxScore: number;
}

interface ExamsResponse {
  activeExam: ExamSummary | null;
  regions: RegionInfo[];
  subjectGroups: {
    PUBLIC: SubjectInfo[];
    CAREER: SubjectInfo[];
  };
}

interface SubmissionResponse {
  success: boolean;
  submissionId: number;
}

interface ExamInputPageProps {
  embedded?: boolean;
  onSubmitted?: (submissionId: number) => void;
}

function createEmptyAnswers(subjects: SubjectInfo[]): AnswersBySubject {
  const next: AnswersBySubject = {};
  for (const subject of subjects) {
    const byQuestion: Record<number, number | null> = {};
    for (let questionNo = 1; questionNo <= subject.questionCount; questionNo += 1) {
      byQuestion[questionNo] = null;
    }
    next[subject.name] = byQuestion;
  }
  return next;
}

function createEmptyDifficulty(subjects: SubjectInfo[]): DifficultyBySubject {
  const next: DifficultyBySubject = {};
  for (const subject of subjects) {
    next[subject.name] = "NORMAL";
  }
  return next;
}

function progressColor(percentage: number): string {
  if (percentage >= 100) return "bg-emerald-500";
  if (percentage >= 50) return "bg-amber-500";
  return "bg-rose-500";
}

function getRecruitCount(region: RegionInfo, examType: ExamType): number {
  if (examType === ExamType.CAREER) {
    return region.recruitCountCareer;
  }
  return region.recruitCount;
}

function getDefaultInputMode(): OmrInputMode {
  if (typeof window === "undefined") return "radio";

  const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isNarrowScreen = window.innerWidth < 768;
  return isTouchDevice || isNarrowScreen ? "radio" : "quick";
}

export default function ExamInputPage({
  embedded = false,
  onSubmitted,
}: ExamInputPageProps = {}) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { showErrorToast } = useToast();

  const [meta, setMeta] = useState<ExamsResponse | null>(null);
  const [isMetaLoading, setIsMetaLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [gender, setGender] = useState<Gender | "">("");
  const [examType, setExamType] = useState<ExamType>(ExamType.PUBLIC);
  const [regionId, setRegionId] = useState<number | "">("");
  const [examNumber, setExamNumber] = useState("");
  const [veteranPercent, setVeteranPercent] = useState<BonusVeteran>(0);
  const [heroPercent, setHeroPercent] = useState<BonusHero>(0);
  const [activeSubjectIndex, setActiveSubjectIndex] = useState(0);
  const [inputMode, setInputMode] = useState<OmrInputMode>("radio");
  const [quickFocusToken, setQuickFocusToken] = useState(0);

  const [answerStore, setAnswerStore] = useState<Record<ExamType, AnswersBySubject>>({
    [ExamType.PUBLIC]: {},
    [ExamType.CAREER]: {},
  });
  const [difficultyStore, setDifficultyStore] = useState<Record<ExamType, DifficultyBySubject>>({
    [ExamType.PUBLIC]: {},
    [ExamType.CAREER]: {},
  });

  useEffect(() => {
    let isMounted = true;

    async function loadMeta() {
      setIsMetaLoading(true);
      setErrorMessage("");
      try {
        const response = await fetch("/api/exams?active=true", {
          method: "GET",
          cache: "no-store",
        });
        const data = (await response.json()) as ExamsResponse & { error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "시험 정보를 불러오지 못했습니다.");
        }

        if (!isMounted) return;

        setMeta(data);
        setAnswerStore({
          [ExamType.PUBLIC]: createEmptyAnswers(data.subjectGroups.PUBLIC),
          [ExamType.CAREER]: createEmptyAnswers(data.subjectGroups.CAREER),
        });
        setDifficultyStore({
          [ExamType.PUBLIC]: createEmptyDifficulty(data.subjectGroups.PUBLIC),
          [ExamType.CAREER]: createEmptyDifficulty(data.subjectGroups.CAREER),
        });
      } catch (error) {
        if (!isMounted) return;
        const message = error instanceof Error ? error.message : "시험 정보를 불러오지 못했습니다.";
        setErrorMessage(message);
        showErrorToast(message);
      } finally {
        if (isMounted) {
          setIsMetaLoading(false);
        }
      }
    }

    void loadMeta();
    return () => {
      isMounted = false;
    };
  }, [showErrorToast]);

  const subjects = useMemo(() => {
    if (!meta) return [];
    return examType === ExamType.PUBLIC ? meta.subjectGroups.PUBLIC : meta.subjectGroups.CAREER;
  }, [meta, examType]);

  useEffect(() => {
    setActiveSubjectIndex(0);
  }, [examType]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(OMR_INPUT_MODE_STORAGE_KEY);
      if (saved === "quick" || saved === "radio") {
        setInputMode(saved);
      } else {
        setInputMode(getDefaultInputMode());
      }
    } catch {
      setInputMode(getDefaultInputMode());
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(OMR_INPUT_MODE_STORAGE_KEY, inputMode);
    } catch {
      // ignore localStorage errors
    }
  }, [inputMode]);

  const currentSubject = subjects[activeSubjectIndex] ?? null;
  const currentAnswers = useMemo(() => answerStore[examType] ?? {}, [answerStore, examType]);
  const currentDifficulty = useMemo(
    () => difficultyStore[examType] ?? {},
    [difficultyStore, examType]
  );

  const progressBySubject = useMemo(() => {
    return subjects.map((subject) => {
      const subjectAnswers = currentAnswers[subject.name] ?? {};
      const filledCount = Object.values(subjectAnswers).filter(
        (answer): answer is number => typeof answer === "number"
      ).length;

      return {
        subjectName: subject.name,
        filled: filledCount,
        total: subject.questionCount,
      };
    });
  }, [subjects, currentAnswers]);

  const totalProgress = useMemo(() => {
    const total = progressBySubject.reduce((sum, item) => sum + item.total, 0);
    const filled = progressBySubject.reduce((sum, item) => sum + item.filled, 0);
    return { total, filled };
  }, [progressBySubject]);

  const selectedRegion = useMemo(() => {
    if (!meta || !regionId) return null;
    return meta.regions.find((region) => region.id === regionId) ?? null;
  }, [meta, regionId]);

  const recruitCount = selectedRegion ? getRecruitCount(selectedRegion, examType) : null;
  const isCareerRecruitCountMissing =
    examType === ExamType.CAREER && selectedRegion !== null && recruitCount !== null && recruitCount < 1;

  function setAnswer(subjectName: string, questionNo: number, answer: number | null) {
    setAnswerStore((previous) => {
      const typeAnswers = previous[examType] ?? {};
      const subjectAnswers = { ...(typeAnswers[subjectName] ?? {}) };
      subjectAnswers[questionNo] = answer;
      return {
        ...previous,
        [examType]: {
          ...typeAnswers,
          [subjectName]: subjectAnswers,
        },
      };
    });
  }

  function setDifficulty(subjectName: string, rating: DifficultyRating) {
    setDifficultyStore((previous) => {
      const typeDifficulty = previous[examType] ?? {};
      return {
        ...previous,
        [examType]: {
          ...typeDifficulty,
          [subjectName]: rating,
        },
      };
    });
  }

  function handleVeteranChange(next: BonusVeteran) {
    setVeteranPercent(next);
    if (next > 0) {
      setHeroPercent(0);
    }
  }

  function handleHeroChange(next: BonusHero) {
    setHeroPercent(next);
    if (next > 0) {
      setVeteranPercent(0);
    }
  }

  function handleRequestNextSubjectInQuickMode() {
    setActiveSubjectIndex((previousIndex) => {
      const nextIndex = Math.min(previousIndex + 1, subjects.length - 1);
      if (nextIndex !== previousIndex) {
        setQuickFocusToken((token) => token + 1);
      }
      return nextIndex;
    });
  }

  async function handleSubmit() {
    if (!meta?.activeExam) {
      setErrorMessage("활성 시험이 없습니다.");
      return;
    }

    if (!gender || !regionId) {
      setErrorMessage("성별과 지역을 모두 선택해 주세요.");
      return;
    }

    const normalizedExamNumber = examNumber.trim();
    if (!normalizedExamNumber) {
      setErrorMessage("응시번호는 필수 입력 항목입니다.");
      return;
    }

    if (isCareerRecruitCountMissing) {
      setErrorMessage("선택한 지역의 경행경채 모집인원이 설정되지 않았습니다. 관리자에게 문의해 주세요.");
      return;
    }

    const unansweredCount = totalProgress.total - totalProgress.filled;
    if (unansweredCount > 0) {
      const confirmed = window.confirm(
        `미입력 문항이 ${unansweredCount}개 있습니다.\n미입력 문항은 오답 처리됩니다.\n그래도 제출하시겠습니까?`
      );
      if (!confirmed) {
        return;
      }
    }

    const answers: Array<{ subjectName: string; questionNo: number; answer: number }> = [];
    for (const subject of subjects) {
      const subjectAnswers = currentAnswers[subject.name] ?? {};
      for (let questionNo = 1; questionNo <= subject.questionCount; questionNo += 1) {
        const selected = subjectAnswers[questionNo];
        if (typeof selected === "number") {
          answers.push({
            subjectName: subject.name,
            questionNo,
            answer: selected,
          });
        }
      }
    }

    const difficulty = subjects.map((subject) => ({
      subjectName: subject.name,
      rating: currentDifficulty[subject.name] ?? "NORMAL",
    }));

    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId: meta.activeExam.id,
          examType,
          gender,
          regionId,
          examNumber: normalizedExamNumber,
          veteranPercent,
          heroPercent,
          answers,
          difficulty,
        }),
      });

      const data = (await response.json()) as SubmissionResponse & { error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "답안 제출 중 오류가 발생했습니다.");
      }

      sessionStorage.setItem("latestSubmissionId", String(data.submissionId));

      if (embedded && onSubmitted) {
        onSubmitted(data.submissionId);
      } else {
        router.push(`/exam/result?submissionId=${data.submissionId}`);
        router.refresh();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "답안 제출 중 오류가 발생했습니다.";
      setErrorMessage(message);
      showErrorToast(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status === "loading" || isMetaLoading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
        응시정보 화면을 불러오는 중입니다...
      </section>
    );
  }

  if (!session?.user) {
    return (
      <section className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700">
        로그인이 필요합니다.
      </section>
    );
  }

  if (!meta?.activeExam) {
    return (
      <section className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700">
        현재 활성 시험이 없습니다.
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-slate-900">응시정보 입력</h1>
        <p className="mt-1 text-sm text-slate-600">
          {meta.activeExam.year}년 {meta.activeExam.round}차 · {meta.activeExam.name}
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">성명</Label>
            <Input id="name" value={session.user.name ?? ""} readOnly />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gender">성별</Label>
            <select
              id="gender"
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={gender}
              onChange={(event) => setGender(event.target.value as Gender | "")}
            >
              <option value="">선택하세요</option>
              <option value={Gender.MALE}>남성</option>
              <option value={Gender.FEMALE}>여성</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="examType">채용유형</Label>
            <select
              id="examType"
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={examType}
              onChange={(event) => setExamType(event.target.value as ExamType)}
            >
              <option value={ExamType.PUBLIC}>공채</option>
              <option value={ExamType.CAREER}>경행경채</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="region">지역</Label>
            <select
              id="region"
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={regionId}
              onChange={(event) => setRegionId(Number(event.target.value) || "")}
            >
              <option value="">지역을 선택하세요</option>
              {meta.regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
            {selectedRegion ? (
              <p className="text-xs text-slate-500">
                {isCareerRecruitCountMissing
                  ? `${selectedRegion.name}: 경행경채 모집인원 미설정`
                  : `${selectedRegion.name}: ${recruitCount?.toLocaleString("ko-KR")}명`}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="examCategory">시험구분</Label>
            <Input id="examCategory" value="경찰 1차" readOnly />
          </div>

          <div className="space-y-2">
            <Label htmlFor="examNumber">응시번호 (필수)</Label>
            <Input
              id="examNumber"
              value={examNumber}
              onChange={(event) => setExamNumber(event.target.value)}
              placeholder="응시번호 입력"
              required
            />
            <p className="text-xs text-slate-500">수험표에 기재된 응시번호를 정확히 입력해 주세요.</p>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-900">가산점</h2>
          <p className="mt-1 text-xs text-slate-500">취업지원과 의사상자 가산점은 동시에 적용할 수 없습니다.</p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-700">취업지원대상자</legend>
              <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                {[0, 5, 10].map((value) => (
                  <label key={value} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="bonus-veteran"
                      checked={veteranPercent === value}
                      onChange={() => handleVeteranChange(value as BonusVeteran)}
                    />
                    {value}%
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-700">의사상자</legend>
              <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                {[0, 3, 5].map((value) => (
                  <label key={value} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="bonus-hero"
                      checked={heroPercent === value}
                      onChange={() => handleHeroChange(value as BonusHero)}
                    />
                    {value}%
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">OMR 답안 입력</h2>
        <p className="mt-1 text-sm text-slate-600">
          {examType === ExamType.PUBLIC ? "공채" : "경행경채"} ·
          {inputMode === "quick"
            ? " 키보드 숫자 입력(1~4)으로 빠르게 답안을 입력하세요."
            : " 문항별 ①②③④ 버튼을 눌러 답안을 입력하세요."}
        </p>
        <div className="mt-4">
          <OmrInputModeToggle
            value={inputMode}
            onChange={(nextMode) => {
              setInputMode(nextMode);
              if (nextMode === "quick") {
                setQuickFocusToken((token) => token + 1);
              }
            }}
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {subjects.map((subject, index) => {
            const progress = progressBySubject.find((item) => item.subjectName === subject.name);
            const filled = progress?.filled ?? 0;
            const completed = filled === subject.questionCount;
                const rating = currentDifficulty[subject.name] ?? "NORMAL";

            return (
              <button
                key={subject.name}
                type="button"
                className={`rounded-md border px-3 py-2 text-sm ${
                  index === activeSubjectIndex
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                onClick={() => setActiveSubjectIndex(index)}
              >
                <span>{subject.name}</span>
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                    completed ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {filled}/{subject.questionCount}
                </span>
                {rating ? (
                  <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                    {rating === "EASY" ? "쉬움" : rating === "NORMAL" ? "보통" : "어려움"}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {currentSubject ? (
          <div className="mt-4 rounded-lg border border-slate-200 p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-semibold text-slate-900">
                {currentSubject.name} ({currentSubject.questionCount}문항)
              </h3>
              <DifficultySelector
                subjectName={currentSubject.name}
                value={currentDifficulty[currentSubject.name] ?? "NORMAL"}
                onChange={(next) => setDifficulty(currentSubject.name, next)}
              />
            </div>

            {inputMode === "radio" ? (
              <RadioOmrInput
                subjectName={currentSubject.name}
                questionCount={currentSubject.questionCount}
                answers={currentAnswers[currentSubject.name] ?? {}}
                onAnswerChange={(questionNo, answer) => setAnswer(currentSubject.name, questionNo, answer)}
              />
            ) : (
              <QuickOmrInput
                subjectName={currentSubject.name}
                questionCount={currentSubject.questionCount}
                answers={currentAnswers[currentSubject.name] ?? {}}
                onAnswerChange={(questionNo, answer) => setAnswer(currentSubject.name, questionNo, answer)}
                focusToken={quickFocusToken}
                onRequestNextSubject={handleRequestNextSubjectInQuickMode}
              />
            )}
          </div>
        ) : null}

        <div className="mt-5 space-y-3 rounded-lg border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900">입력 현황</h3>
          {progressBySubject.map((item) => {
            const percentage = item.total > 0 ? (item.filled / item.total) * 100 : 0;
            return (
              <div key={item.subjectName}>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                  <span>{item.subjectName}</span>
                  <span>
                    {item.filled}/{item.total}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full ${progressColor(percentage)}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}

          <div className="mt-1 border-t border-slate-200 pt-3 text-sm font-medium text-slate-700">
            총 입력: {totalProgress.filled}/{totalProgress.total}문항
          </div>
        </div>

        {errorMessage ? (
          <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end">
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting || isMetaLoading}>
            {isSubmitting ? "제출 중..." : "채점하기"}
          </Button>
        </div>
      </section>
    </div>
  );
}
