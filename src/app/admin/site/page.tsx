"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SITE_SETTING_DEFAULTS } from "@/lib/site-settings.constants";

type SettingValue = string | boolean | null;

interface SiteSettingsResponse {
  settings: Record<string, SettingValue>;
}

interface NoticeItem {
  id: number;
  title: string;
  content: string;
  isActive: boolean;
  priority: number;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface NoticesResponse {
  notices: NoticeItem[];
}

type NoticeState = {
  type: "success" | "error";
  message: string;
} | null;

function toDateTimeLocalInput(isoText: string | null): string {
  if (!isoText) return "";
  const date = new Date(isoText);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function toDateRangeText(startAt: string | null, endAt: string | null): string {
  const start = startAt ? new Date(startAt) : null;
  const end = endAt ? new Date(endAt) : null;

  const format = (date: Date | null) => {
    if (!date || Number.isNaN(date.getTime())) return "무기한";
    return new Intl.DateTimeFormat("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  };

  return `${format(start)} ~ ${format(end)}`;
}

export default function AdminSitePage() {
  const [settings, setSettings] = useState<Record<string, SettingValue>>({ ...SITE_SETTING_DEFAULTS });
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingBasic, setIsSavingBasic] = useState(false);
  const [isSavingBanner, setIsSavingBanner] = useState(false);
  const [isSavingSystem, setIsSavingSystem] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);

  const [bannerFile, setBannerFile] = useState<File | null>(null);

  const [editingNoticeId, setEditingNoticeId] = useState<number | null>(null);
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeContent, setNoticeContent] = useState("");
  const [noticeIsActive, setNoticeIsActive] = useState(true);
  const [noticePriority, setNoticePriority] = useState(0);
  const [noticeStartAt, setNoticeStartAt] = useState("");
  const [noticeEndAt, setNoticeEndAt] = useState("");
  const [isSavingNotice, setIsSavingNotice] = useState(false);

  const sortedNotices = useMemo(() => {
    return [...notices].sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return b.id - a.id;
    });
  }, [notices]);

  async function loadSettings() {
    const response = await fetch("/api/admin/site", { method: "GET", cache: "no-store" });
    const data = (await response.json()) as SiteSettingsResponse & { error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? "사이트 설정을 불러오지 못했습니다.");
    }
    setSettings((prev) => ({
      ...prev,
      ...data.settings,
    }));
  }

  async function loadNotices() {
    const response = await fetch("/api/admin/notices", { method: "GET", cache: "no-store" });
    const data = (await response.json()) as NoticesResponse & { error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? "공지 목록을 불러오지 못했습니다.");
    }
    setNotices(data.notices ?? []);
  }

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setNotice(null);
      try {
        await Promise.all([loadSettings(), loadNotices()]);
      } catch (error) {
        setNotice({
          type: "error",
          message: error instanceof Error ? error.message : "초기 데이터 로딩 중 오류가 발생했습니다.",
        });
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  function updateSettingString(key: string, value: string) {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function updateSettingBoolean(key: string, value: boolean) {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function saveSettings(payload: Record<string, SettingValue>, successMessage: string) {
    const response = await fetch("/api/admin/site", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: payload }),
    });
    const data = (await response.json()) as { success?: boolean; error?: string };
    if (!response.ok || !data.success) {
      throw new Error(data.error ?? "사이트 설정 저장에 실패했습니다.");
    }

    setNotice({
      type: "success",
      message: successMessage,
    });
  }

  async function handleSaveBasicSettings() {
    setIsSavingBasic(true);
    setNotice(null);
    try {
      await saveSettings(
        {
          "site.title": String(settings["site.title"] ?? ""),
          "site.heroBadge": String(settings["site.heroBadge"] ?? ""),
          "site.heroTitle": String(settings["site.heroTitle"] ?? ""),
          "site.heroSubtitle": String(settings["site.heroSubtitle"] ?? ""),
          "site.footerDisclaimer": String(settings["site.footerDisclaimer"] ?? ""),
        },
        "기본 설정이 저장되었습니다."
      );
      await loadSettings();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "기본 설정 저장에 실패했습니다.",
      });
    } finally {
      setIsSavingBasic(false);
    }
  }

  async function handleSaveBannerSettings() {
    setIsSavingBanner(true);
    setNotice(null);

    try {
      let bannerImageUrl = settings["site.bannerImageUrl"] as string | null;

      if (bannerFile) {
        const formData = new FormData();
        formData.append("file", bannerFile);

        const uploadResponse = await fetch("/api/admin/site/upload", {
          method: "POST",
          body: formData,
        });
        const uploadData = (await uploadResponse.json()) as { success?: boolean; url?: string; error?: string };
        if (!uploadResponse.ok || !uploadData.success || !uploadData.url) {
          throw new Error(uploadData.error ?? "배너 이미지 업로드에 실패했습니다.");
        }

        bannerImageUrl = uploadData.url;
      }

      await saveSettings(
        {
          "site.bannerImageUrl": bannerImageUrl,
          "site.bannerLink": (settings["site.bannerLink"] as string | null) ?? null,
        },
        "배너 설정이 저장되었습니다."
      );
      setBannerFile(null);
      await loadSettings();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "배너 설정 저장에 실패했습니다.",
      });
    } finally {
      setIsSavingBanner(false);
    }
  }

  async function handleDeleteBanner() {
    const confirmed = window.confirm("배너 이미지를 삭제하시겠습니까?");
    if (!confirmed) return;

    setIsSavingBanner(true);
    setNotice(null);
    try {
      await saveSettings(
        {
          "site.bannerImageUrl": null,
          "site.bannerLink": null,
        },
        "배너 설정이 삭제되었습니다."
      );
      setBannerFile(null);
      await loadSettings();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "배너 삭제에 실패했습니다.",
      });
    } finally {
      setIsSavingBanner(false);
    }
  }

  async function handleSaveSystemSettings() {
    setIsSavingSystem(true);
    setNotice(null);
    try {
      await saveSettings(
        {
          "site.maintenanceMode": Boolean(settings["site.maintenanceMode"]),
          "site.maintenanceMessage": String(settings["site.maintenanceMessage"] ?? ""),
        },
        "시스템 설정이 저장되었습니다."
      );
      await loadSettings();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "시스템 설정 저장에 실패했습니다.",
      });
    } finally {
      setIsSavingSystem(false);
    }
  }

  function resetNoticeForm() {
    setEditingNoticeId(null);
    setNoticeTitle("");
    setNoticeContent("");
    setNoticeIsActive(true);
    setNoticePriority(0);
    setNoticeStartAt("");
    setNoticeEndAt("");
  }

  function startEditNotice(item: NoticeItem) {
    setEditingNoticeId(item.id);
    setNoticeTitle(item.title);
    setNoticeContent(item.content);
    setNoticeIsActive(item.isActive);
    setNoticePriority(item.priority);
    setNoticeStartAt(toDateTimeLocalInput(item.startAt));
    setNoticeEndAt(toDateTimeLocalInput(item.endAt));
  }

  async function handleSubmitNotice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingNotice(true);
    setNotice(null);

    try {
      if (!noticeTitle.trim()) {
        throw new Error("공지 제목을 입력해 주세요.");
      }
      if (!noticeContent.trim()) {
        throw new Error("공지 내용을 입력해 주세요.");
      }

      const payload = {
        title: noticeTitle.trim(),
        content: noticeContent.trim(),
        isActive: noticeIsActive,
        priority: noticePriority,
        startAt: noticeStartAt ? new Date(noticeStartAt).toISOString() : null,
        endAt: noticeEndAt ? new Date(noticeEndAt).toISOString() : null,
      };

      const endpoint = editingNoticeId
        ? `/api/admin/notices?id=${editingNoticeId}`
        : "/api/admin/notices";
      const method = editingNoticeId ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "공지 저장에 실패했습니다.");
      }

      setNotice({
        type: "success",
        message: editingNoticeId ? "공지사항이 수정되었습니다." : "공지사항이 등록되었습니다.",
      });
      resetNoticeForm();
      await loadNotices();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "공지 저장에 실패했습니다.",
      });
    } finally {
      setIsSavingNotice(false);
    }
  }

  async function handleDeleteNotice(id: number) {
    const confirmed = window.confirm("공지사항을 삭제하시겠습니까?");
    if (!confirmed) return;

    setNotice(null);
    try {
      const response = await fetch(`/api/admin/notices?id=${id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "공지 삭제에 실패했습니다.");
      }

      setNotice({
        type: "success",
        message: "공지사항이 삭제되었습니다.",
      });
      if (editingNoticeId === id) {
        resetNoticeForm();
      }
      await loadNotices();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "공지 삭제에 실패했습니다.",
      });
    }
  }

  function handleBannerFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setBannerFile(file);
  }

  if (isLoading) {
    return <p className="text-sm text-slate-600">사이트 관리 데이터를 불러오는 중입니다...</p>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">사이트 관리</h1>
        <p className="mt-1 text-sm text-slate-600">메인 문구, 배너, 공지사항, 점검 모드를 관리합니다.</p>
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

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">기본 설정</h2>

        <div className="space-y-2">
          <Label htmlFor="site-title">사이트명</Label>
          <Input
            id="site-title"
            value={String(settings["site.title"] ?? "")}
            onChange={(event) => updateSettingString("site.title", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hero-badge">히어로 배지</Label>
          <Input
            id="hero-badge"
            value={String(settings["site.heroBadge"] ?? "")}
            onChange={(event) => updateSettingString("site.heroBadge", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hero-title">히어로 제목</Label>
          <textarea
            id="hero-title"
            value={String(settings["site.heroTitle"] ?? "")}
            onChange={(event) => updateSettingString("site.heroTitle", event.target.value)}
            className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hero-subtitle">히어로 설명</Label>
          <textarea
            id="hero-subtitle"
            value={String(settings["site.heroSubtitle"] ?? "")}
            onChange={(event) => updateSettingString("site.heroSubtitle", event.target.value)}
            className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="footer-disclaimer">푸터 면책조항</Label>
          <textarea
            id="footer-disclaimer"
            value={String(settings["site.footerDisclaimer"] ?? "")}
            onChange={(event) => updateSettingString("site.footerDisclaimer", event.target.value)}
            className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <Button type="button" onClick={handleSaveBasicSettings} disabled={isSavingBasic}>
          {isSavingBasic ? "저장 중..." : "기본 설정 저장"}
        </Button>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">배너 관리</h2>

        <div className="space-y-2">
          <p className="text-sm text-slate-700">현재 배너</p>
          {settings["site.bannerImageUrl"] ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={String(settings["site.bannerImageUrl"])}
                alt="현재 배너"
                className="max-h-44 rounded-lg border border-slate-200 object-contain"
              />
            </>
          ) : (
            <p className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
              설정된 배너가 없습니다.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="banner-link">배너 링크</Label>
          <Input
            id="banner-link"
            value={String(settings["site.bannerLink"] ?? "")}
            onChange={(event) => updateSettingString("site.bannerLink", event.target.value)}
            placeholder="https://example.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="banner-file">이미지 업로드 (jpg, png, webp / 2MB 이하)</Label>
          <Input id="banner-file" type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handleBannerFileChange} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={handleSaveBannerSettings} disabled={isSavingBanner}>
            {isSavingBanner ? "저장 중..." : "배너 저장"}
          </Button>
          <Button type="button" variant="outline" onClick={handleDeleteBanner} disabled={isSavingBanner}>
            배너 삭제
          </Button>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">공지사항 관리</h2>
          <Button type="button" variant="outline" onClick={resetNoticeForm}>
            + 새 공지 등록
          </Button>
        </div>

        <form className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4" onSubmit={handleSubmitNotice}>
          <div className="space-y-2">
            <Label htmlFor="notice-title">공지 제목</Label>
            <Input
              id="notice-title"
              value={noticeTitle}
              onChange={(event) => setNoticeTitle(event.target.value)}
              placeholder="예: 시험 일정 안내"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notice-content">공지 내용</Label>
            <textarea
              id="notice-content"
              value={noticeContent}
              onChange={(event) => setNoticeContent(event.target.value)}
              className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="notice-priority">우선순위</Label>
              <Input
                id="notice-priority"
                type="number"
                value={noticePriority}
                onChange={(event) => setNoticePriority(Number(event.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notice-start">표시 시작일</Label>
              <Input
                id="notice-start"
                type="datetime-local"
                value={noticeStartAt}
                onChange={(event) => setNoticeStartAt(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notice-end">표시 종료일</Label>
              <Input
                id="notice-end"
                type="datetime-local"
                value={noticeEndAt}
                onChange={(event) => setNoticeEndAt(event.target.value)}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={noticeIsActive}
              onChange={(event) => setNoticeIsActive(event.target.checked)}
            />
            활성 공지로 표시
          </label>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={isSavingNotice}>
              {isSavingNotice ? "저장 중..." : editingNoticeId ? "공지 수정" : "공지 등록"}
            </Button>
            {editingNoticeId ? (
              <Button type="button" variant="outline" onClick={resetNoticeForm} disabled={isSavingNotice}>
                입력 초기화
              </Button>
            ) : null}
          </div>
        </form>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">제목</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">표시 기간</th>
                <th className="px-4 py-3 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedNotices.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-600" colSpan={5}>
                    등록된 공지가 없습니다.
                  </td>
                </tr>
              ) : (
                sortedNotices.map((item) => (
                  <tr key={item.id} className="bg-white">
                    <td className="px-4 py-3 text-slate-700">{item.id}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{item.title}</p>
                      <p className="mt-1 line-clamp-1 text-xs text-slate-600">{item.content}</p>
                    </td>
                    <td className="px-4 py-3">
                      {item.isActive ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                          활성
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                          비활성
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{toDateRangeText(item.startAt, item.endAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => startEditNotice(item)}>
                          수정
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-rose-600 hover:text-rose-700"
                          onClick={() => void handleDeleteNotice(item.id)}
                        >
                          삭제
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">시스템 설정</h2>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={Boolean(settings["site.maintenanceMode"])}
            onChange={(event) => updateSettingBoolean("site.maintenanceMode", event.target.checked)}
          />
          점검 모드 활성화 (체크 시 사용자 접근 제한)
        </label>

        <div className="space-y-2">
          <Label htmlFor="maintenance-message">점검 메시지</Label>
          <Input
            id="maintenance-message"
            value={String(settings["site.maintenanceMessage"] ?? "")}
            onChange={(event) => updateSettingString("site.maintenanceMessage", event.target.value)}
          />
        </div>

        <Button type="button" onClick={handleSaveSystemSettings} disabled={isSavingSystem}>
          {isSavingSystem ? "저장 중..." : "시스템 설정 저장"}
        </Button>
      </section>
    </div>
  );
}
