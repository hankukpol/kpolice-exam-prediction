"use client";

import Link from "next/link";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type BannerZone = "hero" | "middle" | "bottom";

interface BannerItem {
  id: number;
  zone: BannerZone;
  imageUrl: string;
  linkUrl: string | null;
  altText: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface BannersResponse {
  banners: BannerItem[];
}

interface ZoneFormState {
  id: number | null;
  imageUrl: string | null;
  linkUrl: string;
  altText: string;
  isActive: boolean;
  sortOrder: number;
  file: File | null;
}

type NoticeState =
  | {
      type: "success" | "error";
      message: string;
    }
  | null;

const ZONE_ORDER: BannerZone[] = ["hero", "middle", "bottom"];

const ZONE_LABELS: Record<BannerZone, string> = {
  hero: "배너존 A: 상단 히어로",
  middle: "배너존 B: 중간 프로모션",
  bottom: "배너존 C: 하단 CTA",
};

const ZONE_HINTS: Record<BannerZone, string> = {
  hero: "권장 해상도 1920×600~800px",
  middle: "권장 해상도 1920×300~500px",
  bottom: "권장 해상도 1920×300~500px",
};

function createEmptyZoneState(sortOrder = 0): ZoneFormState {
  return {
    id: null,
    imageUrl: null,
    linkUrl: "",
    altText: "",
    isActive: true,
    sortOrder,
    file: null,
  };
}

function toZoneState(banner: BannerItem | undefined): ZoneFormState {
  if (!banner) return createEmptyZoneState();
  return {
    id: banner.id,
    imageUrl: banner.imageUrl,
    linkUrl: banner.linkUrl ?? "",
    altText: banner.altText,
    isActive: banner.isActive,
    sortOrder: banner.sortOrder,
    file: null,
  };
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export default function AdminBannersPage() {
  const [allBanners, setAllBanners] = useState<BannerItem[]>([]);
  const [zoneStates, setZoneStates] = useState<Record<BannerZone, ZoneFormState>>({
    hero: createEmptyZoneState(),
    middle: createEmptyZoneState(),
    bottom: createEmptyZoneState(),
  });
  const [isLoading, setIsLoading] = useState(true);
  const [savingZone, setSavingZone] = useState<BannerZone | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);

  const hasAnyBanner = useMemo(() => allBanners.length > 0, [allBanners.length]);

  async function loadBanners() {
    setIsLoading(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/banners", {
        method: "GET",
        cache: "no-store",
      });
      const data = (await response.json()) as BannersResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "배너 목록을 불러오지 못했습니다.");
      }

      const sorted = [...(data.banners ?? [])].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.id - b.id
      );
      setAllBanners(sorted);

      const primaryByZone: Partial<Record<BannerZone, BannerItem>> = {};
      for (const zone of ZONE_ORDER) {
        primaryByZone[zone] = sorted.find((item) => item.zone === zone);
      }

      setZoneStates({
        hero: toZoneState(primaryByZone.hero),
        middle: toZoneState(primaryByZone.middle),
        bottom: toZoneState(primaryByZone.bottom),
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "배너 목록을 불러오지 못했습니다.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadBanners();
  }, []);

  function bannersByZone(zone: BannerZone) {
    return allBanners.filter((item) => item.zone === zone);
  }

  function setCreateMode(zone: BannerZone) {
    const nextSort = bannersByZone(zone).length;
    setZoneStates((prev) => ({
      ...prev,
      [zone]: createEmptyZoneState(nextSort),
    }));
  }

  function setEditMode(zone: BannerZone, banner: BannerItem) {
    setZoneStates((prev) => ({
      ...prev,
      [zone]: toZoneState(banner),
    }));
  }

  function updateZoneState(zone: BannerZone, next: Partial<ZoneFormState>) {
    setZoneStates((prev) => ({
      ...prev,
      [zone]: {
        ...prev[zone],
        ...next,
      },
    }));
  }

  function handleFileChange(zone: BannerZone, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    updateZoneState(zone, { file });
  }

  async function handleSaveZone(zone: BannerZone) {
    const current = zoneStates[zone];
    if (!current.id && !current.file) {
      setNotice({
        type: "error",
        message: `${ZONE_LABELS[zone]}은 새 등록 시 이미지 파일이 필요합니다.`,
      });
      return;
    }

    const confirmed = window.confirm(
      current.id
        ? `${ZONE_LABELS[zone]} 배너를 저장하시겠습니까?`
        : `${ZONE_LABELS[zone]} 배너를 등록하시겠습니까?`
    );
    if (!confirmed) return;

    setSavingZone(zone);
    setNotice(null);

    try {
      const formData = new FormData();
      formData.append("zone", zone);
      formData.append("linkUrl", current.linkUrl.trim());
      formData.append("altText", current.altText.trim());
      formData.append("isActive", String(current.isActive));
      formData.append("sortOrder", String(current.sortOrder));
      if (current.file) {
        formData.append("image", current.file);
      }

      const endpoint = current.id ? `/api/admin/banners?id=${current.id}` : "/api/admin/banners";
      const method = current.id ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        body: formData,
      });
      const data = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "배너 저장에 실패했습니다.");
      }

      setNotice({
        type: "success",
        message: `${ZONE_LABELS[zone]} 저장이 완료되었습니다.`,
      });
      await loadBanners();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "배너 저장에 실패했습니다.",
      });
    } finally {
      setSavingZone(null);
    }
  }

  async function handleDeleteBanner(id: number) {
    const confirmed = window.confirm("선택한 배너를 삭제하시겠습니까?");
    if (!confirmed) return;

    setDeletingId(id);
    setNotice(null);

    try {
      const response = await fetch(`/api/admin/banners?id=${id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "배너 삭제에 실패했습니다.");
      }

      setNotice({
        type: "success",
        message: "배너가 삭제되었습니다.",
      });
      await loadBanners();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "배너 삭제에 실패했습니다.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-slate-600">배너 관리 데이터를 불러오는 중입니다...</p>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">배너 관리</h1>
        <p className="mt-1 text-sm text-slate-600">
          존별로 배너를 다중 등록하고 정렬 순서/활성 상태를 운영할 수 있습니다.
        </p>
        <p className="mt-1 text-sm text-slate-600">
          이벤트/공지는 <Link className="font-semibold underline" href="/admin/events">이벤트 관리</Link>,{" "}
          <Link className="font-semibold underline" href="/admin/site">사이트 설정</Link>에서 함께 운영하세요.
        </p>
      </header>

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

      {!hasAnyBanner ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          등록된 배너가 없습니다. 상단 히어로는 사이트 기본 설정 텍스트로 표시됩니다.
        </p>
      ) : null}

      {ZONE_ORDER.map((zone) => {
        const current = zoneStates[zone];
        const isSaving = savingZone === zone;
        const zoneBannerList = bannersByZone(zone);

        return (
          <section key={zone} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{ZONE_LABELS[zone]}</h2>
                <p className="text-xs text-slate-500">{ZONE_HINTS[zone]}</p>
              </div>
              <Button type="button" variant="outline" onClick={() => setCreateMode(zone)}>
                + 새 배너 등록 모드
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-slate-700">편집 대상 이미지 {current.id ? `(ID ${current.id})` : "(신규)"}</p>
              {current.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={current.imageUrl}
                  alt={current.altText || `${ZONE_LABELS[zone]} 배너`}
                  className="max-h-56 w-full rounded-lg border border-slate-200 object-contain"
                />
              ) : (
                <p className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                  등록된 배너가 없습니다.
                </p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${zone}-link-url`}>링크 URL (선택)</Label>
                <Input
                  id={`${zone}-link-url`}
                  value={current.linkUrl}
                  onChange={(event) => updateZoneState(zone, { linkUrl: event.target.value })}
                  placeholder="https://example.com 또는 /path"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${zone}-alt-text`}>대체 텍스트</Label>
                <Input
                  id={`${zone}-alt-text`}
                  value={current.altText}
                  onChange={(event) => updateZoneState(zone, { altText: event.target.value })}
                  placeholder={`${ZONE_LABELS[zone]} 이미지`}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${zone}-sort-order`}>정렬 순서</Label>
                <Input
                  id={`${zone}-sort-order`}
                  type="number"
                  min={0}
                  step={1}
                  value={current.sortOrder}
                  onChange={(event) =>
                    updateZoneState(zone, { sortOrder: Math.max(0, Number(event.target.value) || 0) })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${zone}-file`}>이미지 업로드 (jpg/png/webp, 5MB 이하)</Label>
                <Input
                  id={`${zone}-file`}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={(event) => handleFileChange(zone, event)}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={current.isActive}
                onChange={(event) => updateZoneState(zone, { isActive: event.target.checked })}
              />
              활성화
            </label>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void handleSaveZone(zone)} disabled={isSaving}>
                {isSaving ? "저장 중..." : "저장"}
              </Button>
              {current.id ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleDeleteBanner(current.id as number)}
                  disabled={deletingId === current.id}
                >
                  {deletingId === current.id ? "삭제 중..." : "현재 편집 배너 삭제"}
                </Button>
              ) : null}
            </div>

            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">
                등록된 배너 목록 ({zoneBannerList.length})
              </p>
              {zoneBannerList.length < 1 ? (
                <p className="text-sm text-slate-500">등록된 배너가 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {zoneBannerList.map((banner) => (
                    <div
                      key={banner.id}
                      className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={banner.imageUrl}
                          alt={banner.altText || "배너"}
                          className="h-14 w-24 rounded-md border border-slate-200 object-cover"
                        />
                        <div className="text-xs text-slate-600">
                          <p>ID #{banner.id}</p>
                          <p>정렬 {banner.sortOrder}</p>
                          <p>{banner.isActive ? "활성" : "비활성"} · {formatDateTime(banner.updatedAt)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => setEditMode(zone, banner)}>
                          폼 불러오기
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-rose-600 hover:text-rose-700"
                          onClick={() => void handleDeleteBanner(banner.id)}
                          disabled={deletingId === banner.id}
                        >
                          삭제
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
