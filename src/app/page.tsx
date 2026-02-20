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
import { getActiveBanners, groupBannersByZone } from "@/lib/banners";
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

  const bannersByZone = groupBannersByZone(activeBanners);
  const heroBanner = bannersByZone.hero[0] ?? null;
  const heroSubBanners = bannersByZone.hero.slice(1);
  const heroBadge = String(siteSettings["site.heroBadge"] ?? "2026년 경찰 1차 필기시험 합격예측");
  const heroTitle = String(
    siteSettings["site.heroTitle"] ?? "OMR 입력부터 합격권 예측까지\n한 번에 확인하세요."
  );
  const heroSubtitle = String(
    siteSettings["site.heroSubtitle"] ??
      "응시정보와 OMR 답안을 입력하면 과목별 분석, 석차, 배수 위치, 합격권 등급을 실시간으로 제공합니다."
  );

  return (
    <main className="pb-16">
      <section className="relative overflow-hidden bg-[linear-gradient(180deg,#090909_0%,#8a0000_45%,#d90b0b_72%,#f3f4f6_100%)] pb-10 pt-8 sm:pt-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4">
          {heroBanner ? (
            <BannerImage
              banner={heroBanner}
              className="h-auto w-full rounded-[30px] border border-black/20 object-cover shadow-[0_24px_70px_-22px_rgba(0,0,0,0.85)]"
            />
          ) : (
            <HeroFallback
              badge={heroBadge}
              title={heroTitle}
              subtitle={heroSubtitle}
              isLoggedIn={isLoggedIn}
            />
          )}

          {heroSubBanners.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {heroSubBanners.map((banner) => (
                <BannerImage
                  key={`hero-sub-${banner.id}`}
                  banner={banner}
                  className="h-auto w-full rounded-2xl border border-black/15 object-cover shadow-sm"
                />
              ))}
            </div>
          ) : null}

          <LiveStatsCounter stats={liveStats} />
          <NoticeBar notices={activeNotices} />
          <ExamFunctionArea isAuthenticated={isLoggedIn} hasSubmission={hasSubmission} />
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 pt-8">
        {difficultyStats && difficultyStats.totalResponses > 0 ? (
          <DifficultyPanel difficulty={difficultyStats} />
        ) : null}

        {bannersByZone.middle.length > 0 ? (
          <div className="space-y-4">
            {bannersByZone.middle.map((banner) => (
              <BannerImage key={`middle-${banner.id}`} banner={banner} />
            ))}
          </div>
        ) : null}

        {activeEvents.length > 0 ? activeEvents.map((event) => <EventCard key={event.id} event={event} />) : null}

        {bannersByZone.bottom.length > 0 ? (
          <div className="space-y-4">
            {bannersByZone.bottom.map((banner) => (
              <BannerImage key={`bottom-${banner.id}`} banner={banner} />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
