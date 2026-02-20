"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";

const ADMIN_EXAM_API = "/api/admin/exam";
const STATS_API = "/api/stats";

interface ExamItem {
  id: number;
  name: string;
  year: number;
  round: number;
  isActive: boolean;
}

interface RegionStat {
  regionId: number;
  regionName: string;
  publicCount: number;
  careerCount: number;
  total: number;
  avgTotalScore: number;
  avgFinalScore: number;
}

type PredictionExamType = "PUBLIC" | "CAREER";

interface RegionPredictionStat {
  regionId: number;
  regionName: string;
  examType: PredictionExamType;
  recruitCount: number;
  participantCount: number;
  oneMultipleBaseRank: number;
  oneMultipleActualRank: number | null;
  oneMultipleCutScore: number | null;
  oneMultipleTieCount: number | null;
}

interface DateStat {
  date: string;
  count: number;
}

interface ScoreDistributionItem {
  bucket: number;
  label: string;
  start: number;
  end: number;
  count: number;
  isCutoffRange: boolean;
}

interface DifficultySubjectStat {
  subjectId: number;
  subjectName: string;
  examType: "PUBLIC" | "CAREER";
  responses: number;
  veryEasy: number;
  easy: number;
  normal: number;
  hard: number;
  veryHard: number;
  easyCombined: number;
  hardCombined: number;
  dominantLabel: "留ㅼ슦 ?ъ?" | "?ъ?" | "蹂댄넻" | "?대젮?" | "留ㅼ슦 ?대젮?";
}

interface DifficultyStatSummary {
  examId: number;
  examName: string;
  totalResponses: number;
  overall: {
    veryEasy: number;
    easy: number;
    normal: number;
    hard: number;
    veryHard: number;
    easyCombined: number;
    hardCombined: number;
    dominantLabel: "留ㅼ슦 ?ъ?" | "?ъ?" | "蹂댄넻" | "?대젮?" | "留ㅼ슦 ?대젮?";
  };
  subjects: DifficultySubjectStat[];
}

interface StatsResponse {
  exam: {
    id: number;
    name: string;
    year: number;
    round: number;
    examDate: string;
    isActive: boolean;
  };
  totalParticipants: number;
  byExamType: {
    PUBLIC: number;
    CAREER: number;
  };
  byGender: {
    MALE: number;
    FEMALE: number;
  };
  byRegion: RegionStat[];
  byRegionPrediction: RegionPredictionStat[];
  submissionsByDate: DateStat[];
  scoreDistribution: ScoreDistributionItem[];
  difficulty: DifficultyStatSummary | null;
}

type NoticeState = {
  type: "success" | "error";
  message: string;
} | null;

function formatDate(dateText: string): string {
  const parsed = new Date(dateText);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("ko-KR");
}

function formatScore(value: number): string {
  return value.toFixed(1);
}

function formatNullableScore(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return value.toFixed(2);
}

function escapeCsvCell(value: string | number): string {
  const raw = String(value);
  if (raw.includes(",") || raw.includes('"') || raw.includes("\n")) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function buildStatsCsvContent(stats: StatsResponse): string {
  const lines: string[] = [];
  lines.push("구분,항목,값");
  lines.push(`${escapeCsvCell("시험")},${escapeCsvCell("시험명")},${escapeCsvCell(stats.exam.name)}`);
  lines.push(
    `${escapeCsvCell("시험")},${escapeCsvCell("시험차수")},${escapeCsvCell(
      `${stats.exam.year}년 ${stats.exam.round}차`
    )}`
  );
  lines.push(`${escapeCsvCell("참여현황")},${escapeCsvCell("총 참여자")},${escapeCsvCell(stats.totalParticipants)}`);
  lines.push(`${escapeCsvCell("참여현황")},${escapeCsvCell("공채")},${escapeCsvCell(stats.byExamType.PUBLIC)}`);
  lines.push(`${escapeCsvCell("참여현황")},${escapeCsvCell("경행경채")},${escapeCsvCell(stats.byExamType.CAREER)}`);
  lines.push(`${escapeCsvCell("성별")},${escapeCsvCell("남성")},${escapeCsvCell(stats.byGender.MALE)}`);
  lines.push(`${escapeCsvCell("성별")},${escapeCsvCell("여성")},${escapeCsvCell(stats.byGender.FEMALE)}`);
  lines.push("");

  lines.push("지역별 통계,,,,,");
  lines.push("지역,공채,경행경채,합계,평균 원점수,평균 최종점수");
  for (const row of stats.byRegion) {
    lines.push(
      [
        row.regionName,
        row.publicCount,
        row.careerCount,
        row.total,
        formatScore(row.avgTotalScore),
        formatScore(row.avgFinalScore),
      ]
        .map(escapeCsvCell)
        .join(",")
    );
  }
  lines.push("");

  lines.push("1배수 핵심 지표(합격예측),,,,,,");
  lines.push("지역,채용유형,참여인원,모집인원(1배수 기준),1배수 컷 점수,실제 1배수 끝등수,1배수 동점 인원");
  for (const row of stats.byRegionPrediction) {
    lines.push(
      [
        row.regionName,
        row.examType === "PUBLIC" ? "공채" : "경행경채",
        row.participantCount,
        row.oneMultipleBaseRank,
        row.oneMultipleCutScore === null ? "-" : row.oneMultipleCutScore.toFixed(2),
        row.oneMultipleActualRank === null ? "-" : row.oneMultipleActualRank,
        row.oneMultipleTieCount === null ? "-" : row.oneMultipleTieCount,
      ]
        .map(escapeCsvCell)
        .join(",")
    );
  }
  lines.push("");

  lines.push("일자별 제출 추이,,");
  lines.push("일자,제출 건수");
  for (const row of stats.submissionsByDate) {
    lines.push([row.date, row.count].map(escapeCsvCell).join(","));
  }
  lines.push("");

  lines.push("점수 분포,,");
  lines.push("점수 구간,인원 수");
  for (const row of stats.scoreDistribution) {
    lines.push([row.label, row.count].map(escapeCsvCell).join(","));
  }
  lines.push("");

  lines.push("체감 난이도,,,,,");
  lines.push("과목,응답수,쉬움(%),보통(%),어려움(%),우세");
  if (stats.difficulty?.subjects?.length) {
    for (const row of stats.difficulty.subjects) {
      const name = row.examType === "CAREER" ? `${row.subjectName}(경행경채)` : row.subjectName;
      lines.push(
        [name, row.responses, row.easy, row.normal, row.hard, row.dominantLabel]
          .map(escapeCsvCell)
          .join(",")
      );
    }
  }

  return lines.join("\r\n");
}

export default function AdminStatsPage() {
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [selectedPredictionExamType, setSelectedPredictionExamType] =
    useState<PredictionExamType>("PUBLIC");
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);

  const recentDateStats = useMemo(() => {
    if (!stats?.submissionsByDate) return [];
    return [...stats.submissionsByDate].slice(-14);
  }, [stats]);

  const availablePredictionExamTypes = useMemo<PredictionExamType[]>(() => {
    const rows = stats?.byRegionPrediction ?? [];
    const hasPublic = rows.some((item) => item.examType === "PUBLIC");
    const hasCareer = rows.some((item) => item.examType === "CAREER");

    const next: PredictionExamType[] = [];
    if (hasPublic) next.push("PUBLIC");
    if (hasCareer) next.push("CAREER");
    return next.length > 0 ? next : ["PUBLIC"];
  }, [stats?.byRegionPrediction]);

  useEffect(() => {
    if (!availablePredictionExamTypes.includes(selectedPredictionExamType)) {
      setSelectedPredictionExamType(availablePredictionExamTypes[0]);
    }
  }, [availablePredictionExamTypes, selectedPredictionExamType]);

  const predictionRowsByExamType = useMemo(
    () =>
      (stats?.byRegionPrediction ?? [])
        .filter((item) => item.examType === selectedPredictionExamType)
        .sort((a, b) => a.regionName.localeCompare(b.regionName, "ko-KR")),
    [selectedPredictionExamType, stats?.byRegionPrediction]
  );

  const loadExamOptions = useCallback(async () => {
    const response = await fetch(ADMIN_EXAM_API, { method: "GET", cache: "no-store" });
    const data = (await response.json()) as { exams?: ExamItem[]; error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? "?쒗뿕 紐⑸줉??遺덈윭?ㅼ? 紐삵뻽?듬땲??");
    }

    const examList = data.exams ?? [];
    setExams(examList);

    setSelectedExamId((current) => {
      if (current || examList.length === 0) {
        return current;
      }
      const activeExam = examList.find((exam) => exam.isActive) ?? examList[0];
      return activeExam.id;
    });
  }, []);

  async function loadStats(examId: number) {
    const response = await fetch(`${STATS_API}?examId=${examId}`, {
      method: "GET",
      cache: "no-store",
    });
    const data = (await response.json()) as StatsResponse & { error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? "?듦퀎 議고쉶???ㅽ뙣?덉뒿?덈떎.");
    }
    setStats(data);
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
          message: error instanceof Error ? error.message : "?쒗뿕 紐⑸줉 議고쉶???ㅽ뙣?덉뒿?덈떎.",
        });
      } finally {
        setIsLoading(false);
      }
    })();
  }, [loadExamOptions]);

  useEffect(() => {
    if (!selectedExamId) return;

    (async () => {
      setIsLoading(true);
      setNotice(null);
      try {
        await loadStats(selectedExamId);
      } catch (error) {
        setNotice({
          type: "error",
          message: error instanceof Error ? error.message : "?듦퀎 議고쉶???ㅽ뙣?덉뒿?덈떎.",
        });
      } finally {
        setIsLoading(false);
      }
    })();
  }, [selectedExamId]);

  function handleDownloadCsv() {
    if (!stats) {
      setNotice({ type: "error", message: "?ㅼ슫濡쒕뱶???듦퀎 ?곗씠?곌? ?놁뒿?덈떎." });
      return;
    }

    setIsDownloadingCsv(true);
    try {
      const csvContent = buildStatsCsvContent(stats);
      const blob = new Blob(["\uFEFF" + csvContent], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const today = new Date();
      const dateText = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(
        today.getDate()
      ).padStart(2, "0")}`;
      const safeExamName = stats.exam.name.replace(/[\\/:*?"<>|]/g, "_");
      anchor.href = url;
      anchor.download = `?⑷꺽?덉륫_?듦퀎_${safeExamName}_${dateText}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setNotice({ type: "success", message: "CSV ?뚯씪 ?ㅼ슫濡쒕뱶媛 ?쒖옉?섏뿀?듬땲??" });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "CSV ?ㅼ슫濡쒕뱶 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.",
      });
    } finally {
      setIsDownloadingCsv(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">李몄뿬 ?듦퀎</h1>
          <p className="mt-1 text-sm text-slate-600">?쒗뿕蹂?李몄뿬 ?꾪솴???좏삎, ?깅퀎, 吏??湲곗??쇰줈 ?뺤씤?⑸땲??</p>
        </div>
        <Button type="button" variant="outline" onClick={handleDownloadCsv} disabled={!stats || isDownloadingCsv}>
          {isDownloadingCsv ? "CSV ?앹꽦 以?.." : "CSV ?ㅼ슫濡쒕뱶"}
        </Button>
      </header>

      <section className="space-y-2">
        <label htmlFor="exam-select" className="text-sm font-medium text-slate-700">
          ?쒗뿕 ?좏깮
        </label>
        <select
          id="exam-select"
          className="h-9 w-full max-w-xl rounded-md border border-slate-300 bg-white px-3 text-sm"
          value={selectedExamId ?? ""}
          onChange={(event) => setSelectedExamId(Number(event.target.value))}
          disabled={isLoading || exams.length === 0}
        >
          {exams.length === 0 ? <option value="">?쒗뿕 ?놁쓬</option> : null}
          {exams.map((exam) => (
            <option key={exam.id} value={exam.id}>
              {exam.year}??{exam.round}李?- {exam.name}
            </option>
          ))}
        </select>
      </section>

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
        <p className="text-sm text-slate-600">?듦퀎瑜?遺덈윭?ㅻ뒗 以묒엯?덈떎...</p>
      ) : !stats ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-600">
          ?쒖떆???듦퀎媛 ?놁뒿?덈떎.
        </p>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">珥?李몄뿬??</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.totalParticipants}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">怨듭콈</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.byExamType.PUBLIC}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">寃쏀뻾寃쎌콈</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.byExamType.CAREER}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">?쒗뿕??</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{formatDate(stats.exam.examDate)}</p>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-slate-900">?쇱옄蹂??쒖텧 異붿씠</h2>
              <div className="mt-3 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={recentDateStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 space-y-1 text-xs text-slate-600">
                {recentDateStats.length === 0 ? (
                  <p>理쒓렐 ?쒖텧 ?곗씠?곌? ?놁뒿?덈떎.</p>
                ) : (
                  recentDateStats.map((item) => (
                    <div key={item.date} className="flex items-center justify-between">
                      <span>{item.date}</span>
                      <span className="font-semibold text-slate-900">{item.count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-slate-900">?먯닔 遺꾪룷 ?덉뒪?좉렇??(理쒖쥌?먯닔 湲곗?)</h2>
              <div className="mt-3 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.scoreDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count">
                      {stats.scoreDistribution.map((item) => (
                        <Cell key={`score-bin-${item.bucket}`} fill={item.isCutoffRange ? "#ef4444" : "#2563eb"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-slate-500">怨쇰씫 援ш컙(100??誘몃쭔)? 鍮④컙?됱쑝濡??쒖떆?⑸땲??</p>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-slate-900">?깅퀎 李몄뿬</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-slate-600">?⑥꽦</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{stats.byGender.MALE}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-slate-600">?ъ꽦</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{stats.byGender.FEMALE}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">吏??퀎 李몄뿬</h2>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-[860px] w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">吏??</th>
                    <th className="px-4 py-3">怨듭콈</th>
                    <th className="px-4 py-3">寃쏀뻾寃쎌콈</th>
                    <th className="px-4 py-3">?⑷퀎</th>
                    <th className="px-4 py-3">?됯퇏 ?먯젏??</th>
                    <th className="px-4 py-3">?됯퇏 理쒖쥌?먯닔</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.byRegion.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-slate-600" colSpan={6}>
                        吏??퀎 ?곗씠?곌? ?놁뒿?덈떎.
                      </td>
                    </tr>
                  ) : (
                    stats.byRegion.map((region) => (
                      <tr key={region.regionId} className="bg-white">
                        <td className="px-4 py-3 font-medium text-slate-900">{region.regionName}</td>
                        <td className="px-4 py-3 text-slate-700">{region.publicCount}</td>
                        <td className="px-4 py-3 text-slate-700">{region.careerCount}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{region.total}</td>
                        <td className="px-4 py-3 text-slate-700">{formatScore(region.avgTotalScore)}</td>
                        <td className="px-4 py-3 text-slate-700">{formatScore(region.avgFinalScore)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-slate-900">지역별 1배수 핵심 지표</h2>
              <div className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-1">
                {availablePredictionExamTypes.map((examType) => {
                  const active = selectedPredictionExamType === examType;
                  return (
                    <button
                      key={examType}
                      type="button"
                      onClick={() => setSelectedPredictionExamType(examType)}
                      className={`rounded px-3 py-1 text-xs font-semibold transition ${
                        active
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {examType === "PUBLIC" ? "공채" : "경행경채"}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-[980px] w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">지역</th>
                    <th className="px-4 py-3">참여인원</th>
                    <th className="px-4 py-3">모집인원(1배수 기준)</th>
                    <th className="px-4 py-3">1배수 컷 점수</th>
                    <th className="px-4 py-3">실제 1배수 끝등수</th>
                    <th className="px-4 py-3">1배수 동점 인원</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {predictionRowsByExamType.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-slate-600" colSpan={6}>
                        1배수 핵심 지표 데이터가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    predictionRowsByExamType.map((row) => (
                      <tr key={`${row.regionId}-${row.examType}`} className="bg-white">
                        <td className="px-4 py-3 font-medium text-slate-900">{row.regionName}</td>
                        <td className="px-4 py-3 text-slate-700">{row.participantCount.toLocaleString("ko-KR")}명</td>
                        <td className="px-4 py-3 text-slate-700">{row.oneMultipleBaseRank.toLocaleString("ko-KR")}등</td>
                        <td className="px-4 py-3 text-slate-700">{formatNullableScore(row.oneMultipleCutScore)}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {row.oneMultipleActualRank === null
                            ? "-"
                            : `${row.oneMultipleActualRank.toLocaleString("ko-KR")}등`}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {row.oneMultipleTieCount === null
                            ? "-"
                            : `${row.oneMultipleTieCount.toLocaleString("ko-KR")}명`}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">
              모집인원이 곧 1배수 기준 등수이며, 실제 끝등수는 동점자 포함 기준입니다.
            </p>
          </section>
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">泥닿컧 ?쒖씠???꾪솴</h2>
            {!stats.difficulty || stats.difficulty.totalResponses < 1 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                ?쒖씠???묐떟 ?곗씠?곌? ?놁뒿?덈떎.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-700">
                  ?꾩껜 ?묐떟:{" "}
                  <span className="font-semibold text-slate-900">
                    {stats.difficulty.totalResponses.toLocaleString("ko-KR")}嫄?                  </span>
                </p>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-[760px] w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">怨쇰ぉ</th>
                        <th className="px-4 py-3">?묐떟??</th>
                        <th className="px-4 py-3">?ъ?</th>
                        <th className="px-4 py-3">蹂댄넻</th>
                        <th className="px-4 py-3">?대젮?</th>
                        <th className="px-4 py-3">???</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stats.difficulty.subjects.length === 0 ? (
                        <tr>
                          <td className="px-4 py-4 text-slate-600" colSpan={6}>
                            怨쇰ぉ蹂??쒖씠???곗씠?곌? ?놁뒿?덈떎.
                          </td>
                        </tr>
                      ) : (
                        stats.difficulty.subjects.map((subject) => (
                          <tr key={subject.subjectId} className="bg-white">
                            <td className="px-4 py-3 font-medium text-slate-900">
                              {subject.subjectName}
                              {subject.examType === "CAREER" ? (
                                <span className="ml-1 text-xs font-medium text-sky-700">(寃쏀뻾寃쎌콈)</span>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-slate-700">{subject.responses}</td>
                            <td className="px-4 py-3 text-slate-700">{subject.easy}%</td>
                            <td className="px-4 py-3 text-slate-700">{subject.normal}%</td>
                            <td className="px-4 py-3 text-slate-700">{subject.hard}%</td>
                            <td className="px-4 py-3 font-semibold text-slate-900">{subject.dominantLabel}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500">
                  ??寃쏀뻾寃쎌콈 怨쇰ぉ(踰붿즲??? 寃쏀뻾寃쎌콈 ?묒떆???묐떟留?吏묎퀎?⑸땲??
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
