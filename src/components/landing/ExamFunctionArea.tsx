"use client";

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

interface ExamFunctionAreaProps {
  isAuthenticated: boolean;
  hasSubmission: boolean;
  isAdmin?: boolean;
  finalPredictionEnabled?: boolean;
}

interface TabItem {
  key: TabKey;
  label: string;
  requireSubmission: boolean;
}

const tabs: TabItem[] = [
  { key: "main", label: "풀서비스 메인", requireSubmission: false },
  { key: "input", label: "응시정보 입력", requireSubmission: false },
  { key: "result", label: "내 성적 분석", requireSubmission: true },
  { key: "final", label: "최종 환산 예측", requireSubmission: true },
  { key: "prediction", label: "합격 컷/경쟁자 정보", requireSubmission: true },
  { key: "comments", label: "실시간 댓글", requireSubmission: true },
  { key: "notices", label: "공지사항", requireSubmission: false },
  { key: "faq", label: "FAQ", requireSubmission: false },
];

function tabClassName(active: boolean, disabled: boolean): string {
  const base = "relative px-3 py-4 text-base font-semibold transition sm:px-6";
  if (disabled) {
    return `${base} cursor-not-allowed text-slate-400`;
  }
  if (active) {
    return `${base} text-slate-900 after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:bg-slate-900`;
  }
  return `${base} text-slate-400 hover:text-slate-600`;
}

export default function ExamFunctionArea({
  isAuthenticated,
  hasSubmission,
  isAdmin = false,
  finalPredictionEnabled = false,
}: ExamFunctionAreaProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("main");
  const [localHasSubmission, setLocalHasSubmission] = useState(hasSubmission);
  const canAccessRestrictedTabs = localHasSubmission || isAdmin;
  const visibleTabs = useMemo(
    () => tabs.filter((tab) => (tab.key === "final" ? finalPredictionEnabled : true)),
    [finalPredictionEnabled]
  );

  useEffect(() => {
    setLocalHasSubmission(hasSubmission);
  }, [hasSubmission]);

  const activeTabMeta = useMemo(
    () => visibleTabs.find((tab) => tab.key === activeTab) ?? visibleTabs[0],
    [activeTab, visibleTabs]
  );

  useEffect(() => {
    if (activeTabMeta.requireSubmission && !canAccessRestrictedTabs) {
      setActiveTab("main");
    }
  }, [activeTabMeta.requireSubmission, canAccessRestrictedTabs]);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab("main");
    }
  }, [activeTab, visibleTabs]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <section
      id="exam-functions"
      className="border border-slate-300 bg-[#efefef] p-0 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.45)]"
    >
      <div className="overflow-x-auto border-b border-slate-300 bg-white px-1 sm:px-3">
        <div className="flex min-w-max items-center">
          {visibleTabs.map((tab) => {
            const disabled = tab.requireSubmission && !canAccessRestrictedTabs;
            return (
              <button
                key={tab.key}
                type="button"
                className={tabClassName(activeTab === tab.key, disabled)}
                disabled={disabled}
                onClick={() => setActiveTab(tab.key)}
                title={disabled ? "답안 제출 후 활성화됩니다." : undefined}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-[#efefef] p-0 sm:p-0">
        <div className="border border-slate-300 border-t-0 bg-white p-4 sm:p-8">
          {activeTab === "main" ? <ExamMainOverviewPanel /> : null}
          {activeTab === "input" ? (
            <ExamInputPage
              embedded
              onSubmitted={() => {
                setLocalHasSubmission(true);
                setActiveTab("result");
              }}
            />
          ) : null}
          {activeTab === "result" ? <ExamResultPage embedded /> : null}
          {activeTab === "final" ? <ExamFinalPage embedded /> : null}
          {activeTab === "prediction" ? <ExamPredictionPage embedded /> : null}
          {activeTab === "comments" ? <ExamCommentsPage embedded /> : null}
          {activeTab === "notices" ? <ExamNoticesPage embedded /> : null}
          {activeTab === "faq" ? <ExamFaqPage embedded /> : null}
        </div>
      </div>
    </section>
  );
}
