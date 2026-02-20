"use client";

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

interface PassCutHistoryTableProps {
  releases: PassCutHistoryRelease[];
  current: PassCutSnapshot;
}

function formatScore(value: number | null): string {
  if (value === null) return "-";
  return value.toFixed(2);
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function PassCutHistoryTable({ releases, current }: PassCutHistoryTableProps) {
  const columns = [
    ...releases.map((release) => ({
      key: `release-${release.releaseNumber}`,
      title: `${release.releaseNumber}차`,
      subtitle: formatDate(release.releasedAt),
      snapshot: release.snapshot,
    })),
    {
      key: "current",
      title: "현재",
      subtitle: "실시간",
      snapshot: current,
    },
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <h3 className="text-base font-semibold text-slate-900">합격컷 발표 현황</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[760px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="border border-slate-200 px-3 py-2 text-left">구분</th>
              {columns.map((column) => (
                <th key={column.key} className="border border-slate-200 px-3 py-2 text-center">
                  <p className="font-semibold text-slate-800">{column.title}</p>
                  <p className="mt-0.5 text-xs font-normal text-slate-500">{column.subtitle}</p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700">참여자</td>
              {columns.map((column) => (
                <td key={`${column.key}-participant`} className="border border-slate-200 px-3 py-2 text-center">
                  {column.snapshot ? `${column.snapshot.participantCount.toLocaleString("ko-KR")}명` : "-"}
                </td>
              ))}
            </tr>
            <tr>
              <td className="border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700">확실권</td>
              {columns.map((column) => (
                <td key={`${column.key}-sure`} className="border border-slate-200 px-3 py-2 text-center">
                  {column.snapshot ? `${formatScore(column.snapshot.sureMinScore)}↑` : "-"}
                </td>
              ))}
            </tr>
            <tr>
              <td className="border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700">유력권</td>
              {columns.map((column) => (
                <td key={`${column.key}-likely`} className="border border-slate-200 px-3 py-2 text-center">
                  {column.snapshot ? `${formatScore(column.snapshot.likelyMinScore)}↑` : "-"}
                </td>
              ))}
            </tr>
            <tr>
              <td className="border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700">가능권</td>
              {columns.map((column) => (
                <td key={`${column.key}-possible`} className="border border-slate-200 px-3 py-2 text-center">
                  {column.snapshot ? `${formatScore(column.snapshot.possibleMinScore)}↑` : "-"}
                </td>
              ))}
            </tr>
            <tr>
              <td className="border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700">1배수컷</td>
              {columns.map((column) => (
                <td key={`${column.key}-one`} className="border border-slate-200 px-3 py-2 text-center">
                  {column.snapshot ? formatScore(column.snapshot.oneMultipleCutScore) : "-"}
                </td>
              ))}
            </tr>
            <tr>
              <td className="border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700">평균점</td>
              {columns.map((column) => (
                <td key={`${column.key}-avg`} className="border border-slate-200 px-3 py-2 text-center">
                  {column.snapshot ? formatScore(column.snapshot.averageScore) : "-"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">참여자 수가 증가할수록 예측 정확도가 높아집니다.</p>
    </section>
  );
}
