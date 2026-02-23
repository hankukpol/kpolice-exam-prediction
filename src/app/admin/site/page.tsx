"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SITE_SETTING_DEFAULTS } from "@/lib/site-settings.constants";

type SettingValue = string | boolean | number | null;

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
  const format = (value: string | null) => {
    if (!value) return "Always";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Always";
    return new Intl.DateTimeFormat("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  };

  return `${format(startAt)} ~ ${format(endAt)}`;
}

function asNumber(value: SettingValue, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function asString(value: SettingValue, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: SettingValue, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeMode(value: string): "HYBRID" | "TRAFFIC_ONLY" | "CRON_ONLY" {
  const normalized = value.trim().toUpperCase();
  if (normalized === "TRAFFIC_ONLY") return "TRAFFIC_ONLY";
  if (normalized === "CRON_ONLY") return "CRON_ONLY";
  return "HYBRID";
}

function normalizeProfile(value: string): "BALANCED" | "CONSERVATIVE" | "AGGRESSIVE" {
  const normalized = value.trim().toUpperCase();
  if (normalized === "CONSERVATIVE") return "CONSERVATIVE";
  if (normalized === "AGGRESSIVE") return "AGGRESSIVE";
  return "BALANCED";
}

export default function AdminSitePage() {
  const [settings, setSettings] = useState<Record<string, SettingValue>>({
    ...SITE_SETTING_DEFAULTS,
  });
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingBasic, setIsSavingBasic] = useState(false);
  const [isSavingSystem, setIsSavingSystem] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);

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
      throw new Error(data.error ?? "Failed to load site settings.");
    }
    setSettings((prev) => ({ ...prev, ...data.settings }));
  }

  async function loadNotices() {
    const response = await fetch("/api/admin/notices", { method: "GET", cache: "no-store" });
    const data = (await response.json()) as NoticesResponse & { error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? "Failed to load notices.");
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
          message: error instanceof Error ? error.message : "Failed to initialize admin site page.",
        });
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  function updateSettingString(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function updateSettingBoolean(key: string, value: boolean) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function saveSettings(payload: Record<string, SettingValue>, successMessage: string) {
    const response = await fetch("/api/admin/site", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: payload }),
    });
    const data = (await response.json()) as { success?: boolean; error?: string };
    if (!response.ok || !data.success) {
      throw new Error(data.error ?? "Failed to save settings.");
    }
    setNotice({ type: "success", message: successMessage });
  }

  async function handleSaveBasicSettings() {
    const confirmed = window.confirm("Save basic settings?");
    if (!confirmed) return;

    setIsSavingBasic(true);
    setNotice(null);
    try {
      await saveSettings(
        {
          "site.title": asString(settings["site.title"]),
          "site.heroBadge": asString(settings["site.heroBadge"]),
          "site.heroTitle": asString(settings["site.heroTitle"]),
          "site.heroSubtitle": asString(settings["site.heroSubtitle"]),
          "site.footerDisclaimer": asString(settings["site.footerDisclaimer"]),
        },
        "Basic settings saved."
      );
      await loadSettings();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to save basic settings.",
      });
    } finally {
      setIsSavingBasic(false);
    }
  }

  async function handleSaveSystemSettings() {
    const confirmed = window.confirm("Save system settings?");
    if (!confirmed) return;

    setIsSavingSystem(true);
    setNotice(null);
    try {
      const refreshInterval = Math.floor(asNumber(settings["site.mainPageRefreshInterval"], 60));
      if (!Number.isFinite(refreshInterval) || refreshInterval < 10) {
        throw new Error("Main refresh interval must be 10 seconds or more.");
      }

      const submissionEditLimit = Math.floor(asNumber(settings["site.submissionEditLimit"], 3));
      if (!Number.isFinite(submissionEditLimit) || submissionEditLimit < 0) {
        throw new Error("Submission edit limit must be 0 or more.");
      }

      const autoPassCutCheckIntervalSec = Math.floor(
        asNumber(settings["site.autoPassCutCheckIntervalSec"], 300)
      );
      if (!Number.isFinite(autoPassCutCheckIntervalSec) || autoPassCutCheckIntervalSec < 30) {
        throw new Error("Auto pass-cut check interval must be 30 seconds or more.");
      }

      const autoPassCutMode = normalizeMode(asString(settings["site.autoPassCutMode"], "HYBRID"));
      const autoPassCutThresholdProfile = normalizeProfile(
        asString(settings["site.autoPassCutThresholdProfile"], "BALANCED")
      );
      const autoPassCutReadyRatioProfile = normalizeProfile(
        asString(settings["site.autoPassCutReadyRatioProfile"], "BALANCED")
      );

      await saveSettings(
        {
          "site.careerExamEnabled": asBoolean(settings["site.careerExamEnabled"], true),
          "site.maintenanceMode": asBoolean(settings["site.maintenanceMode"], false),
          "site.maintenanceMessage": asString(settings["site.maintenanceMessage"]),
          "site.mainPageAutoRefresh": asBoolean(settings["site.mainPageAutoRefresh"], true),
          "site.mainPageRefreshInterval": String(refreshInterval),
          "site.mainCardOverviewEnabled": asBoolean(settings["site.mainCardOverviewEnabled"], true),
          "site.mainCardDifficultyEnabled": asBoolean(
            settings["site.mainCardDifficultyEnabled"],
            true
          ),
          "site.mainCardCompetitiveEnabled": asBoolean(
            settings["site.mainCardCompetitiveEnabled"],
            true
          ),
          "site.mainCardScoreDistributionEnabled": asBoolean(
            settings["site.mainCardScoreDistributionEnabled"],
            true
          ),
          "site.submissionEditLimit": submissionEditLimit,
          "site.finalPredictionEnabled": asBoolean(settings["site.finalPredictionEnabled"], false),
          "site.autoPassCutEnabled": asBoolean(settings["site.autoPassCutEnabled"], false),
          "site.autoPassCutMode": autoPassCutMode,
          "site.autoPassCutCheckIntervalSec": autoPassCutCheckIntervalSec,
          "site.autoPassCutThresholdProfile": autoPassCutThresholdProfile,
          "site.autoPassCutReadyRatioProfile": autoPassCutReadyRatioProfile,
        },
        "System settings saved."
      );
      await loadSettings();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to save system settings.",
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
    setNotice(null);

    try {
      if (!noticeTitle.trim()) {
        throw new Error("Notice title is required.");
      }
      if (!noticeContent.trim()) {
        throw new Error("Notice content is required.");
      }

      const confirmed = window.confirm(
        editingNoticeId ? "Update this notice?" : "Create this notice?"
      );
      if (!confirmed) return;

      setIsSavingNotice(true);
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
        throw new Error(data.error ?? "Failed to save notice.");
      }

      setNotice({
        type: "success",
        message: editingNoticeId ? "Notice updated." : "Notice created.",
      });
      resetNoticeForm();
      await loadNotices();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to save notice.",
      });
    } finally {
      setIsSavingNotice(false);
    }
  }

  async function handleDeleteNotice(id: number) {
    const confirmed = window.confirm("Delete this notice?");
    if (!confirmed) return;

    setNotice(null);
    try {
      const response = await fetch(`/api/admin/notices?id=${id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Failed to delete notice.");
      }

      setNotice({
        type: "success",
        message: "Notice deleted.",
      });
      if (editingNoticeId === id) {
        resetNoticeForm();
      }
      await loadNotices();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to delete notice.",
      });
    }
  }

  if (isLoading) {
    return <p className="text-sm text-slate-600">Loading admin site settings...</p>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Site Admin</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage copy, notices, system flags, and auto pass-cut behavior.
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Banner assets are managed in{" "}
          <Link href="/admin/banners" className="font-semibold text-slate-800 underline">
            Banner Admin
          </Link>
          .
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

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">Basic Settings</h2>

        <div className="space-y-2">
          <Label htmlFor="site-title">Site Title</Label>
          <Input
            id="site-title"
            value={asString(settings["site.title"])}
            onChange={(event) => updateSettingString("site.title", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hero-badge">Hero Badge</Label>
          <Input
            id="hero-badge"
            value={asString(settings["site.heroBadge"])}
            onChange={(event) => updateSettingString("site.heroBadge", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hero-title">Hero Title</Label>
          <textarea
            id="hero-title"
            value={asString(settings["site.heroTitle"])}
            onChange={(event) => updateSettingString("site.heroTitle", event.target.value)}
            className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hero-subtitle">Hero Subtitle</Label>
          <textarea
            id="hero-subtitle"
            value={asString(settings["site.heroSubtitle"])}
            onChange={(event) => updateSettingString("site.heroSubtitle", event.target.value)}
            className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="footer-disclaimer">Footer Disclaimer</Label>
          <textarea
            id="footer-disclaimer"
            value={asString(settings["site.footerDisclaimer"])}
            onChange={(event) => updateSettingString("site.footerDisclaimer", event.target.value)}
            className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <Button type="button" onClick={handleSaveBasicSettings} disabled={isSavingBasic}>
          {isSavingBasic ? "Saving..." : "Save Basic Settings"}
        </Button>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Notice Management</h2>
          <Button type="button" variant="outline" onClick={resetNoticeForm}>
            + New Notice
          </Button>
        </div>

        <form
          className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
          onSubmit={handleSubmitNotice}
        >
          <div className="space-y-2">
            <Label htmlFor="notice-title">Title</Label>
            <Input
              id="notice-title"
              value={noticeTitle}
              onChange={(event) => setNoticeTitle(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notice-content">Content</Label>
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
              <Label htmlFor="notice-priority">Priority</Label>
              <Input
                id="notice-priority"
                type="number"
                value={noticePriority}
                onChange={(event) => setNoticePriority(Number(event.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notice-start">Start</Label>
              <Input
                id="notice-start"
                type="datetime-local"
                value={noticeStartAt}
                onChange={(event) => setNoticeStartAt(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notice-end">End</Label>
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
            Active
          </label>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={isSavingNotice}>
              {isSavingNotice ? "Saving..." : editingNoticeId ? "Update Notice" : "Create Notice"}
            </Button>
            {editingNoticeId ? (
              <Button type="button" variant="outline" onClick={resetNoticeForm} disabled={isSavingNotice}>
                Reset Form
              </Button>
            ) : null}
          </div>
        </form>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Schedule</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedNotices.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-600" colSpan={5}>
                    No notices.
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
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {toDateRangeText(item.startAt, item.endAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => startEditNotice(item)}>
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-rose-600 hover:text-rose-700"
                          onClick={() => void handleDeleteNotice(item.id)}
                        >
                          Delete
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
        <h2 className="text-base font-semibold text-slate-900">System Settings</h2>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={asBoolean(settings["site.careerExamEnabled"], true)}
            onChange={(event) => updateSettingBoolean("site.careerExamEnabled", event.target.checked)}
          />
          Enable career exam flow
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={asBoolean(settings["site.maintenanceMode"], false)}
            onChange={(event) => updateSettingBoolean("site.maintenanceMode", event.target.checked)}
          />
          Maintenance mode
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={asBoolean(settings["site.mainPageAutoRefresh"], true)}
            onChange={(event) => updateSettingBoolean("site.mainPageAutoRefresh", event.target.checked)}
          />
          Main page auto refresh
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={asBoolean(settings["site.finalPredictionEnabled"], false)}
            onChange={(event) => updateSettingBoolean("site.finalPredictionEnabled", event.target.checked)}
          />
          Enable final prediction publish
        </label>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Auto Pass-Cut Release</p>
          <p className="mt-1 text-xs text-slate-500">
            HYBRID mode runs both cron checks and traffic-entry fallback checks.
          </p>
          <div className="mt-3 space-y-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={asBoolean(settings["site.autoPassCutEnabled"], false)}
                onChange={(event) => updateSettingBoolean("site.autoPassCutEnabled", event.target.checked)}
              />
              Enable auto release
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="auto-pass-cut-mode">Mode</Label>
                <select
                  id="auto-pass-cut-mode"
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  value={asString(settings["site.autoPassCutMode"], "HYBRID")}
                  onChange={(event) => updateSettingString("site.autoPassCutMode", event.target.value)}
                >
                  <option value="HYBRID">HYBRID</option>
                  <option value="TRAFFIC_ONLY">TRAFFIC_ONLY</option>
                  <option value="CRON_ONLY">CRON_ONLY</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="auto-pass-cut-interval">Check interval (sec)</Label>
                <Input
                  id="auto-pass-cut-interval"
                  type="number"
                  min={30}
                  value={String(asNumber(settings["site.autoPassCutCheckIntervalSec"], 300))}
                  onChange={(event) =>
                    updateSettingString("site.autoPassCutCheckIntervalSec", event.target.value)
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="auto-pass-cut-threshold-profile">Row threshold profile</Label>
                <select
                  id="auto-pass-cut-threshold-profile"
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  value={asString(settings["site.autoPassCutThresholdProfile"], "BALANCED")}
                  onChange={(event) =>
                    updateSettingString("site.autoPassCutThresholdProfile", event.target.value)
                  }
                >
                  <option value="BALANCED">BALANCED</option>
                  <option value="CONSERVATIVE">CONSERVATIVE</option>
                  <option value="AGGRESSIVE">AGGRESSIVE</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="auto-pass-cut-ready-ratio-profile">Ready ratio profile</Label>
                <select
                  id="auto-pass-cut-ready-ratio-profile"
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  value={asString(settings["site.autoPassCutReadyRatioProfile"], "BALANCED")}
                  onChange={(event) =>
                    updateSettingString("site.autoPassCutReadyRatioProfile", event.target.value)
                  }
                >
                  <option value="BALANCED">BALANCED</option>
                  <option value="CONSERVATIVE">CONSERVATIVE</option>
                  <option value="AGGRESSIVE">AGGRESSIVE</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Main Cards Visibility</p>
          <div className="mt-3 space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={asBoolean(settings["site.mainCardOverviewEnabled"], true)}
                onChange={(event) => updateSettingBoolean("site.mainCardOverviewEnabled", event.target.checked)}
              />
              Overview card
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={asBoolean(settings["site.mainCardDifficultyEnabled"], true)}
                onChange={(event) =>
                  updateSettingBoolean("site.mainCardDifficultyEnabled", event.target.checked)
                }
              />
              Difficulty survey card
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={asBoolean(settings["site.mainCardCompetitiveEnabled"], true)}
                onChange={(event) =>
                  updateSettingBoolean("site.mainCardCompetitiveEnabled", event.target.checked)
                }
              />
              Competitive top5 card
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={asBoolean(settings["site.mainCardScoreDistributionEnabled"], true)}
                onChange={(event) =>
                  updateSettingBoolean("site.mainCardScoreDistributionEnabled", event.target.checked)
                }
              />
              Score distribution card
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="main-refresh-interval">Main refresh interval (sec)</Label>
          <Input
            id="main-refresh-interval"
            type="number"
            min={10}
            value={String(asString(settings["site.mainPageRefreshInterval"], "60"))}
            onChange={(event) => updateSettingString("site.mainPageRefreshInterval", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="submission-edit-limit">Submission edit limit (0 = locked)</Label>
          <Input
            id="submission-edit-limit"
            type="number"
            min={0}
            value={String(asNumber(settings["site.submissionEditLimit"], 3))}
            onChange={(event) => updateSettingString("site.submissionEditLimit", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="maintenance-message">Maintenance message</Label>
          <Input
            id="maintenance-message"
            value={asString(settings["site.maintenanceMessage"])}
            onChange={(event) => updateSettingString("site.maintenanceMessage", event.target.value)}
          />
        </div>

        <Button type="button" onClick={handleSaveSystemSettings} disabled={isSavingSystem}>
          {isSavingSystem ? "Saving..." : "Save System Settings"}
        </Button>
      </section>
    </div>
  );
}
