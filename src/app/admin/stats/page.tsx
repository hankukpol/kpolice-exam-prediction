"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
}

interface DateStat {
  date: string;
  count: number;
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
  submissionsByDate: DateStat[];
}

type NoticeState = {
  type: "error";
  message: string;
} | null;

function formatDate(dateText: string): string {
  const parsed = new Date(dateText);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("ko-KR");
}

export default function AdminStatsPage() {
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<NoticeState>(null);

  const recentDateStats = useMemo(() => {
    if (!stats?.submissionsByDate) return [];
    return [...stats.submissionsByDate].slice(-10);
  }, [stats]);

  const loadExamOptions = useCallback(async () => {
    const response = await fetch(ADMIN_EXAM_API, { method: "GET", cache: "no-store" });
    const data = (await response.json()) as { exams?: ExamItem[]; error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? "시험 목록을 불러오지 못했습니다.");
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
      throw new Error(data.error ?? "통계 조회에 실패했습니다.");
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
          message: error instanceof Error ? error.message : "시험 목록 조회에 실패했습니다.",
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
          message: error instanceof Error ? error.message : "통계 조회에 실패했습니다.",
        });
      } finally {
        setIsLoading(false);
      }
    })();
  }, [selectedExamId]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">참여 통계</h1>
        <p className="mt-1 text-sm text-slate-600">시험별 참여 현황을 유형, 성별, 지역 기준으로 확인합니다.</p>
      </header>

      <section className="space-y-2">
        <label htmlFor="exam-select" className="text-sm font-medium text-slate-700">
          시험 선택
        </label>
        <select
          id="exam-select"
          className="h-9 w-full max-w-xl rounded-md border border-slate-300 bg-white px-3 text-sm"
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
      </section>

      {notice ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {notice.message}
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-slate-600">통계를 불러오는 중입니다...</p>
      ) : !stats ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-600">
          표시할 통계가 없습니다.
        </p>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">총 참여자</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.totalParticipants}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">공채</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.byExamType.PUBLIC}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">경행경채</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.byExamType.CAREER}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">시험일</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{formatDate(stats.exam.examDate)}</p>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-slate-900">성별 참여</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-slate-600">남성</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{stats.byGender.MALE}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-slate-600">여성</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{stats.byGender.FEMALE}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-slate-900">최근 일자별 제출</h2>
              <div className="mt-3 space-y-2">
                {recentDateStats.length === 0 ? (
                  <p className="text-sm text-slate-600">최근 제출 데이터가 없습니다.</p>
                ) : (
                  recentDateStats.map((item) => (
                    <div
                      key={item.date}
                      className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                    >
                      <span className="text-slate-700">{item.date}</span>
                      <span className="font-semibold text-slate-900">{item.count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">지역별 참여</h2>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">지역</th>
                    <th className="px-4 py-3">공채</th>
                    <th className="px-4 py-3">경행경채</th>
                    <th className="px-4 py-3">합계</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.byRegion.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-slate-600" colSpan={4}>
                        지역별 데이터가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    stats.byRegion.map((region) => (
                      <tr key={region.regionId} className="bg-white">
                        <td className="px-4 py-3 font-medium text-slate-900">{region.regionName}</td>
                        <td className="px-4 py-3 text-slate-700">{region.publicCount}</td>
                        <td className="px-4 py-3 text-slate-700">{region.careerCount}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{region.total}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
