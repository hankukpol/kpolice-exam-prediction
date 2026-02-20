import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeroFallbackProps {
  badge: string;
  title: string;
  subtitle: string;
  isLoggedIn: boolean;
}

export default function HeroFallback({ badge, title, subtitle, isLoggedIn }: HeroFallbackProps) {
  const primaryHref = isLoggedIn ? "#exam-functions" : "/login";
  const primaryText = isLoggedIn ? "응시정보 입력하기" : "로그인 후 시작";

  return (
    <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-6 text-white shadow-lg sm:p-10">
      <p className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium">
        {badge}
      </p>
      <h1 className="mt-4 whitespace-pre-line text-2xl font-bold leading-tight sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-2xl text-sm text-slate-200 sm:text-base">{subtitle}</p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={primaryHref}>
          <Button className="bg-white text-slate-900 hover:bg-slate-100">
            {primaryText}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
        {isLoggedIn ? (
          <Link href="/exam/input">
            <Button variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">
              개별 화면으로 이동
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
  );
}
