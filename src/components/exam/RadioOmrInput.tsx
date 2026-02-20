"use client";

interface RadioOmrInputProps {
  subjectName: string;
  questionCount: number;
  answers: Record<number, number | null>;
  onAnswerChange: (questionNo: number, answer: number | null) => void;
}

export default function RadioOmrInput({
  subjectName,
  questionCount,
  answers,
  onAnswerChange,
}: RadioOmrInputProps) {
  return (
    <div className="space-y-2">
      {Array.from({ length: questionCount }, (_, index) => {
        const questionNo = index + 1;
        const selected = answers[questionNo];

        return (
          <div
            key={`${subjectName}-radio-${questionNo}`}
            className={`flex items-center gap-3 rounded-md border px-3 py-2 ${
              selected === null ? "border-rose-200 bg-rose-50/60" : "border-slate-200 bg-white"
            }`}
          >
            <span className="w-9 text-sm font-semibold text-slate-700">{questionNo}</span>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4].map((choice) => {
                const active = selected === choice;
                return (
                  <button
                    key={`${subjectName}-${questionNo}-${choice}`}
                    type="button"
                    onClick={() => onAnswerChange(questionNo, active ? null : choice)}
                    className={`h-11 w-11 rounded-full border text-sm font-semibold transition ${
                      active
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-300 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50"
                    }`}
                    aria-label={`${subjectName} ${questionNo}번 ${choice}번 선택`}
                  >
                    {choice}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
