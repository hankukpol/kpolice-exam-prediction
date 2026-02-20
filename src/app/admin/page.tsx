import Link from "next/link";
import DashboardSubmissionTrendChart from "@/components/admin/DashboardSubmissionTrendChart";
import { prisma } from "@/lib/prisma";

const statCardStyles = [
  { bg: "bg-white border border-slate-200", text: "text-slate-900", sub: "text-slate-500", label: "text-police-600" },
  { bg: "bg-white border border-slate-200", text: "text-slate-900", sub: "text-slate-500", label: "text-cyan-600" },
  { bg: "bg-white border border-slate-200", text: "text-slate-900", sub: "text-slate-500", label: "text-amber-600" },
  { bg: "bg-white border border-slate-200", text: "text-slate-900", sub: "text-slate-500", label: "text-rose-600" },
];

const quickActions = [
  {
    href: "/admin/exams",
    num: "1",
    title: "시험 생성/활성화",
    desc: "신규 시험을 만들고 운영 대상 시험을 활성화합니다.",
    color: "text-police-600",
    hoverBg: "hover:border-police-300",
  },
  {
    href: "/admin/answers",
    num: "2",
    title: "정답 입력/저장",
    desc: "OMR 입력 또는 CSV 업로드로 정답을 반영합니다.",
    color: "text-cyan-600",
    hoverBg: "hover:border-cyan-300",
  },
  {
    href: "/admin/stats",
    num: "3",
    title: "참여 통계 확인",
    desc: "유형/성별/지역 참여 수를 확인합니다.",
    color: "text-amber-600",
    hoverBg: "hover:border-amber-300",
  },
  {
    href: "/admin/regions",
    num: "4",
    title: "모집인원 관리",
    desc: "지역별 공채/경행경채 선발인원을 운영합니다.",
    color: "text-emerald-600",
    hoverBg: "hover:border-emerald-300",
  },
  {
    href: "/admin/site",
    num: "5",
    title: "사이트 설정",
    desc: "메인 문구, 공지사항, 점검 모드를 관리합니다.",
    color: "text-violet-600",
    hoverBg: "hover:border-violet-300",
  },
  {
    href: "/admin/banners",
    num: "6",
    title: "배너 관리",
    desc: "배너 이미지를 업로드하고 표시를 설정합니다.",
    color: "text-pink-600",
    hoverBg: "hover:border-pink-300",
  },
  {
    href: "/admin/events",
    num: "7",
    title: "이벤트 관리",
    desc: "이벤트 섹션 카드와 표시 순서를 운영합니다.",
    color: "text-teal-600",
    hoverBg: "hover:border-teal-300",
  },
  {
    href: "/admin/users",
    num: "8",
    title: "사용자 관리",
    desc: "권한 조정, 비밀번호 초기화, 계정 삭제를 수행합니다.",
    color: "text-indigo-600",
    hoverBg: "hover:border-indigo-300",
  },
  {
    href: "/admin/comments",
    num: "9",
    title: "댓글 관리",
    desc: "부적절 댓글을 개별 또는 일괄 삭제합니다.",
    color: "text-orange-600",
    hoverBg: "hover:border-orange-300",
  },
  {
    href: "/admin/submissions",
    num: "10",
    title: "제출 현황",
    desc: "제출 내역 상세와 답안 정보를 조회합니다.",
    color: "text-slate-600",
    hoverBg: "hover:border-slate-400",
  },
];

export default async function AdminDashboardPage() {
  let activeExam: { id: number; year: number; round: number; name: string } | null = null;
  let totalExams = 0;
  let totalSubmissions = 0;
  let totalAnswerKeys = 0;
  let totalUsers = 0;
  let regionsWithoutCareerRecruitCount = 0;
  let activeExamAnswerKeyCount = 0;
  let submissionTrend: Array<{ date: string; count: number }> = [];
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

      const trendRaw = await prisma.$queryRaw<Array<{ date: string; count: bigint | number }>>`
        SELECT DATE_FORMAT(createdAt, '%Y-%m-%d') AS date, COUNT(*) AS count
        FROM Submission
        WHERE examId = ${dbActiveExam.id}
        GROUP BY DATE(createdAt)
        ORDER BY DATE(createdAt)
      `;

      submissionTrend = trendRaw
        .map((item) => ({
          date: item.date,
          count: typeof item.count === "bigint" ? Number(item.count) : Number(item.count),
        }))
        .filter((item) => Number.isFinite(item.count))
        .slice(-10);
    }
  } catch (error) {
    console.error("관리자 대시보드 통계 조회 중 오류가 발생했습니다.", error);
    hasStatsError = true;
  }

  const stats = [
    {
      label: "활성 시험",
      value: activeExam ? `${activeExam.year}년 ${activeExam.round}차` : "없음",
      sub: activeExam?.name ?? "활성화된 시험 없음",
    },
    { label: "등록 시험 수", value: String(totalExams), sub: "전체 시험" },
    { label: "정답키 문항 수", value: String(totalAnswerKeys), sub: "등록 문항" },
    { label: "총 제출 수", value: totalSubmissions.toLocaleString(), sub: `회원 수: ${totalUsers.toLocaleString()}` },
  ];

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <header>
        <h1 className="text-xl font-bold text-slate-900">관리자 대시보드</h1>
        <p className="mt-1 text-sm text-slate-500">
          시험 생성, 정답 입력, 전체 재채점까지 한 흐름으로 운영할 수 있습니다.
        </p>
      </header>

      {/* 경고 알림 */}
      {hasStatsError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          통계 데이터를 불러오지 못했습니다. 데이터베이스 연결 상태를 확인해 주세요.
        </div>
      ) : null}

      {!hasStatsError && regionsWithoutCareerRecruitCount > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          경행경채 모집인원이 0으로 설정된 지역이 {regionsWithoutCareerRecruitCount}개 있습니다.{" "}
          <Link href="/admin/regions" className="font-semibold underline">
            모집인원 관리
          </Link>
          에서 확인해 주세요.
        </div>
      ) : null}

      {!hasStatsError && activeExam && activeExamAnswerKeyCount < 1 ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          활성 시험에 등록된 정답키가 없습니다.{" "}
          <Link href="/admin/answers" className="font-semibold underline">
            정답 관리
          </Link>
          에서 정답키를 등록해 주세요.
        </div>
      ) : null}

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat, index) => {
          const style = statCardStyles[index];
          return (
            <div
              key={stat.label}
              className={`rounded-2xl p-5 shadow-sm transition hover:shadow-md ${style.bg}`}
            >
              <p className={`text-xs font-bold uppercase tracking-wider ${style.label ?? style.sub}`}>
                {stat.label}
              </p>
              <p className={`mt-2 text-3xl font-black tracking-tight ${style.text}`}>
                {stat.value}
              </p>
              <p className={`mt-1 text-xs font-medium ${style.sub}`}>
                {stat.sub}
              </p>
            </div>
          );
        })}
      </div>

      {/* 차트 영역 */}
      {!hasStatsError ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          {/* 메인 차트 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">최근 제출 추이</h2>
              <span className="rounded-full bg-police-50 px-3 py-1 text-xs font-medium text-police-600">
                최근 10일
              </span>
            </div>
            <DashboardSubmissionTrendChart data={submissionTrend} />
          </div>

          {/* 우측 요약 */}
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">참여 요약</h3>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">총 제출</span>
                  <span className="text-sm font-bold text-slate-900">{totalSubmissions.toLocaleString()}</span>
                </div>
                <div className="h-px bg-slate-100" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">회원 수</span>
                  <span className="text-sm font-bold text-slate-900">{totalUsers.toLocaleString()}</span>
                </div>
                <div className="h-px bg-slate-100" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">정답키</span>
                  <span className="text-sm font-bold text-slate-900">{totalAnswerKeys}</span>
                </div>
                <div className="h-px bg-slate-100" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">시험 수</span>
                  <span className="text-sm font-bold text-slate-900">{totalExams}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">활성 시험</h3>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {activeExam ? `${activeExam.year}년 ${activeExam.round}차` : "-"}
              </p>
              <p className="mt-1 text-xs text-slate-500">{activeExam?.name ?? "활성화된 시험 없음"}</p>
              {activeExam ? (
                <Link
                  href="/admin/exams"
                  className="mt-3 inline-block rounded-lg bg-police-50 px-3 py-1.5 text-xs font-medium text-police-600 transition hover:bg-police-100"
                >
                  시험 관리
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* 빠른 실행 */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-800">빠른 실행</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md ${action.hoverBg}`}
            >
              <div className="flex items-center gap-2">
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold ${action.color} transition group-hover:bg-slate-200`}>
                  {action.num}
                </span>
                <p className="text-sm font-semibold text-slate-800">{action.title}</p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{action.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
