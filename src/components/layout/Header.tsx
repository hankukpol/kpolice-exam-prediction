"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

interface SiteSettingsResponse {
  settings?: {
    "site.title"?: string;
  };
}

export default function Header() {
  const { data: session, status } = useSession();
  const [siteTitle, setSiteTitle] = useState("경찰 필기 합격예측");

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/site-settings", { method: "GET", cache: "no-store" });
        const data = (await response.json()) as SiteSettingsResponse;
        const title = data.settings?.["site.title"];
        if (typeof title === "string" && title.trim()) {
          setSiteTitle(title);
        }
      } catch {
        // 헤더는 기본값으로 안전하게 표시
      }
    })();
  }, []);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 py-2">
        <Link href="/" className="text-base font-semibold text-slate-900 sm:text-lg">
          {siteTitle}
        </Link>

        {status === "loading" ? (
          <p className="text-sm text-slate-500">세션 확인 중...</p>
        ) : session?.user ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right text-sm leading-tight text-slate-700 sm:block">
              <p className="font-medium">{session.user.name}</p>
              <p>{session.user.phone}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              로그아웃
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link href="/login">
              <Button size="sm">로그인</Button>
            </Link>
            <Link href="/register">
              <Button size="sm" variant="outline">
                회원가입
              </Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
