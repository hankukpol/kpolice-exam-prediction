"use client";

export type OmrInputMode = "quick" | "radio";

interface OmrInputModeToggleProps {
  value: OmrInputMode;
  onChange: (next: OmrInputMode) => void;
}

export default function OmrInputModeToggle({ value, onChange }: OmrInputModeToggleProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-sm text-slate-600">입력 방식:</p>
      <div className="inline-flex rounded-md border border-slate-200 bg-white p-1">
        <button
          type="button"
          onClick={() => onChange("quick")}
          className={`rounded px-3 py-1.5 text-sm font-medium transition ${
            value === "quick"
              ? "bg-slate-900 text-white"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          빠른입력 (키보드)
        </button>
        <button
          type="button"
          onClick={() => onChange("radio")}
          className={`rounded px-3 py-1.5 text-sm font-medium transition ${
            value === "radio"
              ? "bg-slate-900 text-white"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          OMR 마킹 (터치)
        </button>
      </div>
    </div>
  );
}
