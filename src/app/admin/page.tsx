import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminDashboardPage() {
  let activeExam: { id: number; year: number; round: number; name: string } | null = null;
  let totalExams = 0;
  let totalSubmissions = 0;
  let totalAnswerKeys = 0;
  let totalUsers = 0;
  let regionsWithoutCareerRecruitCount = 0;
  let activeExamAnswerKeyCount = 0;
  let hasStatsError = false;

  try {
    const [
      dbActiveExam,
      dbTotalExams,
      dbTotalSubmissions,
      dbTotalAnswerKeys,
      dbTotalUsers,
      dbRegionsWithoutCareerRecruitCount,
    ] =
      await prisma.$transaction([
        prisma.exam.findFirst({
          where: { isActive: true },
          orderBy: [{ examDate: "desc" }, { id: "desc" }],
          select: {
            id: true,
            year: true,
            round: true,
            name: true,
          },
        }),
        prisma.exam.count(),
        prisma.submission.count(),
        prisma.answerKey.count(),
        prisma.user.count(),
        prisma.region.count({
          where: {
            recruitCountCareer: {
              lte: 0,
            },
          },
        }),
      ]);

    activeExam = dbActiveExam;
    totalExams = dbTotalExams;
    totalSubmissions = dbTotalSubmissions;
    totalAnswerKeys = dbTotalAnswerKeys;
    totalUsers = dbTotalUsers;
    regionsWithoutCareerRecruitCount = dbRegionsWithoutCareerRecruitCount;

    if (dbActiveExam) {
      activeExamAnswerKeyCount = await prisma.answerKey.count({
        where: {
          examId: dbActiveExam.id,
        },
      });
    }
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

      {!hasStatsError && regionsWithoutCareerRecruitCount > 0 ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          경행경채 모집인원이 0으로 설정된 지역이 {regionsWithoutCareerRecruitCount}개 있습니다.{" "}
          <Link href="/admin/regions" className="font-semibold underline">
            모집인원 관리
          </Link>
          에서 확인해 주세요.
        </section>
      ) : null}

      {!hasStatsError && activeExam && activeExamAnswerKeyCount < 1 ? (
        <section className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          활성 시험에 등록된 정답키가 없습니다.{" "}
          <Link href="/admin/answers" className="font-semibold underline">
            정답 관리
          </Link>
          에서 정답키를 등록해 주세요.
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

        <Link
          href="/admin/regions"
          className="rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
        >
          <p className="text-sm font-semibold text-slate-900">4. 모집인원 관리</p>
          <p className="mt-1 text-sm text-slate-600">지역별 공채/경행경채 선발인원을 운영합니다.</p>
        </Link>

        <Link
          href="/admin/site"
          className="rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
        >
          <p className="text-sm font-semibold text-slate-900">5. 사이트 관리</p>
          <p className="mt-1 text-sm text-slate-600">메인 문구, 배너, 공지사항, 점검 모드를 관리합니다.</p>
        </Link>

        <Link
          href="/admin/users"
          className="rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
        >
          <p className="text-sm font-semibold text-slate-900">6. 사용자 관리</p>
          <p className="mt-1 text-sm text-slate-600">권한 조정, 비밀번호 초기화, 계정 삭제를 수행합니다.</p>
        </Link>

        <Link
          href="/admin/comments"
          className="rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
        >
          <p className="text-sm font-semibold text-slate-900">7. 댓글 관리</p>
          <p className="mt-1 text-sm text-slate-600">부적절 댓글을 개별 또는 일괄 삭제합니다.</p>
        </Link>

        <Link
          href="/admin/submissions"
          className="rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
        >
          <p className="text-sm font-semibold text-slate-900">8. 제출 현황</p>
          <p className="mt-1 text-sm text-slate-600">제출 내역 상세와 답안 정보를 조회합니다.</p>
        </Link>
      </div>
    </div>
  );
}
