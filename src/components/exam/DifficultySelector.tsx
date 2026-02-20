"use client";

export type DifficultyRating = "VERY_EASY" | "EASY" | "NORMAL" | "HARD" | "VERY_HARD";

interface DifficultySelectorProps {
  subjectName: string;
  value: DifficultyRating;
  onChange: (next: DifficultyRating) => void;
}

const options: Array<{
  value: DifficultyRating;
  label: string;
}> = [
  {
    value: "VERY_EASY",
    label: "매우 쉬움",
  },
  {
    value: "EASY",
    label: "쉬움",
  },
  {
    value: "NORMAL",
    label: "보통",
  },
  {
    value: "HARD",
    label: "어려움",
  },
  {
    value: "VERY_HARD",
    label: "매우 어려움",
  },
];

export default function DifficultySelector({ subjectName, value, onChange }: DifficultySelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <p className="text-xs text-slate-500">{subjectName} 체감 난이도</p>
      <div className="inline-flex rounded-md border border-slate-200 bg-white p-1">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={`${subjectName}-${option.value}`}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                active
                  ? "border border-blue-600 bg-blue-600 text-white"
                  : "border border-transparent text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
