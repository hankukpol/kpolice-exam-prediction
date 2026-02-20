"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ExamCommentsPage from "@/app/exam/comments/page";
import ExamInputPage from "@/app/exam/input/page";
import ExamPredictionPage from "@/app/exam/prediction/page";
import ExamResultPage from "@/app/exam/result/page";
import ExamMainOverviewPanel from "@/components/landing/ExamMainOverviewPanel";
import { Button } from "@/components/ui/button";

type TabKey = "main" | "input" | "result" | "prediction" | "comments";

interface ExamFunctionAreaProps {
  isAuthenticated: boolean;
  hasSubmission: boolean;
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
  { key: "prediction", label: "합격 컷/경쟁자 정보", requireSubmission: true },
  { key: "comments", label: "실시간 댓글", requireSubmission: true },
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

export default function ExamFunctionArea({ isAuthenticated, hasSubmission }: ExamFunctionAreaProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("main");
  const [localHasSubmission, setLocalHasSubmission] = useState(hasSubmission);

  useEffect(() => {
    setLocalHasSubmission(hasSubmission);
  }, [hasSubmission]);

  const activeTabMeta = useMemo(() => tabs.find((tab) => tab.key === activeTab) ?? tabs[0], [activeTab]);

  useEffect(() => {
    if (activeTabMeta.requireSubmission && !localHasSubmission) {
      setActiveTab("main");
    }
  }, [activeTabMeta.requireSubmission, localHasSubmission]);

  if (!isAuthenticated) {
    return (
      <section
        id="exam-functions"
        className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.45)]"
      >
        <h2 className="text-xl font-black text-slate-900">합격예측 풀서비스 메뉴</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          응시정보 입력, 성적분석, 합격예측, 댓글 기능은 로그인 후 이용할 수 있습니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/login">
            <Button className="rounded-full bg-black px-5 hover:bg-slate-800">로그인</Button>
          </Link>
          <Link href="/register">
            <Button variant="outline" className="rounded-full px-5">
              회원가입
            </Button>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      id="exam-functions"
      className="rounded-[28px] border border-slate-300 bg-[#efefef] p-2 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.45)]"
    >
      <div className="overflow-x-auto border-b border-slate-300 px-1 sm:px-3">
        <div className="flex min-w-max items-center">
          {tabs.map((tab) => {
            const disabled = tab.requireSubmission && !localHasSubmission;
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

      <div className="rounded-b-[24px] bg-[#efefef] p-3 sm:p-5">
        <div className="rounded-2xl border border-slate-300 bg-white p-4 sm:p-5">
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
          {activeTab === "prediction" ? <ExamPredictionPage embedded /> : null}
          {activeTab === "comments" ? <ExamCommentsPage embedded /> : null}
        </div>
      </div>
    </section>
  );
}
