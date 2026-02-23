"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

interface ExamItem {
  id: number;
  name: string;
  year: number;
  round: number;
  isActive: boolean;
}

interface RegionItem {
  id: number;
  name: string;
  isActive: boolean;
  recruitCount: number;
  recruitCountCareer: number;
  applicantCount: number | null;
  applicantCountCareer: number | null;
  examNumberStart: string | null;
  examNumberEnd: string | null;
  passMultiplePublic: string;
  passMultipleCareer: string;
  submissionCount: number;
  submissionCountPublic: number;
  submissionCountCareer: number;
}

interface RegionsResponse {
  exams: ExamItem[];
  selectedExamId: number | null;
  regions: RegionItem[];
}

type NoticeState = {
  type: "success" | "error";
  message: string;
} | null;

type EditableRegionItem = Pick<
  RegionItem,
  | "id"
  | "name"
  | "isActive"
  | "recruitCount"
  | "recruitCountCareer"
  | "applicantCount"
  | "applicantCountCareer"
  | "examNumberStart"
  | "examNumberEnd"
> &
  Pick<RegionItem, "submissionCount" | "submissionCountPublic" | "submissionCountCareer">;

function getPassMultipleText(recruitCount: number): string {
  if (!Number.isInteger(recruitCount) || recruitCount <= 0) return "-";
  if (recruitCount >= 150) return "1.5배";
  if (recruitCount >= 100) return "1.6배";
  if (recruitCount >= 50) return "1.7배";
  if (recruitCount >= 6) return "1.8배";

  const smallTable: Record<number, number> = { 5: 10, 4: 9, 3: 8, 2: 6, 1: 3 };
  const passCount = smallTable[recruitCount];
  if (!passCount) return "-";
  return `${(passCount / recruitCount).toFixed(1)}배`;
}

function toSafeNonNegativeInt(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.floor(parsed));
}

function toSafeNullableNonNegativeInt(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  return toSafeNonNegativeInt(value);
}

export default function AdminRegionsPage() {
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [regions, setRegions] = useState<EditableRegionItem[]>([]);
  const [originalById, setOriginalById] = useState<Map<number, EditableRegionItem>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);

  const changedCount = useMemo(() => {
    let count = 0;
    for (const row of regions) {
      const original = originalById.get(row.id);
      if (!original) continue;

      if (
        original.isActive !== row.isActive ||
        original.recruitCount !== row.recruitCount ||
        original.recruitCountCareer !== row.recruitCountCareer ||
        original.applicantCount !== row.applicantCount ||
        original.applicantCountCareer !== row.applicantCountCareer ||
        original.examNumberStart !== row.examNumberStart ||
        original.examNumberEnd !== row.examNumberEnd
      ) {
        count += 1;
      }
    }
    return count;
  }, [regions, originalById]);

  const loadRegions = useCallback(async (examId?: number | null) => {
    setIsLoading(true);
    setNotice(null);

    try {
      const params = new URLSearchParams();
      if (examId) {
        params.set("examId", String(examId));
      }

      const response = await fetch(`/api/admin/regions?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });
      const data = (await response.json()) as RegionsResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "모집인원 목록을 불러오지 못했습니다.");
      }

      setExams(data.exams ?? []);
      setSelectedExamId(data.selectedExamId);

      const nextRows = (data.regions ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        isActive: Boolean(item.isActive),
        recruitCount: item.recruitCount,
        recruitCountCareer: item.recruitCountCareer,
        applicantCount: item.applicantCount ?? null,
        applicantCountCareer: item.applicantCountCareer ?? null,
        examNumberStart: item.examNumberStart ?? null,
        examNumberEnd: item.examNumberEnd ?? null,
        submissionCount: item.submissionCount,
        submissionCountPublic: item.submissionCountPublic,
        submissionCountCareer: item.submissionCountCareer,
      }));

      setRegions(nextRows);
      setOriginalById(new Map(nextRows.map((row) => [row.id, { ...row }] as const)));
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "모집인원 목록 조회에 실패했습니다.",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRegions();
  }, [loadRegions]);

  function handleExamChange(newExamId: number) {
    if (changedCount > 0) {
      const confirmed = window.confirm("저장하지 않은 변경사항이 있습니다. 시험을 변경하시겠습니까?");
      if (!confirmed) return;
    }
    setSelectedExamId(newExamId);
    void loadRegions(newExamId);
  }

  function updateRegionValue(
    id: number,
    field: "recruitCount" | "recruitCountCareer" | "applicantCount" | "applicantCountCareer",
    value: string
  ) {
    setRegions((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              [field]:
                field === "applicantCount" || field === "applicantCountCareer"
                  ? toSafeNullableNonNegativeInt(value)
                  : toSafeNonNegativeInt(value),
            }
          : row
      )
    );
  }

  function updateRegionStringValue(
    id: number,
    field: "examNumberStart" | "examNumberEnd",
    value: string
  ) {
    setRegions((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, [field]: value.trim() || null } : row
      )
    );
  }

  function updateRegionActive(id: number, nextActive: boolean) {
    setRegions((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              isActive: nextActive,
            }
          : row
      )
    );
  }

  function isFieldChanged(
    row: EditableRegionItem,
    field:
      | "isActive"
      | "recruitCount"
      | "recruitCountCareer"
      | "applicantCount"
      | "applicantCountCareer"
      | "examNumberStart"
      | "examNumberEnd"
  ): boolean {
    const original = originalById.get(row.id);
    if (!original) return false;
    return original[field] !== row[field];
  }

  async function handleSaveAll() {
    if (!selectedExamId) {
      setNotice({ type: "error", message: "시험이 선택되지 않았습니다." });
      return;
    }

    if (regions.length === 0) {
      setNotice({ type: "error", message: "저장할 지역 데이터가 없습니다." });
      return;
    }

    if (changedCount < 1) {
      setNotice({ type: "error", message: "변경된 지역 설정이 없습니다." });
      return;
    }

    const confirmed = window.confirm(
      "지역 활성 상태/모집인원 변경은 성적 입력 및 합격예측에 즉시 반영됩니다. 저장하시겠습니까?"
    );
    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/regions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId: selectedExamId,
          regions: regions.map((row) => ({
            regionId: row.id,
            isActive: row.isActive,
            recruitCount: row.recruitCount,
            recruitCountCareer: row.recruitCountCareer,
            applicantCount: row.applicantCount,
            applicantCountCareer: row.applicantCountCareer,
            examNumberStart: row.examNumberStart,
            examNumberEnd: row.examNumberEnd,
          })),
        }),
      });
      const data = (await response.json()) as { success?: boolean; message?: string; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "지역 설정 저장에 실패했습니다.");
      }

      setNotice({
        type: "success",
        message: data.message ?? "지역 설정이 저장되었습니다.",
      });
      setOriginalById(new Map(regions.map((row) => [row.id, { ...row }] as const)));
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "지역 설정 저장에 실패했습니다.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCopyFromExam(sourceExamId: number) {
    if (!selectedExamId) return;

    const sourceExam = exams.find((e) => e.id === sourceExamId);
    const confirmed = window.confirm(
      `"${sourceExam?.name ?? "선택된 시험"}"의 모집인원을 현재 시험으로 복사하시겠습니까?\n기존 데이터가 덮어씌워집니다.`
    );
    if (!confirmed) return;

    setIsCopying(true);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceExamId,
          targetExamId: selectedExamId,
        }),
      });
      const data = (await response.json()) as { success?: boolean; message?: string; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "모집인원 복사에 실패했습니다.");
      }

      setNotice({
        type: "success",
        message: data.message ?? "모집인원이 복사되었습니다.",
      });

      // 복사 후 새로고침
      void loadRegions(selectedExamId);
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "모집인원 복사에 실패했습니다.",
      });
    } finally {
      setIsCopying(false);
    }
  }

  const otherExams = exams.filter((e) => e.id !== selectedExamId);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">지역/모집인원 관리</h1>
        <p className="mt-1 text-sm text-slate-600">
          시험별로 지역 활성/비활성 및 공채·경행경채 모집인원을 관리합니다.
        </p>
      </header>

      {/* 시험 선택 */}
      <section className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <label className="text-sm font-medium text-slate-700">시험 선택</label>
        <select
          value={selectedExamId ?? ""}
          onChange={(e) => handleExamChange(Number(e.target.value))}
          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
          disabled={isLoading}
        >
          {exams.map((exam) => (
            <option key={exam.id} value={exam.id}>
              {exam.name} {exam.isActive ? "(활성)" : ""}
            </option>
          ))}
        </select>

        {/* 이전 시험에서 복사 */}
        {otherExams.length > 0 && selectedExamId && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-500">다른 시험에서 복사:</span>
            <select
              id="copy-source"
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
              disabled={isCopying}
              defaultValue=""
              onChange={(e) => {
                const sourceId = Number(e.target.value);
                if (sourceId) {
                  void handleCopyFromExam(sourceId);
                  e.target.value = "";
                }
              }}
            >
              <option value="" disabled>
                시험 선택...
              </option>
              {otherExams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">비활성 지역은 사용자 성적 입력 및 예측 대상에서 제외됩니다.</p>
        <p className="mt-1">대구/경북만 운영하려면 해당 지역만 활성으로 두고 저장하세요.</p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p>
          1배수 기준 인원은 모집인원과 동일합니다. 실제 1배수 끝등수/동점 인원/컷 점수는{" "}
          <Link href="/admin/stats" className="font-semibold text-slate-900 underline">
            참여 통계
          </Link>
          에서 시험 선택 후 확인할 수 있습니다.
        </p>
      </section>

      {notice ? (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            notice.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {notice.message}
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-slate-600">지역 데이터를 불러오는 중입니다...</p>
      ) : regions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-600">
          등록된 지역이 없습니다.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-[1800px] w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">지역</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">공채 모집인원</th>
                <th className="px-4 py-3">공채 합격배수</th>
                <th className="px-4 py-3">공채 출원인원</th>
                <th className="px-4 py-3">경행경채 모집인원</th>
                <th className="px-4 py-3">경행경채 합격배수</th>
                <th className="px-4 py-3">경행경채 출원인원</th>
                <th className="px-4 py-3">응시번호 범위</th>
                <th className="px-4 py-3">참여 현황</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {regions.map((row) => (
                <tr key={row.id} className="bg-white">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                  <td className="px-4 py-3">
                    <label
                      className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold ${
                        isFieldChanged(row, "isActive")
                          ? "border-amber-300 bg-amber-50"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={row.isActive}
                        onChange={(event) => updateRegionActive(row.id, event.target.checked)}
                      />
                      {row.isActive ? "활성" : "비활성"}
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={row.recruitCount}
                      onChange={(event) => updateRegionValue(row.id, "recruitCount", event.target.value)}
                      className={`h-9 w-28 rounded-md border px-2 text-right text-sm ${
                        isFieldChanged(row, "recruitCount")
                          ? "border-amber-300 bg-amber-50"
                          : "border-slate-300 bg-white"
                      }`}
                    />
                    <p className="mt-1 text-xs text-slate-500">1배수 기준 {row.recruitCount.toLocaleString("ko-KR")}명</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{getPassMultipleText(row.recruitCount)}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={row.applicantCount ?? ""}
                      onChange={(event) => updateRegionValue(row.id, "applicantCount", event.target.value)}
                      className={`h-9 w-32 rounded-md border px-2 text-right text-sm ${
                        isFieldChanged(row, "applicantCount")
                          ? "border-amber-300 bg-amber-50"
                          : "border-slate-300 bg-white"
                      }`}
                      placeholder="추정 사용"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={row.recruitCountCareer}
                      onChange={(event) =>
                        updateRegionValue(row.id, "recruitCountCareer", event.target.value)
                      }
                      className={`h-9 w-28 rounded-md border px-2 text-right text-sm ${
                        isFieldChanged(row, "recruitCountCareer")
                          ? "border-amber-300 bg-amber-50"
                          : "border-slate-300 bg-white"
                      }`}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      {row.recruitCountCareer > 0
                        ? `1배수 기준 ${row.recruitCountCareer.toLocaleString("ko-KR")}명`
                        : "1배수 기준 없음"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{getPassMultipleText(row.recruitCountCareer)}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={row.applicantCountCareer ?? ""}
                      onChange={(event) =>
                        updateRegionValue(row.id, "applicantCountCareer", event.target.value)
                      }
                      className={`h-9 w-32 rounded-md border px-2 text-right text-sm ${
                        isFieldChanged(row, "applicantCountCareer")
                          ? "border-amber-300 bg-amber-50"
                          : "border-slate-300 bg-white"
                      }`}
                      placeholder="추정 사용"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={row.examNumberStart ?? ""}
                        onChange={(e) => updateRegionStringValue(row.id, "examNumberStart", e.target.value)}
                        placeholder="시작"
                        className={`h-9 w-24 rounded-md border px-2 text-center text-sm font-mono ${
                          isFieldChanged(row, "examNumberStart")
                            ? "border-amber-300 bg-amber-50"
                            : "border-slate-300 bg-white"
                        }`}
                      />
                      <span className="text-slate-400">~</span>
                      <input
                        type="text"
                        value={row.examNumberEnd ?? ""}
                        onChange={(e) => updateRegionStringValue(row.id, "examNumberEnd", e.target.value)}
                        placeholder="끝"
                        className={`h-9 w-24 rounded-md border px-2 text-center text-sm font-mono ${
                          isFieldChanged(row, "examNumberEnd")
                            ? "border-amber-300 bg-amber-50"
                            : "border-slate-300 bg-white"
                        }`}
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {row.examNumberStart && row.examNumberEnd
                        ? `${row.examNumberStart}~${row.examNumberEnd}`
                        : "미설정"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    공채 {row.submissionCountPublic}명 / 경행경채 {row.submissionCountCareer}명
                    <span className="ml-2 text-xs text-slate-500">(합계 {row.submissionCount}명)</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">변경된 지역 수: {changedCount}개</p>
        <Button type="button" onClick={handleSaveAll} disabled={isLoading || isSaving || changedCount < 1}>
          {isSaving ? "저장 중..." : "전체 저장"}
        </Button>
      </div>
    </div>
  );
}
