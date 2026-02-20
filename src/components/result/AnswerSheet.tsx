"use client";

interface SubjectAnswerRow {
  questionNumber: number;
  selectedAnswer: number;
  isCorrect: boolean;
  correctAnswer: number | null;
  correctRate: number;
  difficultyLevel: "EASY" | "NORMAL" | "HARD" | "VERY_HARD";
}

interface SubjectSummary {
  subjectId: number;
  subjectName: string;
  averageCorrectRate: number;
  hardestQuestion: number | null;
  hardestRate: number | null;
  easiestQuestion: number | null;
  easiestRate: number | null;
  myCorrectOnHard: number;
  myWrongOnEasy: number;
}

interface SubjectAnswerSheet {
  subjectId: number;
  subjectName: string;
  answers: SubjectAnswerRow[];
}

interface AnswerSheetProps {
  subjects: SubjectAnswerSheet[];
  summaries: SubjectSummary[];
}

function difficultyBadge(level: SubjectAnswerRow["difficultyLevel"]): { label: string; className: string } {
  if (level === "VERY_HARD") {
    return { label: "🔥 고난도", className: "bg-rose-100 text-rose-700" };
  }
  if (level === "HARD") {
    return { label: "어려움", className: "bg-amber-100 text-amber-700" };
  }
  if (level === "EASY") {
    return { label: "쉬움", className: "bg-emerald-100 text-emerald-700" };
  }
  return { label: "보통", className: "bg-slate-100 text-slate-700" };
}

export default function AnswerSheet({ subjects, summaries }: AnswerSheetProps) {
  return (
    <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-base font-semibold text-slate-900">정오표 - 문항별 정답률 분석</h2>

      {subjects.map((subject) => {
        const summary = summaries.find((item) => item.subjectId === subject.subjectId) ?? null;
        return (
          <article key={subject.subjectId} className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">{subject.subjectName}</h3>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-[760px] w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-700">
                    <th className="border border-slate-200 px-3 py-2 text-left">번호</th>
                    <th className="border border-slate-200 px-3 py-2 text-center">내 답</th>
                    <th className="border border-slate-200 px-3 py-2 text-center">정답</th>
                    <th className="border border-slate-200 px-3 py-2 text-center">결과</th>
                    <th className="border border-slate-200 px-3 py-2 text-center">정답률</th>
                    <th className="border border-slate-200 px-3 py-2 text-center">난이도</th>
                  </tr>
                </thead>
                <tbody>
                  {subject.answers.map((answer) => {
                    const badge = difficultyBadge(answer.difficultyLevel);
                    return (
                      <tr key={`${subject.subjectId}-${answer.questionNumber}`} className="bg-white">
                        <td className="border border-slate-200 px-3 py-2 text-left">{answer.questionNumber}</td>
                        <td className="border border-slate-200 px-3 py-2 text-center">{answer.selectedAnswer}</td>
                        <td className="border border-slate-200 px-3 py-2 text-center">
                          {answer.correctAnswer ?? "-"}
                        </td>
                        <td
                          className={`border border-slate-200 px-3 py-2 text-center font-semibold ${
                            answer.isCorrect ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {answer.isCorrect ? "정답" : "오답"}
                        </td>
                        <td className="border border-slate-200 px-3 py-2 text-center">
                          {answer.correctRate.toFixed(1)}%
                        </td>
                        <td className="border border-slate-200 px-3 py-2 text-center">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {summary ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 sm:text-sm">
                <p>과목 평균 정답률: {summary.averageCorrectRate.toFixed(1)}%</p>
                <p>
                  가장 어려운 문항: {summary.hardestQuestion ?? "-"}번 ({summary.hardestRate?.toFixed(1) ?? "-"}%)
                </p>
                <p>
                  가장 쉬운 문항: {summary.easiestQuestion ?? "-"}번 ({summary.easiestRate?.toFixed(1) ?? "-"}%)
                </p>
                <p>고난도 문항 정답 수: {summary.myCorrectOnHard}문항</p>
                <p>쉬운 문항 오답 수: {summary.myWrongOnEasy}문항</p>
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
