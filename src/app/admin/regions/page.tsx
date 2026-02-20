"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

interface RegionItem {
  id: number;
  name: string;
  recruitCount: number;
  recruitCountCareer: number;
  passMultiplePublic: string;
  passMultipleCareer: string;
  submissionCount: number;
  submissionCountPublic: number;
  submissionCountCareer: number;
}

interface RegionsResponse {
  regions: RegionItem[];
}

type NoticeState = {
  type: "success" | "error";
  message: string;
} | null;

type EditableRegionItem = Pick<RegionItem, "id" | "name" | "recruitCount" | "recruitCountCareer"> &
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

export default function AdminRegionsPage() {
  const [regions, setRegions] = useState<EditableRegionItem[]>([]);
  const [originalById, setOriginalById] = useState<Map<number, EditableRegionItem>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);

  const changedCount = useMemo(() => {
    let count = 0;
    for (const row of regions) {
      const original = originalById.get(row.id);
      if (!original) continue;

      if (
        original.recruitCount !== row.recruitCount ||
        original.recruitCountCareer !== row.recruitCountCareer
      ) {
        count += 1;
      }
    }
    return count;
  }, [regions, originalById]);

  async function loadRegions() {
    setIsLoading(true);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/regions", {
        method: "GET",
        cache: "no-store",
      });
      const data = (await response.json()) as RegionsResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "모집인원 목록을 불러오지 못했습니다.");
      }

      const nextRows = (data.regions ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        recruitCount: item.recruitCount,
        recruitCountCareer: item.recruitCountCareer,
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
  }

  useEffect(() => {
    void loadRegions();
  }, []);

  function updateRegionValue(id: number, field: "recruitCount" | "recruitCountCareer", value: string) {
    setRegions((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              [field]: toSafeNonNegativeInt(value),
            }
          : row
      )
    );
  }

  function isFieldChanged(row: EditableRegionItem, field: "recruitCount" | "recruitCountCareer"): boolean {
    const original = originalById.get(row.id);
    if (!original) return false;
    return original[field] !== row[field];
  }

  async function handleSaveAll() {
    if (regions.length === 0) {
      setNotice({ type: "error", message: "저장할 지역 데이터가 없습니다." });
      return;
    }

    if (changedCount < 1) {
      setNotice({ type: "error", message: "변경된 모집인원이 없습니다." });
      return;
    }

    const confirmed = window.confirm(
      "모집인원 변경 시 합격예측 결과에 즉시 반영됩니다. 저장하시겠습니까?"
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
          regions: regions.map((row) => ({
            id: row.id,
            recruitCount: row.recruitCount,
            recruitCountCareer: row.recruitCountCareer,
          })),
        }),
      });
      const data = (await response.json()) as { success?: boolean; message?: string; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "모집인원 저장에 실패했습니다.");
      }

      setNotice({
        type: "success",
        message: data.message ?? "모집인원이 저장되었습니다.",
      });
      setOriginalById(new Map(regions.map((row) => [row.id, { ...row }] as const)));
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "모집인원 저장에 실패했습니다.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">모집인원 관리</h1>
        <p className="mt-1 text-sm text-slate-600">
          합격배수 산출의 기준이 되는 지역별 선발인원을 관리합니다.
        </p>
      </header>

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">⚠ 모집인원 변경 시 합격예측 결과에 즉시 반영됩니다.</p>
        <p className="mt-1">변경 전 공고문의 정확한 수치를 확인해 주세요.</p>
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
        <p className="text-sm text-slate-600">모집인원 데이터를 불러오는 중입니다...</p>
      ) : regions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-600">
          등록된 지역이 없습니다.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-[980px] w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">지역</th>
                <th className="px-4 py-3">공채 모집인원</th>
                <th className="px-4 py-3">공채 합격배수</th>
                <th className="px-4 py-3">경행경채 모집인원</th>
                <th className="px-4 py-3">경행경채 합격배수</th>
                <th className="px-4 py-3">참여 현황</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {regions.map((row) => (
                <tr key={row.id} className="bg-white">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
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
                  </td>
                  <td className="px-4 py-3 text-slate-700">{getPassMultipleText(row.recruitCount)}</td>
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
                  </td>
                  <td className="px-4 py-3 text-slate-700">{getPassMultipleText(row.recruitCountCareer)}</td>
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
        <p className="text-sm text-slate-600">변경된 지역: {changedCount}개</p>
        <Button type="button" onClick={handleSaveAll} disabled={isLoading || isSaving || changedCount < 1}>
          {isSaving ? "저장 중..." : "전체 저장"}
        </Button>
      </div>
    </div>
  );
}
