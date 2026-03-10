"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ExamCommentsPage from "@/app/exam/comments/page";
import ExamFaqPage from "@/app/exam/faq/page";
import ExamFinalPage from "@/app/exam/final/page";
import ExamInputPage from "@/app/exam/input/page";
import ExamNoticesPage from "@/app/exam/notices/page";
import ExamPredictionPage from "@/app/exam/prediction/page";
import ExamResultPage from "@/app/exam/result/page";
import ExamMainOverviewPanel from "@/components/landing/ExamMainOverviewPanel";

type TabKey = "main" | "input" | "result" | "final" | "prediction" | "comments" | "notices" | "faq";

interface TabEnabledSettings {
  main?: boolean;
  input?: boolean;
  result?: boolean;
  final?: boolean;
  prediction?: boolean;
  comments?: boolean;
  notices?: boolean;
  faq?: boolean;
}

interface ExamFunctionAreaProps {
  isAuthenticated: boolean;
  hasSubmission: boolean;
  isAdmin?: boolean;
  finalPredictionEnabled?: boolean;
  commentsEnabled?: boolean;
  tabEnabled?: TabEnabledSettings;
}

interface TabItem {
  key: TabKey;
  label: string;
  requireSubmission: boolean;
}

const ALL_TABS: TabItem[] = [
  { key: "main", label: "풀서비스 메인", requireSubmission: false },
  { key: "input", label: "응시정보 입력", requireSubmission: false },
  { key: "result", label: "성적 분석", requireSubmission: true },
  { key: "final", label: "최종 환산 예측", requireSubmission: true },
  { key: "prediction", label: "합격 예측 정보", requireSubmission: true },
  { key: "comments", label: "실시간 댓글", requireSubmission: true },
  { key: "notices", label: "공지사항", requireSubmission: false },
  { key: "faq", label: "FAQ", requireSubmission: false },
];

function isTabHidden(tabKey: TabKey, tabEnabled: TabEnabledSettings): boolean {
  return tabEnabled[tabKey as keyof TabEnabledSettings] === false;
}

function tabClassName(active: boolean, disabled: boolean): string {
  const base =
    "relative inline-flex w-full min-w-0 items-center justify-center rounded-md px-2 py-2 text-xs font-semibold transition sm:w-auto sm:px-6 sm:py-4 sm:text-base";

  if (disabled) {
    return `${base} cursor-not-allowed text-slate-400`;
  }

  if (active) {
    return `${base} bg-slate-100 text-slate-900 sm:bg-transparent sm:after:absolute sm:after:bottom-0 sm:after:left-0 sm:after:h-[2px] sm:after:w-full sm:after:bg-slate-900`;
  }

  return `${base} text-slate-500 hover:bg-slate-100 hover:text-slate-700 sm:bg-transparent sm:text-slate-400 sm:hover:bg-transparent sm:hover:text-slate-600`;
}

function BlurOverlay({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="relative min-h-[400px] select-none overflow-hidden rounded-lg">
      <div className="pointer-events-none blur-sm" aria-hidden="true">
        <div className="space-y-6 p-4">
          <div className="h-8 w-2/3 rounded bg-slate-200" />
          <div className="grid grid-cols-3 gap-4">
            <div className="h-32 rounded-lg bg-slate-100" />
            <div className="h-32 rounded-lg bg-slate-100" />
            <div className="h-32 rounded-lg bg-slate-100" />
          </div>
          <div className="space-y-3">
            <div className="h-4 w-full rounded bg-slate-100" />
            <div className="h-4 w-5/6 rounded bg-slate-100" />
            <div className="h-4 w-4/6 rounded bg-slate-100" />
          </div>
          <div className="h-48 rounded-lg bg-slate-50" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-24 rounded-lg bg-slate-100" />
            <div className="h-24 rounded-lg bg-slate-100" />
          </div>
        </div>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[2px]">
        <div className="rounded-2xl bg-white/95 px-8 py-6 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <svg className="h-7 w-7 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <p className="text-lg font-semibold text-slate-900">{title}</p>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
          {action ? <div className="mt-4">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

export default function ExamFunctionArea({
  isAuthenticated,
  hasSubmission,
  isAdmin = false,
  finalPredictionEnabled = false,
  commentsEnabled = true,
  tabEnabled = {},
}: ExamFunctionAreaProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("main");
  const [localHasSubmission, setLocalHasSubmission] = useState(hasSubmission);
  const canAccessRestrictedTabs = localHasSubmission || isAdmin;

  const mergedTabEnabled = useMemo<TabEnabledSettings>(
    () => ({
      main: tabEnabled.main ?? true,
      input: tabEnabled.input ?? true,
      result: tabEnabled.result ?? true,
      final: finalPredictionEnabled && (tabEnabled.final ?? true),
      prediction: tabEnabled.prediction ?? true,
      comments: commentsEnabled && (tabEnabled.comments ?? true),
      notices: tabEnabled.notices ?? true,
      faq: tabEnabled.faq ?? true,
    }),
    [tabEnabled, finalPredictionEnabled, commentsEnabled]
  );

  const visibleTabs = useMemo(
    () => ALL_TABS.filter((tab) => !isTabHidden(tab.key, mergedTabEnabled)),
    [mergedTabEnabled]
  );

  useEffect(() => {
    setLocalHasSubmission(hasSubmission);
  }, [hasSubmission]);

  const activeTabMeta = useMemo(
    () => visibleTabs.find((tab) => tab.key === activeTab) ?? visibleTabs[0] ?? null,
    [activeTab, visibleTabs]
  );

  useEffect(() => {
    if (!activeTabMeta && visibleTabs[0]) {
      setActiveTab(visibleTabs[0].key);
    }
  }, [activeTabMeta, visibleTabs]);

  useEffect(() => {
    if (!isAuthenticated || !activeTabMeta) return;
    if (activeTabMeta.requireSubmission && !canAccessRestrictedTabs) {
      setActiveTab("main");
    }
  }, [isAuthenticated, activeTabMeta, canAccessRestrictedTabs]);

  function getTabContent(tabKey: TabKey) {
    switch (tabKey) {
      case "main":
        return <ExamMainOverviewPanel />;
      case "input":
        return (
          <ExamInputPage
            embedded
            onSubmitted={() => {
              setLocalHasSubmission(true);
              setActiveTab("result");
            }}
          />
        );
      case "result":
        return <ExamResultPage embedded />;
      case "final":
        return <ExamFinalPage embedded />;
      case "prediction":
        return <ExamPredictionPage embedded />;
      case "comments":
        return <ExamCommentsPage embedded />;
      case "notices":
        return <ExamNoticesPage embedded />;
      case "faq":
        return <ExamFaqPage embedded />;
      default:
        return null;
    }
  }

  function renderTabContent(tabKey: TabKey) {
    if (!isAuthenticated) {
      return (
        <BlurOverlay
          title="로그인 후 이용할 수 있습니다"
          subtitle="회원가입 후 로그인하시면 모든 기능을 이용할 수 있습니다."
          action={
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/login"
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                로그인
              </Link>
              <Link
                href="/register"
                className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                회원가입
              </Link>
            </div>
          }
        />
      );
    }

    return getTabContent(tabKey);
  }

  if (!activeTabMeta) {
    return null;
  }

  return (
    <section id="exam-functions" className="border border-slate-200 bg-slate-50 p-0">
      <div className="border-b border-slate-200 bg-white px-1 sm:px-3">
        <div className="grid grid-cols-3 gap-1 py-1 sm:flex sm:min-w-max sm:items-center sm:gap-0 sm:py-0">
          {visibleTabs.map((tab) => {
            const disabled = isAuthenticated && tab.requireSubmission && !canAccessRestrictedTabs;

            return (
              <button
                key={tab.key}
                type="button"
                className={tabClassName(activeTab === tab.key, disabled)}
                disabled={disabled}
                onClick={() => setActiveTab(tab.key)}
                title={
                  !isAuthenticated
                    ? "로그인 후 이용할 수 있습니다."
                    : disabled
                      ? "답안 제출 후 이용할 수 있습니다."
                      : undefined
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-slate-50 p-0 sm:p-0">
        <div className="border border-slate-200 border-t-0 bg-white p-4 sm:p-8">
          {renderTabContent(activeTabMeta.key)}
        </div>
      </div>
    </section>
  );
}
