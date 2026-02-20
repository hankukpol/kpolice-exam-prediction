import { Clock3, FileCheck2, Users } from "lucide-react";

export interface LandingLiveStats {
  examName: string;
  examYear: number;
  examRound: number;
  totalParticipants: number;
  publicParticipants: number;
  careerParticipants: number;
  recentParticipants: number;
  updatedAt: Date | null;
}

interface LiveStatsCounterProps {
  stats: LandingLiveStats | null;
}

function formatDateTime(date: Date | null): string {
  if (!date) return "집계 데이터 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export default function LiveStatsCounter({ stats }: LiveStatsCounterProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-900">실시간 참여 현황</h2>
        {stats ? <p className="text-xs text-slate-500">최근 갱신: {formatDateTime(stats.updatedAt)}</p> : null}
      </div>

      {stats ? (
        <>
          <p className="mt-2 text-sm text-slate-600">
            {stats.examYear}년 {stats.examRound}차 · {stats.examName}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">전체 참여</p>
                <Users className="h-4 w-4 text-slate-500" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {stats.totalParticipants.toLocaleString("ko-KR")}명
              </p>
            </article>

            <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">공채 참여</p>
                <FileCheck2 className="h-4 w-4 text-slate-500" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {stats.publicParticipants.toLocaleString("ko-KR")}명
              </p>
            </article>

            <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">경행경채 참여</p>
                <FileCheck2 className="h-4 w-4 text-slate-500" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {stats.careerParticipants.toLocaleString("ko-KR")}명
              </p>
            </article>

            <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">최근 1시간 참여</p>
                <Clock3 className="h-4 w-4 text-slate-500" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {stats.recentParticipants.toLocaleString("ko-KR")}명
              </p>
            </article>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          현재 집계 가능한 활성 시험이 없습니다. 관리자 페이지에서 시험 활성 상태를 확인해 주세요.
        </div>
      )}
    </section>
  );
}
