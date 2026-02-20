"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ExamType = "PUBLIC" | "CAREER";

interface MainStatsRow {
  regionId: number;
  regionName: string;
  examType: ExamType;
  examTypeLabel: string;
  recruitCount: number;
  estimatedApplicants: number;
  competitionRate: number;
  participantCount: number;
  averageFinalScore: number | null;
  oneMultipleCutScore: number | null;
  possibleRange: { min: number | null; max: number | null };
  likelyRange: { min: number | null; max: number | null };
  sureMinScore: number | null;
}

interface DifficultySubject {
  subjectId: number;
  subjectName: string;
  examType: ExamType;
  responses: number;
  veryEasy: number;
  easy: number;
  normal: number;
  hard: number;
  veryHard: number;
}

interface DifficultyPayload {
  totalResponses: number;
  overall: {
    veryEasy: number;
    easy: number;
    normal: number;
    hard: number;
    veryHard: number;
  };
  subjects: DifficultySubject[];
}

interface MainStatsResponse {
  updatedAt: string;
  liveStats: {
    examName: string;
    examYear: number;
    examRound: number;
    totalParticipants: number;
    publicParticipants: number;
    careerParticipants: number;
    recentParticipants: number;
    updatedAt: string | null;
  } | null;
  notices: Array<{
    id: number;
    title: string;
    content: string;
  }>;
  difficulty: DifficultyPayload | null;
  rows: MainStatsRow[];
  topCompetitive: Array<{
    rank: number;
    label: string;
    averageFinalScore: number;
    sureMinScore: number;
    gap: number;
  }>;
  leastCompetitive: Array<{
    rank: number;
    label: string;
    averageFinalScore: number;
    sureMinScore: number;
    gap: number;
  }>;
  subjectScoreDistribution: {
    buckets: string[];
    series: Array<{
      subjectId: number;
      subjectName: string;
      examType: ExamType;
      counts: number[];
    }>;
  };
  refresh: {
    enabled: boolean;
    intervalSec: number;
  };
}

interface DifficultySummary {
  veryEasy: number;
  easy: number;
  normal: number;
  hard: number;
  veryHard: number;
}

function getExamTypeLabel(examType: ExamType): string {
  return examType === "PUBLIC" ? "공채" : "경행경채";
}

function formatDateTime(value: string | null): string {
  if (!value) return "집계 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "집계 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function formatScore(value: number | null): string {
  if (value === null) return "-";
  return `${value.toFixed(2)}점`;
}

function formatRange(range: { min: number | null; max: number | null }): string {
  if (range.min === null || range.max === null) return "데이터 수집 중";
  return `${range.min.toFixed(2)}점 이하 ~ ${range.max.toFixed(2)}점 이상`;
}

function formatCompetition(value: number): string {
  return `${value.toFixed(2)} : 1`;
}

function normalizePercent(value: number): number {
  return Number(value.toFixed(1));
}

function CompetitiveChart({
  title,
  data,
}: {
  title: string;
  data: Array<{
    rank: number;
    label: string;
    averageFinalScore: number;
    sureMinScore: number;
  }>;
}) {
  if (data.length < 1) {
    return (
      <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h4 className="text-sm font-black text-slate-900">{title}</h4>
        <p className="mt-3 text-sm text-slate-500">표시할 데이터가 없습니다.</p>
      </article>
    );
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="text-sm font-black text-slate-900">{title}</h4>
      <div className="mt-3 h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 6, right: 20, left: 10, bottom: 6 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis type="category" dataKey="label" width={118} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value: unknown) => `${Number(value ?? 0).toFixed(2)}점`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="averageFinalScore" name="실시간 입력자 평균" fill="#9ca3af" radius={[0, 4, 4, 0]}>
              <LabelList dataKey="averageFinalScore" position="right" formatter={(v: unknown) => Number(v ?? 0).toFixed(2)} />
            </Bar>
            <Bar dataKey="sureMinScore" name="합격확실권 점수" fill="#2563eb" radius={[0, 4, 4, 0]}>
              <LabelList dataKey="sureMinScore" position="right" formatter={(v: unknown) => Number(v ?? 0).toFixed(2)} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

export default function ExamMainOverviewPanel() {
  const [data, setData] = useState<MainStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [selectedExamType, setSelectedExamType] = useState<ExamType>("PUBLIC");
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
  const [difficultySubjectId, setDifficultySubjectId] = useState<number | null>(null);

  async function loadStats(showLoading: boolean) {
    if (showLoading) setIsLoading(true);

    try {
      const response = await fetch("/api/main-stats", {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as MainStatsResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "풀서비스 메인 통계 조회에 실패했습니다.");
      }
      setData(payload);
      setErrorMessage("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "풀서비스 메인 통계 조회에 실패했습니다.";
      setErrorMessage(message);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadStats(true);
  }, []);

  useEffect(() => {
    if (!data?.refresh?.enabled) return;
    const intervalMs = Math.max(10, data.refresh.intervalSec) * 1000;
    const timer = setInterval(() => {
      void loadStats(false);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [data?.refresh?.enabled, data?.refresh?.intervalSec]);

  const rowsByExamType = useMemo(
    () => (data?.rows ?? []).filter((row) => row.examType === selectedExamType),
    [data?.rows, selectedExamType]
  );

  const regionOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const row of rowsByExamType) {
      if (!map.has(row.regionId)) {
        map.set(row.regionId, row.regionName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rowsByExamType]);

  useEffect(() => {
    if (regionOptions.length < 1) {
      setSelectedRegionId(null);
      return;
    }
    const exists = regionOptions.some((item) => item.id === selectedRegionId);
    if (!exists) {
      setSelectedRegionId(regionOptions[0].id);
    }
  }, [regionOptions, selectedRegionId]);

  const selectedRow = useMemo(
    () => rowsByExamType.find((row) => row.regionId === selectedRegionId) ?? null,
    [rowsByExamType, selectedRegionId]
  );

  const isCollecting = selectedRow !== null && selectedRow.participantCount < 10;

  const difficultySubjects = useMemo(() => data?.difficulty?.subjects ?? [], [data?.difficulty?.subjects]);
  useEffect(() => {
    if (difficultySubjects.length < 1) {
      setDifficultySubjectId(null);
      return;
    }
    const exists = difficultySubjects.some((subject) => subject.subjectId === difficultySubjectId);
    if (!exists) {
      setDifficultySubjectId(difficultySubjects[0].subjectId);
    }
  }, [difficultySubjects, difficultySubjectId]);

  const difficultySummary = useMemo((): DifficultySummary | null => {
    if (!data?.difficulty) return null;
    const selected = difficultySubjects.find((item) => item.subjectId === difficultySubjectId);
    if (selected) {
      return {
        veryEasy: normalizePercent(selected.veryEasy),
        easy: normalizePercent(selected.easy),
        normal: normalizePercent(selected.normal),
        hard: normalizePercent(selected.hard),
        veryHard: normalizePercent(selected.veryHard),
      };
    }
    return {
      veryEasy: normalizePercent(data.difficulty.overall.veryEasy),
      easy: normalizePercent(data.difficulty.overall.easy),
      normal: normalizePercent(data.difficulty.overall.normal),
      hard: normalizePercent(data.difficulty.overall.hard),
      veryHard: normalizePercent(data.difficulty.overall.veryHard),
    };
  }, [data?.difficulty, difficultySubjectId, difficultySubjects]);

  const difficultyChartData = useMemo(() => {
    if (!difficultySummary) return [];
    return [
      { label: "매우 쉬움", value: difficultySummary.veryEasy },
      { label: "다소 쉬움", value: difficultySummary.easy },
      { label: "무난함", value: difficultySummary.normal },
      { label: "다소 어려움", value: difficultySummary.hard },
      { label: "매우 어려움", value: difficultySummary.veryHard },
    ];
  }, [difficultySummary]);

  const distributionSeries = useMemo(
    () => (data?.subjectScoreDistribution.series ?? []).filter((item) => item.examType === selectedExamType),
    [data?.subjectScoreDistribution.series, selectedExamType]
  );

  const distributionData = useMemo(() => {
    const buckets = ["69점 이하", "70~79점", "80~89점", "90점 이상"];
    return buckets.map((bucket, index) => {
      const row: Record<string, string | number> = { bucket };
      for (const series of distributionSeries) {
        row[`s_${series.subjectId}`] = series.counts[index] ?? 0;
      }
      return row;
    });
  }, [distributionSeries]);

  const competitiveRows = useMemo(() => {
    const base = rowsByExamType
      .filter((row) => row.participantCount >= 10 && row.averageFinalScore !== null && row.sureMinScore !== null)
      .map((row) => ({
        label: `${row.regionName}-${getExamTypeLabel(row.examType)}`,
        averageFinalScore: row.averageFinalScore as number,
        sureMinScore: row.sureMinScore as number,
        gap: (row.sureMinScore as number) - (row.averageFinalScore as number),
      }));

    const top = base
      .slice()
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 5)
      .map((item, index) => ({ rank: index + 1, ...item }));

    const least = base
      .slice()
      .sort((a, b) => a.gap - b.gap)
      .slice(0, 5)
      .map((item, index) => ({ rank: index + 1, ...item }));

    return { top, least };
  }, [rowsByExamType]);

  if (isLoading) {
    return <section className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">풀서비스 메인 정보를 불러오는 중입니다...</section>;
  }

  if (errorMessage && !data) {
    return <section className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{errorMessage}</section>;
  }

  if (!data?.liveStats) {
    return <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">현재 집계 가능한 시험 데이터가 없습니다.</section>;
  }

  return (
    <div className="space-y-5">
      {errorMessage ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-900 bg-[radial-gradient(circle_at_top_right,#10257a,#050b31_60%,#02051c)] p-5 text-white">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-2xl font-black tracking-tight">
            {data.liveStats.examYear}.{String(data.liveStats.examRound).padStart(2, "0")} 시행
          </p>
          <p className="text-xs text-emerald-300">UPDATE {formatDateTime(data.updatedAt)}</p>
        </div>
        <h2 className="mt-5 text-2xl font-black">직렬별 실시간 합격예측 분석</h2>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="overflow-hidden rounded-xl border border-white/20 bg-black/20">
            <table className="w-full border-collapse text-sm">
              <tbody>
                <tr>
                  <th className="w-[180px] border border-white/20 bg-black/30 px-3 py-2 text-left text-emerald-300">
                    지역-직렬
                  </th>
                  <td className="border border-white/20 px-3 py-2 font-bold">
                    {selectedRow ? `${selectedRow.regionName}-${getExamTypeLabel(selectedRow.examType)}` : "-"}
                  </td>
                </tr>
                <tr>
                  <th className="border border-white/20 bg-black/30 px-3 py-2 text-left text-emerald-300">선발인원</th>
                  <td className="border border-white/20 px-3 py-2">{selectedRow ? `${selectedRow.recruitCount.toLocaleString("ko-KR")}명` : "-"}</td>
                </tr>
                <tr>
                  <th className="border border-white/20 bg-black/30 px-3 py-2 text-left text-emerald-300">접수인원</th>
                  <td className="border border-white/20 px-3 py-2">{selectedRow ? `${selectedRow.estimatedApplicants.toLocaleString("ko-KR")}명` : "-"}</td>
                </tr>
                <tr>
                  <th className="border border-white/20 bg-black/30 px-3 py-2 text-left text-emerald-300">경쟁률</th>
                  <td className="border border-white/20 px-3 py-2">{selectedRow ? formatCompetition(selectedRow.competitionRate) : "-"}</td>
                </tr>
                <tr>
                  <th className="border border-white/20 bg-black/30 px-3 py-2 text-left text-emerald-300">실시간 평균점수</th>
                  <td className="border border-white/20 px-3 py-2">{selectedRow ? (isCollecting ? "데이터 수집 중" : formatScore(selectedRow.averageFinalScore)) : "-"}</td>
                </tr>
                <tr>
                  <th className="border border-white/20 bg-black/30 px-3 py-2 text-left text-emerald-300">합격가능권</th>
                  <td className="border border-white/20 px-3 py-2">{selectedRow ? (isCollecting ? "데이터 수집 중" : formatRange(selectedRow.possibleRange)) : "-"}</td>
                </tr>
                <tr>
                  <th className="border border-white/20 bg-black/30 px-3 py-2 text-left text-emerald-300">합격유력권</th>
                  <td className="border border-white/20 px-3 py-2">{selectedRow ? (isCollecting ? "데이터 수집 중" : formatRange(selectedRow.likelyRange)) : "-"}</td>
                </tr>
                <tr>
                  <th className="border border-white/20 bg-black/30 px-3 py-2 text-left text-emerald-300">합격확실권</th>
                  <td className="border border-white/20 px-3 py-2">{selectedRow ? (isCollecting ? "데이터 수집 중" : `${formatScore(selectedRow.sureMinScore).replace("점", "")}점 이상`) : "-"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-white/20 bg-black/20 p-4">
            <p className="text-xs text-white/70">지역 선택</p>
            <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {regionOptions.map((region) => {
                const active = region.id === selectedRegionId;
                return (
                  <button
                    key={region.id}
                    type="button"
                    className={`rounded-full border px-2 py-2 text-xs font-semibold transition ${
                      active
                        ? "border-emerald-300 bg-emerald-500/20 text-emerald-200"
                        : "border-white/30 bg-white/5 text-white/80 hover:bg-white/15"
                    }`}
                    onClick={() => setSelectedRegionId(region.id)}
                  >
                    {region.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <h3 className="text-xl font-black text-slate-900">
            직렬별 <span className="text-emerald-600">실시간</span> 합격예측 분석
          </h3>
          <div className="w-full max-w-md">
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={selectedRegionId === null ? "" : String(selectedRegionId)}
              onChange={(event) => {
                const next = Number(event.target.value);
                setSelectedRegionId(Number.isFinite(next) ? next : null);
              }}
            >
              {regionOptions.map((region) => (
                <option key={region.id} value={region.id}>
                  {getExamTypeLabel(selectedExamType)} : {region.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-sm">
              <tbody>
                <tr>
                  <th className="w-[180px] border border-slate-200 bg-slate-100 px-3 py-3 text-center text-slate-700">합격가능권</th>
                  <td className="border border-slate-200 px-3 py-3">{selectedRow ? (isCollecting ? "데이터 수집 중" : formatRange(selectedRow.possibleRange)) : "-"}</td>
                </tr>
                <tr>
                  <th className="border border-slate-200 bg-slate-100 px-3 py-3 text-center text-slate-700">합격유력권</th>
                  <td className="border border-slate-200 px-3 py-3">{selectedRow ? (isCollecting ? "데이터 수집 중" : formatRange(selectedRow.likelyRange)) : "-"}</td>
                </tr>
                <tr>
                  <th className="border border-slate-200 bg-slate-100 px-3 py-3 text-center text-slate-700">합격확실권</th>
                  <td className="border border-slate-200 px-3 py-3">{selectedRow ? (isCollecting ? "데이터 수집 중" : `${formatScore(selectedRow.sureMinScore).replace("점", "")}점 이상`) : "-"}</td>
                </tr>
                <tr>
                  <th className="border border-slate-200 bg-slate-100 px-3 py-3 text-center text-slate-700">1배수 입력자 컷</th>
                  <td className="border border-slate-200 px-3 py-3">{selectedRow ? (isCollecting ? "데이터 수집 중" : formatScore(selectedRow.oneMultipleCutScore)) : "-"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-sm">
              <tbody>
                <tr>
                  <th className="w-[180px] border border-slate-200 bg-slate-100 px-3 py-3 text-center text-slate-700">실시간 평균점수</th>
                  <td className="border border-slate-200 px-3 py-3">{selectedRow ? (isCollecting ? "데이터 수집 중" : formatScore(selectedRow.averageFinalScore)) : "-"}</td>
                </tr>
                <tr>
                  <th className="border border-slate-200 bg-slate-100 px-3 py-3 text-center text-slate-700">선발인원</th>
                  <td className="border border-slate-200 px-3 py-3">{selectedRow ? `${selectedRow.recruitCount.toLocaleString("ko-KR")}명` : "-"}</td>
                </tr>
                <tr>
                  <th className="border border-slate-200 bg-slate-100 px-3 py-3 text-center text-slate-700">접수인원</th>
                  <td className="border border-slate-200 px-3 py-3">{selectedRow ? `${selectedRow.estimatedApplicants.toLocaleString("ko-KR")}명` : "-"}</td>
                </tr>
                <tr>
                  <th className="border border-slate-200 bg-slate-100 px-3 py-3 text-center text-slate-700">경쟁률</th>
                  <td className="border border-slate-200 px-3 py-3">{selectedRow ? formatCompetition(selectedRow.competitionRate) : "-"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-2xl font-black text-slate-900">
          과목별 체감난이도 <span className="text-emerald-600">설문 결과</span>
        </h3>

        <div className="mt-4 rounded-lg border border-slate-200 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="text-sm font-semibold text-slate-700">
              과목 선택
              <select
                className="ml-3 h-10 min-w-[180px] rounded-md border border-slate-300 px-3 text-sm"
                value={difficultySubjectId ?? ""}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setDifficultySubjectId(Number.isFinite(next) ? next : null);
                }}
              >
                {difficultySubjects.map((subject) => (
                  <option key={subject.subjectId} value={subject.subjectId}>
                    {subject.subjectName} ({getExamTypeLabel(subject.examType)})
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-full bg-slate-700 px-6 py-2 text-center text-sm font-bold text-white">
              {difficultySubjects.find((item) => item.subjectId === difficultySubjectId)?.subjectName ?? "전체"}
            </div>
          </div>

          <div className="mt-5 h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={difficultyChartData} margin={{ top: 10, right: 16, left: 6, bottom: 8 }}>
                <CartesianGrid stroke="#fecaca" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(value: unknown) => `${Number(value ?? 0).toFixed(1)}%`} />
                <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="value" position="top" formatter={(v: unknown) => `${Number(v ?? 0).toFixed(1)}%`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-base font-black text-slate-900">실시간 최대/최소 경쟁 예상지역 TOP5</h3>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <CompetitiveChart title="실시간 최대 경쟁 예상지역 TOP5" data={competitiveRows.top} />
          <CompetitiveChart title="실시간 최소 경쟁 예상지역 TOP5" data={competitiveRows.least} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-base font-black text-slate-900">필수과목: 채점자 성적 분포</h3>
        {distributionSeries.length > 0 ? (
          <div className="mt-4 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={distributionData} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bucket" />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(value: unknown) => `${Number(value ?? 0).toLocaleString("ko-KR")}명`} />
                <Legend />
                {distributionSeries.map((series, index) => (
                  <Line
                    key={series.subjectId}
                    type="monotone"
                    dataKey={`s_${series.subjectId}`}
                    name={series.subjectName}
                    stroke={["#f97316", "#eab308", "#2563eb", "#10b981", "#ef4444"][index % 5]}
                    strokeWidth={2.4}
                    dot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">표시할 성적 분포 데이터가 없습니다.</p>
        )}
      </section>
    </div>
  );
}
