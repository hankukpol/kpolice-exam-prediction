"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ExamCommentsPage from "@/app/exam/comments/page";
import ExamInputPage from "@/app/exam/input/page";
import ExamPredictionPage from "@/app/exam/prediction/page";
import ExamResultPage from "@/app/exam/result/page";
import { Button } from "@/components/ui/button";

type TabKey = "input" | "result" | "prediction" | "comments";

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
  { key: "input", label: "응시정보 입력", requireSubmission: false },
  { key: "result", label: "성적분석", requireSubmission: true },
  { key: "prediction", label: "합격예측", requireSubmission: true },
  { key: "comments", label: "댓글", requireSubmission: true },
];

function tabClassName(active: boolean, disabled: boolean): string {
  const base = "rounded-md border px-3 py-2 text-sm font-medium transition";
  if (disabled) {
    return `${base} cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400`;
  }
  if (active) {
    return `${base} border-slate-900 bg-slate-900 text-white`;
  }
  return `${base} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
}

export default function ExamFunctionArea({ isAuthenticated, hasSubmission }: ExamFunctionAreaProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("input");
  const [localHasSubmission, setLocalHasSubmission] = useState(hasSubmission);

  useEffect(() => {
    setLocalHasSubmission(hasSubmission);
  }, [hasSubmission]);

  const activeTabMeta = useMemo(() => tabs.find((tab) => tab.key === activeTab) ?? tabs[0], [activeTab]);

  useEffect(() => {
    if (activeTabMeta.requireSubmission && !localHasSubmission) {
      setActiveTab("input");
    }
  }, [activeTabMeta.requireSubmission, localHasSubmission]);

  if (!isAuthenticated) {
    return (
      <section id="exam-functions" className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">합격예측 기능 영역</h2>
        <p className="mt-2 text-sm text-slate-600">
          응시정보 입력, 성적분석, 합격예측, 댓글 기능은 로그인 후 이용할 수 있습니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/login">
            <Button>로그인</Button>
          </Link>
          <Link href="/register">
            <Button variant="outline">회원가입</Button>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section id="exam-functions" className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const disabled = tab.requireSubmission && !localHasSubmission;
            return (
              <button
                key={tab.key}
                type="button"
                className={tabClassName(activeTab === tab.key, disabled)}
                disabled={disabled}
                onClick={() => setActiveTab(tab.key)}
                title={disabled ? "답안을 먼저 제출해 주세요." : undefined}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
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
