"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface PassCutSnapshot {
  participantCount: number;
  recruitCount: number;
  averageScore: number | null;
  oneMultipleCutScore: number | null;
  sureMinScore: number | null;
  likelyMinScore: number | null;
  possibleMinScore: number | null;
}

interface PassCutHistoryRelease {
  releaseNumber: number;
  releasedAt: string;
  totalParticipantCount: number;
  snapshot: PassCutSnapshot | null;
}

interface PassCutTrendChartProps {
  releases: PassCutHistoryRelease[];
  current: PassCutSnapshot;
}

function roundNumber(value: number): number {
  return Number(value.toFixed(2));
}

export default function PassCutTrendChart({ releases, current }: PassCutTrendChartProps) {
  const chartData = [
    ...releases.map((release) => ({
      name: `${release.releaseNumber}차`,
      participants: release.snapshot?.participantCount ?? 0,
      sure: release.snapshot?.sureMinScore,
      likely: release.snapshot?.likelyMinScore,
      possible: release.snapshot?.possibleMinScore,
    })),
    {
      name: "현재",
      participants: current.participantCount,
      sure: current.sureMinScore,
      likely: current.likelyMinScore,
      possible: current.possibleMinScore,
    },
  ];

  const allScores = chartData
    .flatMap((row) => [row.sure, row.likely, row.possible])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  const minScore = allScores.length > 0 ? Math.floor(Math.min(...allScores) / 5) * 5 - 5 : 0;
  const maxScore = allScores.length > 0 ? Math.ceil(Math.max(...allScores) / 5) * 5 + 5 : 100;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <h3 className="text-base font-semibold text-slate-900">합격컷 변동 추이</h3>
      <div className="mt-4 h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis
              yAxisId="score"
              domain={[minScore, maxScore]}
              tick={{ fontSize: 12, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="count"
              orientation="right"
              tick={{ fontSize: 12, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
              formatter={(value: unknown, name: string | undefined) => {
                const num = typeof value === "number" ? value : Number(value ?? 0);
                const safeName = name ?? "";
                if (safeName === "참여자 수") {
                  return [`${Math.round(num).toLocaleString("ko-KR")}명`, safeName];
                }
                return [`${roundNumber(num)}점`, safeName];
              }}
            />
            <Legend />
            <Bar yAxisId="count" dataKey="participants" name="참여자 수" fill="#94a3b8" fillOpacity={0.35} />
            <Line yAxisId="score" type="monotone" dataKey="sure" name="확실권" stroke="#16a34a" strokeWidth={2.5} />
            <Line yAxisId="score" type="monotone" dataKey="likely" name="유력권" stroke="#2563eb" strokeWidth={2.5} />
            <Line
              yAxisId="score"
              type="monotone"
              dataKey="possible"
              name="가능권"
              stroke="#f97316"
              strokeWidth={2.5}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
