"use client";

interface PassCutSnapshot {
  participantCount: number;
  recruitCount: number;
  applicantCount: number | null;
  targetParticipantCount: number | null;
  coverageRate: number | null;
  stabilityScore: number | null;
  status:
    | "READY"
    | "COLLECTING_LOW_PARTICIPATION"
    | "COLLECTING_UNSTABLE"
    | "COLLECTING_MISSING_APPLICANT_COUNT"
    | "COLLECTING_INSUFFICIENT_SAMPLE";
  statusReason: string | null;
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

function formatScore(value: number | null): string {
  if (value === null) return "데이터 수집 중";
  return value.toFixed(2);
}

function getDefaultReason(status: PassCutSnapshot["status"]): string {
  if (status === "COLLECTING_LOW_PARTICIPATION") return "참여율 부족";
  if (status === "COLLECTING_UNSTABLE") return "안정도 부족";
  if (status === "COLLECTING_MISSING_APPLICANT_COUNT") return "응시인원 미입력";
  if (status === "COLLECTING_INSUFFICIENT_SAMPLE") return "표본 부족";
  return "데이터 수집 중";
}

function formatThreshold(snapshot: PassCutSnapshot | null, value: number | null): string {
  if (!snapshot) return "-";
  if (snapshot.status !== "READY") {
    return `미집계(${snapshot.statusReason ?? getDefaultReason(snapshot.status)})`;
  }
  return formatScore(value);
}

function formatCoverage(snapshot: PassCutSnapshot | null): string {
  if (!snapshot) return "-";
  if (snapshot.coverageRate === null) return "-";
  return `${snapshot.coverageRate.toFixed(1)}%`;
}

function formatStability(snapshot: PassCutSnapshot | null): string {
  if (!snapshot) return "-";
  if (snapshot.stabilityScore === null) return "-";
  return snapshot.stabilityScore.toFixed(1);
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
        <table className="min-w-[860px] w-full border-collapse text-sm">
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
              <td className="border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700">응시인원</td>
              {columns.map((column) => (
                <td key={`${column.key}-applicant`} className="border border-slate-200 px-3 py-2 text-center">
                  {column.snapshot
                    ? column.snapshot.applicantCount === null
                      ? "미입력"
                      : `${column.snapshot.applicantCount.toLocaleString("ko-KR")}명`
                    : "-"}
                </td>
              ))}
            </tr>
            <tr>
              <td className="border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700">목표인원</td>
              {columns.map((column) => (
                <td key={`${column.key}-target`} className="border border-slate-200 px-3 py-2 text-center">
                  {column.snapshot
                    ? column.snapshot.targetParticipantCount === null
                      ? "-"
                      : `${column.snapshot.targetParticipantCount.toLocaleString("ko-KR")}명`
                    : "-"}
                </td>
              ))}
            </tr>
            <tr>
              <td className="border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700">참여율</td>
              {columns.map((column) => (
                <td key={`${column.key}-coverage`} className="border border-slate-200 px-3 py-2 text-center">
                  {formatCoverage(column.snapshot)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700">안정도</td>
              {columns.map((column) => (
                <td key={`${column.key}-stability`} className="border border-slate-200 px-3 py-2 text-center">
                  {formatStability(column.snapshot)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700">확실권</td>
              {columns.map((column) => (
                <td key={`${column.key}-sure`} className="border border-slate-200 px-3 py-2 text-center">
                  {formatThreshold(column.snapshot, column.snapshot?.sureMinScore ?? null)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700">유력권</td>
              {columns.map((column) => (
                <td key={`${column.key}-likely`} className="border border-slate-200 px-3 py-2 text-center">
                  {formatThreshold(column.snapshot, column.snapshot?.likelyMinScore ?? null)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700">가능권</td>
              {columns.map((column) => (
                <td key={`${column.key}-possible`} className="border border-slate-200 px-3 py-2 text-center">
                  {formatThreshold(column.snapshot, column.snapshot?.possibleMinScore ?? null)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700">1배수컷</td>
              {columns.map((column) => (
                <td key={`${column.key}-one`} className="border border-slate-200 px-3 py-2 text-center">
                  {formatThreshold(column.snapshot, column.snapshot?.oneMultipleCutScore ?? null)}
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
      <p className="mt-3 text-xs text-slate-500">
        미집계 항목은 자동 발표 조건(참여율/안정도/응시인원 입력/표본수)을 충족하지 못한 상태입니다.
      </p>
    </section>
  );
}
