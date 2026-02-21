"use client";

import type { ResultResponse } from "@/app/exam/result/types";

interface GradeAnalysisTableProps {
  result: ResultResponse;
}

function formatBonusType(type: ResultResponse["submission"]["bonusType"]): string {
  switch (type) {
    case "VETERAN_5":
      return "취업지원 5%";
    case "VETERAN_10":
      return "취업지원 10%";
    case "HERO_3":
      return "의사상자 3%";
    case "HERO_5":
      return "의사상자 5%";
    default:
      return "해당 없음";
  }
}

function formatRankingBasis(basis: ResultResponse["statistics"]["rankingBasis"]): string {
  if (basis === "NON_CUTOFF_PARTICIPANTS") return "과락 미해당자 기준";
  return "전체 참여자 기준";
}

export default function GradeAnalysisTable({ result }: GradeAnalysisTableProps) {
  const summary = result.analysisSummary;

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">전체 성적 요약</h2>
        <p className="text-xs text-slate-500">순위 기준: {formatRankingBasis(result.statistics.rankingBasis)}</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-[900px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="border border-slate-200 px-3 py-2 text-left">과목명</th>
              <th className="border border-slate-200 px-3 py-2 text-right">내 점수</th>
              <th className="border border-slate-200 px-3 py-2 text-right">내 석차/응시</th>
              <th className="border border-slate-200 px-3 py-2 text-right">전체 평균</th>
              <th className="border border-slate-200 px-3 py-2 text-right">최고점</th>
              <th className="border border-slate-200 px-3 py-2 text-right">상위 10% 평균</th>
              <th className="border border-slate-200 px-3 py-2 text-right">상위 30% 평균</th>
            </tr>
          </thead>
          <tbody>
            {summary.subjects.map((subject) => (
              <tr key={subject.subjectId} className="bg-white">
                <td className="border border-slate-200 px-3 py-2 font-medium text-slate-700">{subject.subjectName}</td>
                <td className="border border-slate-200 px-3 py-2 text-right">
                  {subject.myScore.toFixed(1)}/{subject.maxScore.toFixed(1)}
                </td>
                <td className="border border-slate-200 px-3 py-2 text-right">
                  {subject.myRank}/{subject.totalParticipants}
                </td>
                <td className="border border-slate-200 px-3 py-2 text-right">{subject.averageScore.toFixed(1)}</td>
                <td className="border border-slate-200 px-3 py-2 text-right">{subject.highestScore.toFixed(1)}</td>
                <td className="border border-slate-200 px-3 py-2 text-right">{subject.top10Average.toFixed(1)}</td>
                <td className="border border-slate-200 px-3 py-2 text-right">{subject.top30Average.toFixed(1)}</td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-semibold text-slate-900">
              <td className="border border-slate-200 px-3 py-2">총계</td>
              <td className="border border-slate-200 px-3 py-2 text-right">
                {summary.total.myScore.toFixed(1)}/{summary.total.maxScore.toFixed(1)}
              </td>
              <td className="border border-slate-200 px-3 py-2 text-right">
                {summary.total.myRank}/{summary.total.totalParticipants}
              </td>
              <td className="border border-slate-200 px-3 py-2 text-right">{summary.total.averageScore.toFixed(1)}</td>
              <td className="border border-slate-200 px-3 py-2 text-right">{summary.total.highestScore.toFixed(1)}</td>
              <td className="border border-slate-200 px-3 py-2 text-right">{summary.total.top10Average.toFixed(1)}</td>
              <td className="border border-slate-200 px-3 py-2 text-right">{summary.total.top30Average.toFixed(1)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {result.statistics.hasCutoff ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <p className="font-semibold">과락 과목이 있습니다.</p>
          <div className="mt-1 space-y-1">
            {result.statistics.cutoffSubjects.map((subject) => (
              <p key={subject.subjectName}>
                {subject.subjectName}: {subject.rawScore.toFixed(1)}점 (과락 기준 {subject.cutoffScore.toFixed(1)}점 미만)
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-slate-700">
        <p>원점수 합계: {result.submission.totalScore.toFixed(1)}점</p>
        <p>
          가산점: {formatBonusType(result.submission.bonusType)} ({(result.submission.bonusRate * 100).toFixed(0)}%) / +
          {result.statistics.bonusScore.toFixed(1)}점
        </p>
        <p className="font-semibold text-slate-900">최종점수: {result.submission.finalScore.toFixed(1)}점</p>
      </div>
    </section>
  );
}
