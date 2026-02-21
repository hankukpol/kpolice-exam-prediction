"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface ExamTabNavigationProps {
  hasSubmission: boolean;
  finalPredictionEnabled?: boolean;
}

interface TabItem {
  href: string;
  label: string;
  disabled: boolean;
  tooltip?: string;
}

function tabClassName(active: boolean, disabled: boolean): string {
  const base =
    "inline-flex min-w-[120px] items-center justify-center border-b-2 px-4 py-3 text-sm font-semibold transition";

  if (disabled) {
    return `${base} cursor-not-allowed border-transparent text-slate-400`;
  }

  if (active) {
    return `${base} border-slate-900 text-slate-900`;
  }

  return `${base} border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800`;
}

export default function ExamTabNavigation({
  hasSubmission,
  finalPredictionEnabled = false,
}: ExamTabNavigationProps) {
  const pathname = usePathname();

  const tabs: TabItem[] = [
    { href: "/exam/main", label: "풀서비스 메인", disabled: false },
    { href: "/exam/input", label: "응시정보 입력", disabled: false },
    {
      href: "/exam/result",
      label: "내 성적 분석",
      disabled: !hasSubmission,
      tooltip: "답안 제출 후 이용할 수 있습니다.",
    },
    {
      href: "/exam/final",
      label: "최종합산 계산",
      disabled: !hasSubmission,
      tooltip: "답안 제출 후 이용할 수 있습니다.",
    },
    {
      href: "/exam/prediction",
      label: "합격 예측",
      disabled: !hasSubmission,
      tooltip: "답안 제출 후 이용할 수 있습니다.",
    },
    {
      href: "/exam/comments",
      label: "실시간 댓글",
      disabled: !hasSubmission,
      tooltip: "답안 제출 후 이용할 수 있습니다.",
    },
  ];
  const visibleTabs = tabs.filter((tab) => (tab.href === "/exam/final" ? finalPredictionEnabled : true));

  return (
    <nav className="overflow-x-auto border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full min-w-max max-w-7xl">
        {visibleTabs.map((tab) => {
          const active = pathname === tab.href;
          if (tab.disabled) {
            return (
              <span
                key={tab.href}
                className={tabClassName(active, true)}
                title={tab.tooltip}
                aria-disabled="true"
              >
                {tab.label}
              </span>
            );
          }

          return (
            <Link key={tab.href} href={tab.href} className={tabClassName(active, false)} title={tab.tooltip}>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
