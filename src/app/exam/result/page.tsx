"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AnswerSheet from "@/components/result/AnswerSheet";
import CorrectRateChart from "@/components/result/CorrectRateChart";
import ShareButton from "@/components/share/ShareButton";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/button";

interface ResultResponse {
  features: {
    finalPredictionEnabled: boolean;
  };
  submission: {
    id: number;
    isOwner: boolean;
    examId: number;
    examName: string;
    examYear: number;
    examRound: number;
    examType: "PUBLIC" | "CAREER";
    regionId: number;
    regionName: string;
    gender: "MALE" | "FEMALE";
    examNumber: string | null;
    totalScore: number;
    finalScore: number;
    bonusType: "NONE" | "VETERAN_5" | "VETERAN_10" | "HERO_3" | "HERO_5";
    bonusRate: number;
    createdAt: string;
    editCount: number;
    maxEditLimit: number;
  };
  scores: Array<{
    subjectId: number;
    subjectName: string;
    questionCount: number;
    pointPerQuestion: number;
    correctCount: number;
    rawScore: number;
    maxScore: number;
    bonusScore: number;
    finalScore: number;
    isCutoff: boolean;
    cutoffScore: number;
    rank: number;
    percentile: number;
    totalParticipants: number;
    difficulty: "VERY_EASY" | "EASY" | "NORMAL" | "HARD" | "VERY_HARD" | null;
    answers: Array<{
      questionNumber: number;
      selectedAnswer: number;
      isCorrect: boolean;
      correctAnswer: number | null;
      correctRate: number;
      difficultyLevel: "EASY" | "NORMAL" | "HARD" | "VERY_HARD";
    }>;
  }>;
  subjectCorrectRateSummaries: Array<{
    subjectId: number;
    subjectName: string;
    averageCorrectRate: number;
    hardestQuestion: number | null;
    hardestRate: number | null;
    easiestQuestion: number | null;
    easiestRate: number | null;
    myCorrectOnHard: number;
    myWrongOnEasy: number;
  }>;
  statistics: {
    totalParticipants: number;
    totalRank: number;
    totalPercentile: number;
    hasCutoff: boolean;
    rankingBasis: "ALL_PARTICIPANTS" | "NON_CUTOFF_PARTICIPANTS";
    cutoffSubjects: Array<{
      subjectName: string;
      rawScore: number;
      maxScore: number;
      cutoffScore: number;
    }>;
    bonusScore: number;
  };
}

interface ExamResultPageProps {
  embedded?: boolean;
}

function formatBonusType(type: ResultResponse["submission"]["bonusType"]): string {
  switch (type) {
    case "VETERAN_5":
      return "취업지원 5%";
    case "VETERAN_10":
      return "취업지원 10%";
    case "HERO_3":
      return "의사상자 3%";
    case "HERO_5":
      return "의사상자 5%";
    default:
      return "해당 없음";
  }
}

function formatRankingBasis(basis: ResultResponse["statistics"]["rankingBasis"]): string {
  if (basis === "NON_CUTOFF_PARTICIPANTS") return "과락 미해당자 기준";
  return "전체 참여자 기준";
}

export default function ExamResultPage({ embedded = false }: ExamResultPageProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showErrorToast } = useToast();

  const [result, setResult] = useState<ResultResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadResult() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const fromQuery = searchParams.get("submissionId");
        const fromStorage =
          typeof window !== "undefined" ? sessionStorage.getItem("latestSubmissionId") : null;
        const submissionId = fromQuery ?? fromStorage ?? "";
        const query = submissionId ? `?submissionId=${encodeURIComponent(submissionId)}` : "";

        const response = await fetch(`/api/result${query}`, {
          method: "GET",
          cache: "no-store",
        });
        const data = (await response.json()) as ResultResponse & { error?: string };

        if (!response.ok) {
          if (response.status === 404) {
            if (embedded) {
              if (!mounted) return;
              setResult(null);
              setErrorMessage("아직 제출된 성적이 없습니다. 먼저 OMR 답안을 제출해 주세요.");
            } else {
              router.replace("/exam/input");
            }
            return;
          }

          throw new Error(data.error ?? "성적 정보를 불러오지 못했습니다.");
        }

        if (!mounted) return;
        setResult(data);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("latestSubmissionId", String(data.submission.id));
        }
      } catch (error) {
        if (!mounted) return;
        const message = error instanceof Error ? error.message : "성적 정보를 불러오지 못했습니다.";
        setErrorMessage(message);
        showErrorToast(message);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadResult();
    return () => {
      mounted = false;
    };
  }, [embedded, router, searchParams, showErrorToast]);

  const scoreChartData = useMemo(() => {
    if (!result) return [];
    return result.scores.map((score) => ({
      subjectName: score.subjectName,
      rawScore: score.rawScore,
      fill: score.isCutoff ? "#ef4444" : "#2563eb",
    }));
  }, [result]);

  const subjectAnswerData = useMemo(() => {
    if (!result) return [];
    return result.scores.map((score) => ({
      subjectId: score.subjectId,
      subjectName: score.subjectName,
      answers: score.answers,
    }));
  }, [result]);

  if (isLoading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
        성적 분석 화면을 불러오는 중입니다...
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

  if (!result) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
        조회 가능한 성적이 없습니다.
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-lg font-semibold text-slate-900">내 성적 분석</h1>
          <ShareButton submissionId={result.submission.id} sharePath="/exam/result" />
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {result.submission.examYear}년 {result.submission.examRound}차 ·{" "}
          {result.submission.examType === "PUBLIC" ? "공채" : "경행경채"} · {result.submission.regionName}
        </p>
        <p className="mt-1 text-xs text-slate-500">응시번호: {result.submission.examNumber ?? "-"}</p>

        <div className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">원점수</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{result.submission.totalScore.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">최종점수</p>
            <p className="mt-1 text-lg font-bold text-blue-700">{result.submission.finalScore.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">전체 석차</p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {result.statistics.totalRank} / {result.statistics.totalParticipants}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">백분위</p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {result.statistics.totalPercentile.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="mt-6 h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={scoreChartData} margin={{ top: 20, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="subjectName"
                tick={{ fontSize: 12, fill: "#64748b" }}
                axisLine={{ stroke: "#cbd5e1" }}
                tickLine={false}
                tickMargin={10}
              />
              <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "transparent" }}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 4px 12px rgba(15, 23, 42, 0.08)",
                }}
                formatter={(value: unknown) => `${Number(value ?? 0).toFixed(2)}점`}
              />
              <Bar dataKey="rawScore" radius={[6, 6, 0, 0]} barSize={90}>
                {scoreChartData.map((item) => (
                  <Cell key={item.subjectName} fill={item.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">상세 분석</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[720px] w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="border border-slate-200 px-3 py-2 text-left">구분</th>
                <th className="border border-slate-200 px-3 py-2 text-right">총점</th>
                {result.scores.map((score) => (
                  <th key={score.subjectId} className="border border-slate-200 px-3 py-2 text-right">
                    {score.subjectName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-200 px-3 py-2 font-medium text-slate-700">원점수</td>
                <td className="border border-slate-200 px-3 py-2 text-right font-semibold text-slate-900">
                  {result.submission.totalScore.toFixed(1)}
                </td>
                {result.scores.map((score) => (
                  <td key={`${score.subjectId}-raw`} className="border border-slate-200 px-3 py-2 text-right">
                    {score.rawScore.toFixed(1)}
                  </td>
                ))}
              </tr>
              <tr className="bg-slate-50">
                <td className="border border-slate-200 px-3 py-2 font-medium text-slate-700">백분위</td>
                <td className="border border-slate-200 px-3 py-2 text-right">
                  {result.statistics.totalPercentile.toFixed(1)}%
                </td>
                {result.scores.map((score) => (
                  <td key={`${score.subjectId}-percentile`} className="border border-slate-200 px-3 py-2 text-right">
                    {score.percentile.toFixed(1)}%
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border border-slate-200 px-3 py-2 font-medium text-slate-700">석차/참여자</td>
                <td className="border border-slate-200 px-3 py-2 text-right">
                  {result.statistics.totalRank}/{result.statistics.totalParticipants}
                </td>
                {result.scores.map((score) => (
                  <td key={`${score.subjectId}-rank`} className="border border-slate-200 px-3 py-2 text-right">
                    {score.rank}/{score.totalParticipants}
                  </td>
                ))}
              </tr>
              <tr className="bg-slate-50">
                <td className="border border-slate-200 px-3 py-2 font-medium text-slate-700">과락</td>
                <td className="border border-slate-200 px-3 py-2 text-right">
                  {result.statistics.hasCutoff ? (
                    <span className="font-semibold text-rose-600">과락</span>
                  ) : (
                    "-"
                  )}
                </td>
                {result.scores.map((score) => (
                  <td key={`${score.subjectId}-cutoff`} className="border border-slate-200 px-3 py-2 text-right">
                    {score.isCutoff ? <span className="font-semibold text-rose-600">과락</span> : "-"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">순위 기준: {formatRankingBasis(result.statistics.rankingBasis)}</p>
      </section>

      {result.statistics.hasCutoff ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-5">
          <h3 className="text-sm font-semibold text-rose-700">과락 과목이 있습니다.</h3>
          <div className="mt-2 space-y-1 text-sm text-rose-700">
            {result.statistics.cutoffSubjects.map((subject) => (
              <p key={subject.subjectName}>
                {subject.subjectName}: {subject.rawScore.toFixed(1)}점 (과락 기준 {subject.cutoffScore.toFixed(1)}점
                미만)
              </p>
            ))}
          </div>
        </section>
      ) : null}

      <CorrectRateChart subjects={subjectAnswerData} />
      <AnswerSheet subjects={subjectAnswerData} summaries={result.subjectCorrectRateSummaries} />

      <section className="rounded-xl border border-blue-200 bg-blue-50 p-5">
        <h3 className="text-sm font-semibold text-slate-900">가산점 적용 요약</h3>
        <div className="mt-2 space-y-1 text-sm text-slate-700">
          <p>원점수 합계: {result.submission.totalScore.toFixed(1)}점</p>
          <p>
            가산점: {formatBonusType(result.submission.bonusType)} ({(result.submission.bonusRate * 100).toFixed(0)}
            %) / +{result.statistics.bonusScore.toFixed(1)}점
          </p>
          <p className="font-semibold text-slate-900">최종점수: {result.submission.finalScore.toFixed(1)}점</p>
        </div>
      </section>

      {!embedded ? (
        <div className="mt-8 flex flex-wrap justify-end gap-3">
          {result.submission.isOwner &&
          result.submission.editCount < result.submission.maxEditLimit &&
          result.submission.maxEditLimit > 0 ? (
            <Button type="button" variant="outline" onClick={() => router.push(`/exam/input?edit=${result.submission.id}`)}>
              답안 수정 ({result.submission.maxEditLimit - result.submission.editCount}/
              {result.submission.maxEditLimit}회 남음)
            </Button>
          ) : null}
          {result.features.finalPredictionEnabled ? (
            <Button type="button" variant="outline" onClick={() => router.push("/exam/final")}>
              최종 환산 예측
            </Button>
          ) : null}
          <Button
            type="button"
            className="rounded-none border border-transparent bg-slate-900 text-white shadow-sm hover:bg-slate-800"
            onClick={() => router.push("/exam/prediction")}
          >
            합격예측 분석 보기
          </Button>
        </div>
      ) : null}
    </div>
  );
}
