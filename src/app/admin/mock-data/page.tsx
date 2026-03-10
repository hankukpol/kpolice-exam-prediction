"use client";

import { useEffect, useMemo, useState } from "react";
import ConfirmModal from "@/components/admin/ConfirmModal";
import useConfirmModal from "@/hooks/useConfirmModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ADMIN_EXAM_API = "/api/admin/exam";
const MOCK_DATA_API = "/api/admin/mock-data";
const OPEN_RESET_API = "/api/admin/open-reset";
const OPEN_RESET_CONFIRM_TEXT = "OPEN RESET";

interface ExamItem {
  id: number;
  name: string;
  year: number;
  round: number;
  isActive: boolean;
}

type NoticeState = {
  type: "success" | "error";
  message: string;
} | null;

async function readResponseJson<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

interface MockActionSummary {
  examId: number | null;
  runKey?: string;
  deleted?: {
    submissions: number;
    users: number;
  };
  deletedBeforeGenerate?: {
    submissions: number;
    users: number;
  };
  created?: {
    users: number;
    submissions: number;
    subjectScores: number;
    difficultyRatings: number;
    finalPredictions: number;
  };
}

interface OpenResetSummary {
  deleted: {
    preRegistrations: number;
    submissions: number;
    users: number;
    comments: number;
    answerKeys: number;
    answerKeyLogs: number;
    rescoreEvents: number;
    passCutReleases: number;
    visitorLogs: number;
  };
  preserved: {
    adminUsers: number;
  };
}

export default function AdminMockDataPage() {
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [careerExamEnabled, setCareerExamEnabled] = useState(true);

  const [publicPerRegion, setPublicPerRegion] = useState("40");
  const [careerPerRegion, setCareerPerRegion] = useState("20");
  const [resetBeforeGenerate, setResetBeforeGenerate] = useState(true);
  const [includeFinalPredictionMock, setIncludeFinalPredictionMock] = useState(true);

  const [isLoading, setIsLoading] = useState(true);
  const { confirm, modalProps } = useConfirmModal();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isResettingExam, setIsResettingExam] = useState(false);
  const [isResettingAll, setIsResettingAll] = useState(false);
  const [isOpenResetting, setIsOpenResetting] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [latestSummary, setLatestSummary] = useState<MockActionSummary | null>(null);
  const [openResetSummary, setOpenResetSummary] = useState<OpenResetSummary | null>(null);
  const [openResetConfirmInput, setOpenResetConfirmInput] = useState("");

  const selectedExamLabel = useMemo(() => {
    if (!selectedExamId) return "활성 시험 없음";
    const exam = exams.find((item) => item.id === selectedExamId);
    if (!exam) return `시험 ID ${selectedExamId}`;
    return `${exam.year}년 ${exam.round}차 - ${exam.name}`;
  }, [exams, selectedExamId]);

  async function loadExams() {
    const response = await fetch(ADMIN_EXAM_API, { method: "GET", cache: "no-store" });
    const data = await readResponseJson<{
      exams?: ExamItem[];
      careerExamEnabled?: boolean;
      error?: string;
    }>(response);
    if (!response.ok) {
      throw new Error(data?.error ?? `시험 목록을 불러오지 못했습니다. (${response.status})`);
    }

    const examItems = data?.exams ?? [];
    setCareerExamEnabled(data?.careerExamEnabled ?? true);
    setExams(examItems);
    setSelectedExamId((current) => {
      if (current && examItems.some((exam) => exam.id === current)) {
        return current;
      }
      const active = examItems.find((exam) => exam.isActive) ?? examItems[0];
      return active?.id ?? null;
    });
  }

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setNotice(null);
      try {
        await loadExams();
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

  async function handleGenerateMockData() {
    if (!selectedExamId) {
      setNotice({ type: "error", message: "목업 생성 대상 시험이 없습니다." });
      return;
    }

    const ok = await confirm({
      title: "목업 데이터 생성",
      description: `선택 시험에 목업 데이터를 생성하시겠습니까?\n\n대상: ${selectedExamLabel}\n공채/지역: ${publicPerRegion}명${
        careerExamEnabled ? `, 경행경채/지역: ${careerPerRegion}명` : ""
      }`,
    });
    if (!ok) return;

    setIsGenerating(true);
    setNotice(null);
    try {
      const response = await fetch(MOCK_DATA_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId: selectedExamId,
          publicPerRegion: Number(publicPerRegion),
          ...(careerExamEnabled ? { careerPerRegion: Number(careerPerRegion) } : {}),
          resetBeforeGenerate,
          includeFinalPredictionMock,
        }),
      });
      const data = await readResponseJson<{
        success?: boolean;
        error?: string;
        result?: MockActionSummary;
      }>(response);
      if (!response.ok || !data?.success || !data.result) {
        throw new Error(data?.error ?? `목업 데이터 생성에 실패했습니다. (${response.status})`);
      }

      setLatestSummary(data.result);
      setNotice({
        type: "success",
        message: "목업 데이터 생성이 완료되었습니다.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "목업 데이터 생성에 실패했습니다.",
      });
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleResetExamMockData() {
    if (!selectedExamId) {
      setNotice({ type: "error", message: "초기화 대상 시험이 없습니다." });
      return;
    }

    const ok = await confirm({
      title: "선택 시험 목업 초기화",
      description: `선택 시험의 목업 데이터를 완전 삭제하시겠습니까?\n\n대상: ${selectedExamLabel}\n삭제 범위: MOCK 제출 + 고아 MOCK 사용자`,
      variant: "danger",
    });
    if (!ok) return;

    setIsResettingExam(true);
    setNotice(null);
    try {
      const response = await fetch(`${MOCK_DATA_API}?examId=${selectedExamId}`, {
        method: "DELETE",
      });
      const data = await readResponseJson<{
        success?: boolean;
        error?: string;
        result?: MockActionSummary;
      }>(response);
      if (!response.ok || !data?.success || !data.result) {
        throw new Error(data?.error ?? `선택 시험 목업 초기화에 실패했습니다. (${response.status})`);
      }

      setLatestSummary(data.result);
      setNotice({
        type: "success",
        message: "선택 시험 목업 데이터 초기화가 완료되었습니다.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "선택 시험 목업 초기화에 실패했습니다.",
      });
    } finally {
      setIsResettingExam(false);
    }
  }

  async function handleResetAllMockData() {
    const ok = await confirm({
      title: "전체 MOCK 완전 삭제",
      description: "전체 MOCK 데이터(모든 시험)를 완전 삭제하시겠습니까?\n\n삭제 범위: MOCK 제출 전체 + 고아 MOCK 사용자 전체",
      variant: "danger",
    });
    if (!ok) return;

    setIsResettingAll(true);
    setNotice(null);
    try {
      const response = await fetch(`${MOCK_DATA_API}?scope=all`, {
        method: "DELETE",
      });
      const data = await readResponseJson<{
        success?: boolean;
        error?: string;
        result?: MockActionSummary;
      }>(response);
      if (!response.ok || !data?.success || !data.result) {
        throw new Error(data?.error ?? `전체 목업 초기화에 실패했습니다. (${response.status})`);
      }

      setLatestSummary(data.result);
      setNotice({
        type: "success",
        message: "전체 MOCK 데이터 초기화가 완료되었습니다.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "전체 목업 초기화에 실패했습니다.",
      });
    } finally {
      setIsResettingAll(false);
    }
  }

  async function handleOpenReset() {
    if (openResetConfirmInput.trim() !== OPEN_RESET_CONFIRM_TEXT) {
      setNotice({
        type: "error",
        message: `확인 문구를 정확히 입력해 주세요. (${OPEN_RESET_CONFIRM_TEXT})`,
      });
      return;
    }

    const ok = await confirm({
      title: "오픈 전 전체 초기화",
      description: [
        "아래 데이터가 전체 삭제됩니다.",
        "- 일반 사용자 계정",
        "- 사전등록 / 제출 / 댓글 / 방문 로그",
        "- 정답 / 정답 변경 이력",
        "- 재채점 / 합격컷 발표 이력",
        "",
        "시험, 지역, 사이트 설정, 관리자 계정은 유지됩니다.",
        "",
        "정말 전체 초기화하시겠습니까?",
      ].join("\n"),
      variant: "danger",
      confirmLabel: "전체 초기화",
    });
    if (!ok) return;

    setIsOpenResetting(true);
    setNotice(null);
    try {
      const response = await fetch(OPEN_RESET_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmText: openResetConfirmInput.trim(),
        }),
      });
      const data = await readResponseJson<{
        success?: boolean;
        error?: string;
        result?: OpenResetSummary;
      }>(response);
      if (!response.ok || !data?.success || !data.result) {
        throw new Error(data?.error ?? `오픈 전 전체 초기화에 실패했습니다. (${response.status})`);
      }

      setOpenResetSummary(data.result);
      setOpenResetConfirmInput("");
      setLatestSummary(null);
      setNotice({
        type: "success",
        message: "오픈 전 전체 초기화가 완료되었습니다.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "오픈 전 전체 초기화에 실패했습니다.",
      });
    } finally {
      setIsOpenResetting(false);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-slate-600">목업 데이터 관리 페이지를 불러오는 중입니다...</p>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">목업 데이터 관리</h1>
        <p className="mt-1 text-sm text-slate-600">
          지역별 경쟁률/합격예측 테스트용 목업 제출 데이터를 생성하고, 필요 시 완전 초기화할 수 있습니다.
        </p>
      </header>

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

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">목업 생성</h2>

        <div className="space-y-2">
          <Label htmlFor="mock-exam">대상 시험</Label>
          <select
            id="mock-exam"
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={selectedExamId ?? ""}
            onChange={(event) => setSelectedExamId(Number(event.target.value) || null)}
          >
            {exams.length < 1 ? <option value="">시험 없음</option> : null}
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.year}년 {exam.round}차 - {exam.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="mock-public-per-region">공채 지역당 생성 수</Label>
            <Input
              id="mock-public-per-region"
              type="number"
              min={1}
              max={200}
              value={publicPerRegion}
              onChange={(event) => setPublicPerRegion(event.target.value)}
            />
          </div>
          {careerExamEnabled ? (
            <div className="space-y-2">
              <Label htmlFor="mock-career-per-region">경행경채 지역당 생성 수</Label>
              <Input
                id="mock-career-per-region"
                type="number"
                min={1}
                max={200}
                value={careerPerRegion}
                onChange={(event) => setCareerPerRegion(event.target.value)}
              />
            </div>
          ) : null}
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={resetBeforeGenerate}
            onChange={(event) => setResetBeforeGenerate(event.target.checked)}
          />
          생성 전 같은 시험의 기존 MOCK 데이터를 먼저 초기화
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={includeFinalPredictionMock}
            onChange={(event) => setIncludeFinalPredictionMock(event.target.checked)}
          />
          최종 환산 예측용 MOCK 데이터도 함께 생성
        </label>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={handleGenerateMockData}
            disabled={isGenerating || isResettingExam || isResettingAll || isOpenResetting || !selectedExamId}
          >
            {isGenerating ? "목업 생성 중..." : "목업 데이터 생성"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleResetExamMockData}
            disabled={isGenerating || isResettingExam || isResettingAll || isOpenResetting || !selectedExamId}
          >
            {isResettingExam ? "선택 시험 초기화 중..." : "선택 시험 목업 초기화"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-rose-300 text-rose-700 hover:bg-rose-50"
            onClick={handleResetAllMockData}
            disabled={isGenerating || isResettingExam || isResettingAll || isOpenResetting}
          >
            {isResettingAll ? "전체 초기화 중..." : "전체 MOCK 완전 삭제"}
          </Button>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-rose-200 bg-rose-50 p-6">
        <div>
          <h2 className="text-base font-semibold text-rose-900">오픈 전 전체 초기화</h2>
          <p className="mt-1 text-sm text-rose-800">
            실제 오픈 직전 한 번만 사용하는 위험 작업입니다. 시험/지역/사이트 설정/관리자 계정은 유지하고,
            일반 사용자와 테스트 누적 데이터를 모두 정리합니다.
          </p>
        </div>

        <div className="rounded-lg border border-rose-200 bg-white/80 p-4 text-sm text-rose-900">
          <p>삭제 범위</p>
          <p>- 일반 사용자 계정 전체</p>
          <p>- 사전등록, 제출, 댓글, 방문 로그</p>
          <p>- 정답, 정답 변경 이력</p>
          <p>- 재채점 이력, 합격컷 발표 이력</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="open-reset-confirm">확인 문구 입력</Label>
          <Input
            id="open-reset-confirm"
            value={openResetConfirmInput}
            onChange={(event) => setOpenResetConfirmInput(event.target.value)}
            placeholder={OPEN_RESET_CONFIRM_TEXT}
            className="max-w-sm bg-white"
          />
          <p className="text-xs text-rose-700">
            버튼 활성화를 위해 <code>{OPEN_RESET_CONFIRM_TEXT}</code> 를 정확히 입력하세요.
          </p>
        </div>

        <div>
          <Button
            type="button"
            variant="outline"
            className="border-rose-400 text-rose-700 hover:bg-rose-100"
            onClick={handleOpenReset}
            disabled={
              isGenerating ||
              isResettingExam ||
              isResettingAll ||
              isOpenResetting ||
              openResetConfirmInput.trim() !== OPEN_RESET_CONFIRM_TEXT
            }
          >
            {isOpenResetting ? "전체 초기화 중..." : "오픈 전 전체 초기화 실행"}
          </Button>
        </div>
      </section>

      {latestSummary ? (
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-base font-semibold text-slate-900">최근 작업 결과</h2>
          <div className="mt-3 grid gap-2 text-sm text-slate-700">
            <p>대상 시험 ID: {latestSummary.examId ?? "전체"}</p>
            {latestSummary.runKey ? <p>실행 키: {latestSummary.runKey}</p> : null}
            {latestSummary.deletedBeforeGenerate ? (
              <p>
                생성 전 삭제: 제출 {latestSummary.deletedBeforeGenerate.submissions}건 / 사용자{" "}
                {latestSummary.deletedBeforeGenerate.users}명
              </p>
            ) : null}
            {latestSummary.created ? (
              <>
                <p>생성 사용자: {latestSummary.created.users}명</p>
                <p>생성 제출: {latestSummary.created.submissions}건</p>
                <p>생성 과목점수: {latestSummary.created.subjectScores}건</p>
                <p>생성 난이도응답: {latestSummary.created.difficultyRatings}건</p>
                <p>생성 최종 환산 예측: {latestSummary.created.finalPredictions}건</p>
              </>
            ) : null}
            {latestSummary.deleted ? (
              <p>
                삭제 결과: 제출 {latestSummary.deleted.submissions}건 / 사용자{" "}
                {latestSummary.deleted.users}명
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {openResetSummary ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-5">
          <h2 className="text-base font-semibold text-rose-900">오픈 전 초기화 결과</h2>
          <div className="mt-3 grid gap-2 text-sm text-rose-900">
            <p>삭제 사용자: {openResetSummary.deleted.users}명</p>
            <p>삭제 사전등록: {openResetSummary.deleted.preRegistrations}건</p>
            <p>삭제 제출: {openResetSummary.deleted.submissions}건</p>
            <p>삭제 댓글: {openResetSummary.deleted.comments}건</p>
            <p>삭제 방문 로그: {openResetSummary.deleted.visitorLogs}건</p>
            <p>삭제 정답: {openResetSummary.deleted.answerKeys}건</p>
            <p>삭제 정답 변경 이력: {openResetSummary.deleted.answerKeyLogs}건</p>
            <p>삭제 재채점 이력: {openResetSummary.deleted.rescoreEvents}건</p>
            <p>삭제 합격컷 발표 이력: {openResetSummary.deleted.passCutReleases}건</p>
            <p>유지 관리자 계정: {openResetSummary.preserved.adminUsers}명</p>
          </div>
        </section>
      ) : null}

      <ConfirmModal {...modalProps} />
    </div>
  );
}
