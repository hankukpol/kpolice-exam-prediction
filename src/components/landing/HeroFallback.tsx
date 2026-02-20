import Link from "next/link";
import { ArrowRight, Sparkles, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeroFallbackProps {
  badge: string;
  title: string;
  subtitle: string;
  isLoggedIn: boolean;
}

export default function HeroFallback({ badge, title, subtitle, isLoggedIn }: HeroFallbackProps) {
  const primaryHref = isLoggedIn ? "/exam/main" : "/login";
  const primaryText = isLoggedIn ? "풀서비스 시작하기" : "로그인 후 시작";

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-black/60 bg-black text-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(255,120,80,0.45),transparent_40%),radial-gradient(circle_at_85%_10%,rgba(255,190,120,0.2),transparent_35%),linear-gradient(175deg,#2f0000_0%,#7a0000_28%,#d81616_62%,#060606_100%)]" />
      <div className="pointer-events-none absolute -bottom-28 left-1/2 h-72 w-[120%] -translate-x-1/2 rounded-full bg-black/70 blur-3xl" />

      <div className="relative grid gap-6 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[1.25fr_0.75fr] lg:gap-8">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-white/95">
            <Sparkles className="h-3.5 w-3.5" />
            {badge}
          </p>
          <h1 className="mt-4 whitespace-pre-line text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-white/85 sm:text-base">
            {subtitle}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={primaryHref}>
              <Button className="h-11 rounded-full bg-white px-6 text-sm font-bold text-black hover:bg-white/90">
                {primaryText}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
            <Link href={isLoggedIn ? "/exam/input" : "/register"}>
              <Button
                variant="outline"
                className="h-11 rounded-full border-white/50 bg-white/10 px-6 text-sm font-semibold text-white hover:bg-white/20"
              >
                {isLoggedIn ? "빠른 채점 바로가기" : "회원가입"}
              </Button>
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-white/20 bg-black/35 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white/90">서비스 운영 안내</p>
            <Timer className="h-4 w-4 text-white/80" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <article className="rounded-xl border border-white/15 bg-white/10 p-3">
              <p className="text-xs text-white/70">모드</p>
              <p className="mt-1 text-base font-bold">실시간</p>
            </article>
            <article className="rounded-xl border border-white/15 bg-white/10 p-3">
              <p className="text-xs text-white/70">분석</p>
              <p className="mt-1 text-base font-bold">합격예측</p>
            </article>
            <article className="rounded-xl border border-white/15 bg-white/10 p-3">
              <p className="text-xs text-white/70">지원</p>
              <p className="mt-1 text-base font-bold">모바일/PC</p>
            </article>
            <article className="rounded-xl border border-white/15 bg-white/10 p-3">
              <p className="text-xs text-white/70">업데이트</p>
              <p className="mt-1 text-base font-bold">자동 반영</p>
            </article>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-white/75">
            답안을 입력하면 채점결과, 석차, 지역별 경쟁 분석까지 한 번에 확인할 수 있습니다.
          </p>
        </div>
      </div>
    </section>
  );
}
