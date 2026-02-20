import { Clock3, ShieldCheck, Users } from "lucide-react";

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
  if (!stats) {
    return (
      <section className="rounded-[26px] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900">
        현재 집계 가능한 활성 시험이 없습니다. 관리자 페이지에서 시험 활성 상태를 확인해 주세요.
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-[26px] border border-slate-900 bg-slate-950 p-6 text-white sm:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(255,110,80,0.35),transparent_40%),radial-gradient(circle_at_90%_10%,rgba(230,30,30,0.35),transparent_30%)]" />
      <div className="relative">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight text-white">합격예측 실시간 참여 현황</h2>
            <p className="mt-1 text-sm text-white/80">
              {stats.examYear}년 {stats.examRound}차 · {stats.examName}
            </p>
          </div>
          <p className="text-xs text-white/70">최근 갱신: {formatDateTime(stats.updatedAt)}</p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/75">전체 참여</p>
              <Users className="h-4 w-4 text-white/70" />
            </div>
            <p className="mt-2 text-2xl font-black">{stats.totalParticipants.toLocaleString("ko-KR")}명</p>
          </article>

          <article className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/75">공채 참여</p>
              <ShieldCheck className="h-4 w-4 text-white/70" />
            </div>
            <p className="mt-2 text-2xl font-black">{stats.publicParticipants.toLocaleString("ko-KR")}명</p>
          </article>

          <article className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/75">경행경채 참여</p>
              <ShieldCheck className="h-4 w-4 text-white/70" />
            </div>
            <p className="mt-2 text-2xl font-black">{stats.careerParticipants.toLocaleString("ko-KR")}명</p>
          </article>

          <article className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/75">최근 1시간</p>
              <Clock3 className="h-4 w-4 text-white/70" />
            </div>
            <p className="mt-2 text-2xl font-black">{stats.recentParticipants.toLocaleString("ko-KR")}명</p>
          </article>
        </div>
      </div>
    </section>
  );
}
