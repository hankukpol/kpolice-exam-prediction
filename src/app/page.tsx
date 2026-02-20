import { ExamType } from "@prisma/client";
import { getServerSession } from "next-auth";
import BannerImage from "@/components/landing/BannerImage";
import DifficultyPanel from "@/components/landing/DifficultyPanel";
import EventCard from "@/components/landing/EventCard";
import ExamFunctionArea from "@/components/landing/ExamFunctionArea";
import HeroFallback from "@/components/landing/HeroFallback";
import LiveStatsCounter, { type LandingLiveStats } from "@/components/landing/LiveStatsCounter";
import NoticeBar from "@/components/landing/NoticeBar";
import { authOptions } from "@/lib/auth";
import { getActiveBanners, getPrimaryBannerByZone } from "@/lib/banners";
import { getDifficultyStats } from "@/lib/difficulty";
import { getActiveEvents } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { getActiveNotices, getSiteSettings } from "@/lib/site-settings";

async function getLiveStats(): Promise<LandingLiveStats | null> {
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

async function getHasSubmission(userId: number): Promise<boolean> {
  const activeExam = await prisma.exam.findFirst({
    where: { isActive: true },
    orderBy: [{ examDate: "desc" }, { id: "desc" }],
    select: { id: true },
  });

  const submissionCount = await prisma.submission.count({
    where: activeExam
      ? {
          userId,
          examId: activeExam.id,
        }
      : {
          userId,
        },
  });

  return submissionCount > 0;
}

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const userId = Number(session?.user?.id ?? 0);
  const isLoggedIn = Boolean(session?.user && Number.isInteger(userId) && userId > 0);

  const [liveStats, siteSettings, activeNotices, activeBanners, activeEvents, difficultyStats, hasSubmission] =
    await Promise.all([
      getLiveStats(),
      getSiteSettings(),
      getActiveNotices(),
      getActiveBanners(),
      getActiveEvents(),
      getDifficultyStats(),
      isLoggedIn ? getHasSubmission(userId) : Promise.resolve(false),
    ]);

  const bannerByZone = getPrimaryBannerByZone(activeBanners);
  const heroBadge = String(siteSettings["site.heroBadge"] ?? "2026년 경찰 1차 필기시험 합격예측");
  const heroTitle = String(
    siteSettings["site.heroTitle"] ?? "OMR 입력부터 합격권 예측까지\n한 번에 확인하세요."
  );
  const heroSubtitle = String(
    siteSettings["site.heroSubtitle"] ??
      "응시정보와 OMR 답안을 입력하면 과목별 분석, 석차, 배수 위치, 합격권 등급을 실시간으로 제공합니다."
  );

  return (
    <main className="py-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4">
        {bannerByZone.hero ? (
          <BannerImage banner={bannerByZone.hero} />
        ) : (
          <HeroFallback
            badge={heroBadge}
            title={heroTitle}
            subtitle={heroSubtitle}
            isLoggedIn={isLoggedIn}
          />
        )}

        <LiveStatsCounter stats={liveStats} />

        {difficultyStats && difficultyStats.totalResponses > 0 ? (
          <DifficultyPanel difficulty={difficultyStats} />
        ) : null}

        <NoticeBar notices={activeNotices} />

        <ExamFunctionArea isAuthenticated={isLoggedIn} hasSubmission={hasSubmission} />

        {bannerByZone.middle ? <BannerImage banner={bannerByZone.middle} /> : null}
        {activeEvents.length > 0
          ? activeEvents.map((event) => <EventCard key={event.id} event={event} />)
          : null}
        {bannerByZone.bottom ? <BannerImage banner={bannerByZone.bottom} /> : null}
      </div>
    </main>
  );
}
