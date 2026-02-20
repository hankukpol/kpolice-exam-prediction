import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminDashboardPage() {
  let activeExam: { year: number; round: number; name: string } | null = null;
  let totalExams = 0;
  let totalSubmissions = 0;
  let totalAnswerKeys = 0;
  let totalUsers = 0;
  let hasStatsError = false;

  try {
    const [dbActiveExam, dbTotalExams, dbTotalSubmissions, dbTotalAnswerKeys, dbTotalUsers] =
      await prisma.$transaction([
        prisma.exam.findFirst({
          where: { isActive: true },
          orderBy: [{ examDate: "desc" }, { id: "desc" }],
          select: {
            year: true,
            round: true,
            name: true,
          },
        }),
        prisma.exam.count(),
        prisma.submission.count(),
        prisma.answerKey.count(),
        prisma.user.count(),
      ]);

    activeExam = dbActiveExam;
    totalExams = dbTotalExams;
    totalSubmissions = dbTotalSubmissions;
    totalAnswerKeys = dbTotalAnswerKeys;
    totalUsers = dbTotalUsers;
  } catch (error) {
    console.error("관리자 대시보드 통계 조회 중 오류가 발생했습니다.", error);
    hasStatsError = true;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">관리자 대시보드</h1>
        <p className="mt-2 text-sm text-slate-600">
          관리자 로그인 후 시험 생성, 정답 입력, 전체 재채점까지 한 흐름으로 운영할 수 있습니다.
        </p>
      </header>

      {hasStatsError ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          통계 데이터를 불러오지 못했습니다. 데이터베이스 연결 상태를 확인해 주세요.
        </section>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">활성 시험</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {activeExam ? `${activeExam.year}년 ${activeExam.round}차` : "없음"}
          </p>
          <p className="mt-1 text-sm text-slate-600">{activeExam?.name ?? "활성화된 시험이 없습니다."}</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">등록 시험 수</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{totalExams}</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">정답키 문항 수</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{totalAnswerKeys}</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">총 제출 수</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{totalSubmissions}</p>
          <p className="mt-1 text-xs text-slate-500">회원 수: {totalUsers}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/admin/exams"
          className="rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
        >
          <p className="text-sm font-semibold text-slate-900">1. 시험 생성/활성화</p>
          <p className="mt-1 text-sm text-slate-600">신규 시험을 만들고 운영 대상 시험을 활성화합니다.</p>
        </Link>

        <Link
          href="/admin/answers"
          className="rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
        >
          <p className="text-sm font-semibold text-slate-900">2. 정답 입력/저장</p>
          <p className="mt-1 text-sm text-slate-600">
            OMR 입력 그리드 또는 CSV 업로드로 정답을 반영하고 재채점을 실행합니다.
          </p>
        </Link>

        <Link
          href="/admin/stats"
          className="rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
        >
          <p className="text-sm font-semibold text-slate-900">3. 참여 통계 확인</p>
          <p className="mt-1 text-sm text-slate-600">
            유형/성별/지역 참여 수를 확인하고 운영 현황을 점검합니다.
          </p>
        </Link>
      </div>
    </div>
  );
}
