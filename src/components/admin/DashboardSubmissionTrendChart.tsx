"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface SubmissionTrendItem {
  date: string;
  count: number;
}

interface DashboardSubmissionTrendChartProps {
  data: SubmissionTrendItem[];
}

export default function DashboardSubmissionTrendChart({
  data,
}: DashboardSubmissionTrendChartProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">최근 제출 추이 (최대 10일)</h2>
      <div className="mt-3 h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {data.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">표시할 제출 데이터가 없습니다.</p>
      ) : null}
    </section>
  );
}
