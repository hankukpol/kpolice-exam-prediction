"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/button";

interface PredictionPageResponse {
  summary: {
    submissionId: number;
    examId: number;
    examName: string;
    examYear: number;
    examRound: number;
    userName: string;
    examType: "PUBLIC" | "CAREER";
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
    predictionGrade: "확실권" | "유력권" | "가능권" | "도전권";
    disclaimer: string;
  };
  pyramid: {
    levels: Array<{
      key: "sure" | "likely" | "possible" | "challenge" | "belowChallenge";
      label: string;
      count: number;
      minScore: number | null;
      maxScore: number | null;
      minMultiple: number | null;
      maxMultiple: number | null;
      isCurrent: boolean;
    }>;
    counts: {
      sure: number;
      likely: number;
      possible: number;
      challenge: number;
      belowChallenge: number;
    };
  };
  competitors: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    items: Array<{
      submissionId: number;
      userId: number;
      rank: number;
      score: number;
      maskedName: string;
      isMine: boolean;
    }>;
  };
  updatedAt: string;
}

interface ExamPredictionPageProps {
  embedded?: boolean;
}

function formatScore(value: number | null): string {
  if (value === null) return "-";
  return value.toFixed(2);
}

function levelColor(key: PredictionPageResponse["pyramid"]["levels"][number]["key"], current: boolean): string {
  if (key === "sure") return current ? "bg-blue-900" : "bg-blue-800";
  if (key === "likely") return current ? "bg-blue-700" : "bg-blue-600";
  if (key === "possible") return current ? "bg-cyan-600" : "bg-cyan-500";
  if (key === "challenge") return current ? "bg-slate-500" : "bg-slate-400";
  return current ? "bg-slate-300" : "bg-slate-200";
}

function levelTextColor(key: PredictionPageResponse["pyramid"]["levels"][number]["key"]): string {
  return key === "belowChallenge" ? "text-slate-700" : "text-white";
}

function buildPageNumbers(page: number, totalPages: number): number[] {
  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  return Array.from(pages)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
}

export default function ExamPredictionPage({ embedded = false }: ExamPredictionPageProps = {}) {
  const router = useRouter();
  const { showErrorToast } = useToast();

  const [page, setPage] = useState(1);
  const [prediction, setPrediction] = useState<PredictionPageResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const pageRef = useRef(page);

  const fetchPrediction = useCallback(
    async (targetPage: number, silent = false) => {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage("");

      try {
        const response = await fetch(`/api/prediction?page=${targetPage}&limit=20`, {
          method: "GET",
          cache: "no-store",
        });
        const data = (await response.json()) as PredictionPageResponse & { error?: string };

        if (!response.ok) {
          if (response.status === 401) {
            if (embedded) {
              setErrorMessage("로그인이 필요합니다.");
            } else {
              router.replace("/login?callbackUrl=/exam/prediction");
            }
            return;
          }

          if (response.status === 404) {
            if (embedded) {
              setErrorMessage("합격예측을 위한 제출 데이터가 없습니다. 먼저 답안을 제출해 주세요.");
            } else {
              router.replace("/exam/input");
            }
            return;
          }

          throw new Error(data.error ?? "합격예측 데이터를 불러오지 못했습니다.");
        }

        setPrediction(data);
        if (targetPage !== data.competitors.page) {
          setPage(data.competitors.page);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "합격예측 데이터를 불러오지 못했습니다.";
        setErrorMessage(message);
        showErrorToast(message);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [embedded, router, showErrorToast]
  );

  useEffect(() => {
    void fetchPrediction(page);
  }, [fetchPrediction, page]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    const interval = setInterval(() => {
      void fetchPrediction(pageRef.current, true);
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchPrediction]);

  const pageNumbers = useMemo(() => {
    if (!prediction) return [];
    return buildPageNumbers(prediction.competitors.page, prediction.competitors.totalPages);
  }, [prediction]);

  if (isLoading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
        합격예측 데이터를 불러오는 중입니다...
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700">
        {errorMessage}
      </section>
    );
  }

  if (!prediction) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
        합격예측 데이터가 없습니다.
      </section>
    );
  }

  const { summary, pyramid, competitors } = prediction;
  const widths = [32, 44, 58, 74, 88];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 text-center">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          {summary.userName}님은 {summary.examTypeLabel} 입력자{" "}
          <span className="text-blue-600">{summary.totalParticipants}명</span> 중{" "}
          <span className="text-blue-600">{summary.myRank}등</span>입니다.
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {summary.examYear}년 {summary.examRound}차 | {summary.examName}
          {isRefreshing ? " (업데이트 중)" : ""}
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold text-slate-600">
            {summary.examTypeLabel} - {summary.regionName}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4">
            <div>
              <p className="text-xs text-slate-500">내 점수</p>
              <p className="text-3xl font-bold text-blue-600">{summary.myScore.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">배수점</p>
              <p className="text-3xl font-bold text-blue-600">{formatScore(summary.passLineScore)}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 text-center text-sm">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">선발인원</p>
              <p className="mt-1 font-semibold text-slate-900">{summary.recruitCount}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">응시인원(추정)</p>
              <p className="mt-1 font-semibold text-slate-900">
                {summary.estimatedApplicants.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">참여인원</p>
              <p className="mt-1 font-semibold text-slate-900">
                {summary.totalParticipants.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-slate-700">
            <p>
              내 배수 <span className="font-semibold text-blue-700">{summary.myMultiple.toFixed(2)}배</span> / 합격배수{" "}
              <span className="font-semibold text-blue-700">{summary.passMultiple.toFixed(2)}배</span>
            </p>
            <p className="mt-1">
              현재 예측 등급: <span className="font-bold text-blue-700">{summary.predictionGrade}</span>
            </p>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-900">합격예측 피라미드</h2>
          <p className="mt-1 text-xs text-slate-500">확실권/유력권/가능권/도전권/도전권 이하 5단계</p>

          <div className="mt-5 space-y-3">
            {pyramid.levels.map((level, index) => (
              <div key={level.key} className="grid grid-cols-1 items-center gap-3 lg:grid-cols-[1fr_320px]">
                <div className="mx-auto w-full max-w-xl">
                  <div
                    className={`mx-auto flex h-12 items-center justify-center rounded-sm px-3 text-sm font-semibold transition ${
                      levelColor(level.key, level.isCurrent)
                    } ${levelTextColor(level.key)} ${level.isCurrent ? "ring-2 ring-offset-2 ring-blue-300" : ""}`}
                    style={{
                      width: `${widths[index]}%`,
                      clipPath: "polygon(8% 0, 92% 0, 100% 100%, 0 100%)",
                    }}
                  >
                    {level.label} {level.count}명
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                  <p className="font-semibold text-slate-800">
                    {level.minScore === null ? "기준점수 미만" : `${level.minScore.toFixed(2)}점 이상`}
                  </p>
                  <p className="mt-1">
                    배수:{" "}
                    {level.maxMultiple === null
                      ? `${level.minMultiple?.toFixed(2) ?? "-"}배 초과`
                      : `${level.minMultiple === null ? "0.00" : level.minMultiple.toFixed(2)} ~ ${level.maxMultiple.toFixed(2)}배`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">등급별 인원 분포</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {pyramid.levels.map((level) => (
            <div
              key={`dist-${level.key}`}
              className={`rounded-lg border p-4 text-center ${
                level.isCurrent ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-slate-50"
              }`}
            >
              <p className="text-sm font-semibold text-slate-700">{level.label}</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{level.count}명</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-base font-semibold text-slate-900">경쟁자 순위</h2>
          <p className="text-xs text-slate-500">
            {competitors.totalCount.toLocaleString()}명 중 {competitors.page}/{competitors.totalPages} 페이지
          </p>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="border border-slate-200 px-3 py-2 text-left">석차</th>
                <th className="border border-slate-200 px-3 py-2 text-left">이름</th>
                <th className="border border-slate-200 px-3 py-2 text-right">점수</th>
              </tr>
            </thead>
            <tbody>
              {competitors.items.map((competitor) => (
                <tr
                  key={competitor.submissionId}
                  className={competitor.isMine ? "bg-blue-50 font-semibold text-blue-900" : "bg-white"}
                >
                  <td className="border border-slate-200 px-3 py-2">{competitor.rank}</td>
                  <td className="border border-slate-200 px-3 py-2">
                    {competitor.isMine ? "★ 나" : competitor.maskedName}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-right">{competitor.score.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={competitors.page <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            이전
          </Button>
          {pageNumbers.map((number) => (
            <Button
              key={number}
              type="button"
              variant={number === competitors.page ? "default" : "outline"}
              onClick={() => setPage(number)}
            >
              {number}
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={competitors.page >= competitors.totalPages}
            onClick={() => setPage((prev) => Math.min(competitors.totalPages, prev + 1))}
          >
            다음
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        ※ 면책조항: {summary.disclaimer}
      </section>
    </div>
  );
}
