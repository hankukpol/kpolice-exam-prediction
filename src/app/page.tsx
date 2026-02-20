import Link from "next/link";
import { ExamType } from "@prisma/client";
import { getServerSession } from "next-auth";
import { ArrowRight, Clock3, FileCheck2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveNotices, getSiteSettings } from "@/lib/site-settings";

interface LiveStats {
  examName: string;
  examYear: number;
  examRound: number;
  totalParticipants: number;
  publicParticipants: number;
  careerParticipants: number;
  recentParticipants: number;
  updatedAt: Date | null;
}

async function getLiveStats(): Promise<LiveStats | null> {
  try {
    const activeExam = await prisma.exam.findFirst({
      where: { isActive: true },
      orderBy: [{ examDate: "desc" }, { id: "desc" }],
      select: {
        id: true,
        name: true,
        year: true,
        round: true,
      },
    });

    if (!activeExam) {
      return null;
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [totalParticipants, examTypeStats, recentParticipants, latestSubmission] = await Promise.all([
      prisma.submission.count({
        where: { examId: activeExam.id },
      }),
      prisma.submission.groupBy({
        by: ["examType"],
        where: { examId: activeExam.id },
        _count: {
          _all: true,
        },
      }),
      prisma.submission.count({
        where: {
          examId: activeExam.id,
          createdAt: { gte: oneHourAgo },
        },
      }),
      prisma.submission.findFirst({
        where: { examId: activeExam.id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    const publicParticipants =
      examTypeStats.find((item) => item.examType === ExamType.PUBLIC)?._count._all ?? 0;
    const careerParticipants =
      examTypeStats.find((item) => item.examType === ExamType.CAREER)?._count._all ?? 0;

    return {
      examName: activeExam.name,
      examYear: activeExam.year,
      examRound: activeExam.round,
      totalParticipants,
      publicParticipants,
      careerParticipants,
      recentParticipants,
      updatedAt: latestSubmission?.createdAt ?? null,
    };
  } catch (error) {
    console.error("실시간 참여 현황 조회 중 오류가 발생했습니다.", error);
    return null;
  }
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

export default async function HomePage() {
  const [session, liveStats, siteSettings, activeNotices] = await Promise.all([
    getServerSession(authOptions),
    getLiveStats(),
    getSiteSettings(),
    getActiveNotices(),
  ]);
  const primaryCtaHref = session?.user ? "/exam/input" : "/login";
  const primaryCtaText = session?.user ? "시작하기" : "로그인하고 시작";
  const heroBadge = String(siteSettings["site.heroBadge"] ?? "2026년 경찰 1차 필기시험 합격예측");
  const heroTitle = String(
    siteSettings["site.heroTitle"] ?? "OMR 입력부터 합격권 예측까지\n한 번에 확인하세요."
  );
  const heroSubtitle = String(
    siteSettings["site.heroSubtitle"] ??
      "응시정보와 OMR 답안을 입력하면 과목별 분석, 석차, 배수 위치, 합격권 등급을 실시간으로 제공합니다."
  );
  const bannerImageUrl = (siteSettings["site.bannerImageUrl"] as string | null) ?? null;
  const bannerLink = (siteSettings["site.bannerLink"] as string | null) ?? null;
  const hasActiveNotices = activeNotices.length > 0;
  const isExternalBannerLink = bannerLink?.startsWith("http://") || bannerLink?.startsWith("https://");

  return (
    <main className="py-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4">
        <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-6 text-white shadow-lg sm:p-10">
          <p className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium">
            {heroBadge}
          </p>
          <h1 className="mt-4 whitespace-pre-line text-2xl font-bold leading-tight sm:text-4xl">{heroTitle}</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-200 sm:text-base">
            {heroSubtitle}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={primaryCtaHref}>
              <Button className="bg-white text-slate-900 hover:bg-slate-100">
                {primaryCtaText}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            {session?.user ? (
              <Link href="/exam/result">
                <Button variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">
                  내 성적 분석
                </Button>
              </Link>
            ) : (
              <Link href="/register">
                <Button variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">
                  회원가입
                </Button>
              </Link>
            )}
          </div>
        </section>

        {hasActiveNotices ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
            <h2 className="text-base font-semibold text-amber-900">공지사항</h2>
            <ul className="mt-3 space-y-3">
              {activeNotices.map((notice) => (
                <li key={notice.id} className="rounded-lg border border-amber-200 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-900">{notice.title}</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{notice.content}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {bannerImageUrl ? (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
            {bannerLink ? (
              <a
                href={bannerLink}
                target={isExternalBannerLink ? "_blank" : undefined}
                rel={isExternalBannerLink ? "noreferrer noopener" : undefined}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bannerImageUrl}
                  alt="안내 배너"
                  className="h-auto w-full rounded-xl border border-slate-100 object-cover"
                />
              </a>
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bannerImageUrl}
                  alt="안내 배너"
                  className="h-auto w-full rounded-xl border border-slate-100 object-cover"
                />
              </>
            )}
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-900">실시간 참여 현황</h2>
            {liveStats ? (
              <p className="text-xs text-slate-500">최근 갱신: {formatDateTime(liveStats.updatedAt)}</p>
            ) : null}
          </div>

          {liveStats ? (
            <>
              <p className="mt-2 text-sm text-slate-600">
                {liveStats.examYear}년 {liveStats.examRound}차 · {liveStats.examName}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">전체 참여자</p>
                    <Users className="h-4 w-4 text-slate-500" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {liveStats.totalParticipants.toLocaleString("ko-KR")}명
                  </p>
                </article>

                <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">공채 참여</p>
                    <FileCheck2 className="h-4 w-4 text-slate-500" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {liveStats.publicParticipants.toLocaleString("ko-KR")}명
                  </p>
                </article>

                <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">경행경채 참여</p>
                    <FileCheck2 className="h-4 w-4 text-slate-500" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {liveStats.careerParticipants.toLocaleString("ko-KR")}명
                  </p>
                </article>

                <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">최근 1시간 참여</p>
                    <Clock3 className="h-4 w-4 text-slate-500" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {liveStats.recentParticipants.toLocaleString("ko-KR")}명
                  </p>
                </article>
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              현재 집계 가능한 활성 시험이 없습니다. 관리자 페이지에서 시험 활성화 상태를 확인해 주세요.
            </div>
          )}
        </section>

        <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-3 sm:p-6">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-500">STEP 1</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">응시정보/OMR 입력</p>
            <p className="mt-1 text-xs text-slate-600">공채/경행경채, 지역, 가산점, 답안을 입력합니다.</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-500">STEP 2</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">자동 채점/성적 분석</p>
            <p className="mt-1 text-xs text-slate-600">과목별 점수, 백분위, 과락 여부를 즉시 확인합니다.</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-500">STEP 3</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">합격권/경쟁자 분석</p>
            <p className="mt-1 text-xs text-slate-600">현재 석차와 예측 등급으로 합격 가능성을 판단합니다.</p>
          </div>
        </section>

        {session?.user ? (
          <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-medium">{session.user.name}님, 로그인 상태입니다.</p>
            <p className="mt-1">지금 바로 답안을 제출하고 합격예측 결과를 확인해 보세요.</p>
          </section>
        ) : (
          <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            회원가입 또는 로그인 후 시험 정보를 입력하면 전체 기능을 사용할 수 있습니다.
            <div className="mt-3 flex gap-2">
              <Link href="/login">
                <Button size="sm">로그인</Button>
              </Link>
              <Link href="/register">
                <Button size="sm" variant="outline">
                  회원가입
                </Button>
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
