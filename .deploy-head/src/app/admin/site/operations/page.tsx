"use client";

import { useEffect, useState } from "react";
import ConfirmModal from "@/components/admin/ConfirmModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import useConfirmModal from "@/hooks/useConfirmModal";
import {
  asBoolean,
  asNumber,
  asString,
  loadSettings,
  saveSettings,
  type SettingValue,
  type SiteSettingsMap,
} from "../_lib/site-settings-client";

type NoticeState = {
  type: "success" | "error";
  message: string;
} | null;

export default function AdminSiteOperationsTabPage() {
  const [settings, setSettings] = useState<SiteSettingsMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);
  const { confirm, modalProps } = useConfirmModal();

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setNotice(null);
      try {
        setSettings(await loadSettings());
      } catch (error) {
        setNotice({
          type: "error",
          message: error instanceof Error ? error.message : "운영 설정을 불러오지 못했습니다.",
        });
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  function updateSettingBoolean(key: string, value: boolean) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function updateSettingString(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    const ok = await confirm({
      title: "운영 설정 저장",
      description: "운영 설정을 저장하시겠습니까?",
    });
    if (!ok) return;

    setIsSaving(true);
    setNotice(null);

    try {
      const refreshInterval = Math.floor(asNumber(settings["site.mainPageRefreshInterval"], 60));
      if (!Number.isFinite(refreshInterval) || refreshInterval < 10) {
        throw new Error("메인 페이지 자동 새로고침 주기는 10초 이상이어야 합니다.");
      }

      const submissionEditLimit = Math.floor(asNumber(settings["site.submissionEditLimit"], 3));
      if (!Number.isFinite(submissionEditLimit) || submissionEditLimit < 0) {
        throw new Error("답안 수정 횟수 제한은 0 이상이어야 합니다.");
      }

      const maintenanceMessage = asString(settings["site.maintenanceMessage"]).trim();
      if (!maintenanceMessage) {
        throw new Error("점검 안내 메시지를 입력해 주세요.");
      }

      const preRegistrationClosedMessage = asString(
        settings["site.preRegistrationClosedMessage"],
        "사전등록이 마감되었습니다. 답안 입력 오픈 후 다시 이용해 주세요."
      ).trim();
      if (!preRegistrationClosedMessage) {
        throw new Error("입력 단계 안내 메시지를 입력해 주세요.");
      }

      const payload: Record<string, SettingValue> = {
        "site.careerExamEnabled": asBoolean(settings["site.careerExamEnabled"], true),
        "site.maintenanceMode": asBoolean(settings["site.maintenanceMode"], false),
        "site.maintenanceMessage": maintenanceMessage,
        "site.mainPageAutoRefresh": asBoolean(settings["site.mainPageAutoRefresh"], true),
        "site.mainPageRefreshInterval": String(refreshInterval),
        "site.mainCardLiveStatsEnabled": asBoolean(
          settings["site.mainCardLiveStatsEnabled"],
          true
        ),
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
        "site.preRegistrationEnabled": asBoolean(settings["site.preRegistrationEnabled"], true),
        "site.answerInputEnabled": asBoolean(settings["site.answerInputEnabled"], true),
        "site.preRegistrationClosedMessage": preRegistrationClosedMessage,
      };

      await saveSettings(payload);
      setSettings(await loadSettings());
      setNotice({ type: "success", message: "운영 설정이 저장되었습니다." });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "운영 설정 저장에 실패했습니다.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-slate-600">운영 설정을 불러오는 중입니다...</p>;
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-base font-semibold text-slate-900">운영 설정</h2>

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

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">시험 운영 단계</p>
        <p className="mt-1 text-xs text-slate-500">
          시험 전에는 사전등록만 열고, 시험 종료 후에는 사전등록을 닫고 답안 입력만 여는 방식으로 운영할 수 있습니다.
        </p>

        <div className="mt-3 space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={asBoolean(settings["site.preRegistrationEnabled"], true)}
              onChange={(event) =>
                updateSettingBoolean("site.preRegistrationEnabled", event.target.checked)
              }
            />
            수험번호 사전등록 열기
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={asBoolean(settings["site.answerInputEnabled"], true)}
              onChange={(event) =>
                updateSettingBoolean("site.answerInputEnabled", event.target.checked)
              }
            />
            시험 후 답안 입력 열기
          </label>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              updateSettingBoolean("site.preRegistrationEnabled", true);
              updateSettingBoolean("site.answerInputEnabled", false);
            }}
          >
            시험 전 모드
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              updateSettingBoolean("site.preRegistrationEnabled", false);
              updateSettingBoolean("site.answerInputEnabled", true);
            }}
          >
            시험 후 모드
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              updateSettingBoolean("site.preRegistrationEnabled", false);
              updateSettingBoolean("site.answerInputEnabled", false);
            }}
          >
            입력 닫기
          </Button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={asBoolean(settings["site.careerExamEnabled"], true)}
          onChange={(event) => updateSettingBoolean("site.careerExamEnabled", event.target.checked)}
        />
        경행경채 시험 활성화
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={asBoolean(settings["site.maintenanceMode"], false)}
          onChange={(event) => updateSettingBoolean("site.maintenanceMode", event.target.checked)}
        />
        점검 모드
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={asBoolean(settings["site.mainPageAutoRefresh"], true)}
          onChange={(event) =>
            updateSettingBoolean("site.mainPageAutoRefresh", event.target.checked)
          }
        />
        메인 페이지 자동 새로고침
      </label>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">메인 카드 노출</p>
        <div className="mt-3 space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={asBoolean(settings["site.mainCardLiveStatsEnabled"], true)}
              onChange={(event) =>
                updateSettingBoolean("site.mainCardLiveStatsEnabled", event.target.checked)
              }
            />
            실시간 참여 현황 카드
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={asBoolean(settings["site.mainCardOverviewEnabled"], true)}
              onChange={(event) =>
                updateSettingBoolean("site.mainCardOverviewEnabled", event.target.checked)
              }
            />
            직렬별 합격예측 분석 카드
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={asBoolean(settings["site.mainCardDifficultyEnabled"], true)}
              onChange={(event) =>
                updateSettingBoolean("site.mainCardDifficultyEnabled", event.target.checked)
              }
            />
            체감 난이도 카드
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={asBoolean(settings["site.mainCardCompetitiveEnabled"], true)}
              onChange={(event) =>
                updateSettingBoolean("site.mainCardCompetitiveEnabled", event.target.checked)
              }
            />
            경쟁률 TOP5 카드
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={asBoolean(settings["site.mainCardScoreDistributionEnabled"], true)}
              onChange={(event) =>
                updateSettingBoolean("site.mainCardScoreDistributionEnabled", event.target.checked)
              }
            />
            점수 분포 카드
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="main-refresh-interval">메인 페이지 새로고침 주기 (초)</Label>
        <Input
          id="main-refresh-interval"
          type="number"
          min={10}
          value={asString(settings["site.mainPageRefreshInterval"], "60")}
          onChange={(event) =>
            updateSettingString("site.mainPageRefreshInterval", event.target.value)
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="submission-edit-limit">답안 수정 횟수 제한 (0 = 수정 불가)</Label>
        <Input
          id="submission-edit-limit"
          type="number"
          min={0}
          value={String(asNumber(settings["site.submissionEditLimit"], 3))}
          onChange={(event) => updateSettingString("site.submissionEditLimit", event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="maintenance-message">점검 안내 메시지</Label>
        <Input
          id="maintenance-message"
          value={asString(settings["site.maintenanceMessage"])}
          onChange={(event) => updateSettingString("site.maintenanceMessage", event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="pre-registration-closed-message">입력 단계 안내 메시지</Label>
        <Input
          id="pre-registration-closed-message"
          value={asString(
            settings["site.preRegistrationClosedMessage"],
            "사전등록이 마감되었습니다. 답안 입력 오픈 후 다시 이용해 주세요."
          )}
          onChange={(event) =>
            updateSettingString("site.preRegistrationClosedMessage", event.target.value)
          }
        />
        <p className="text-xs text-slate-500">
          사전등록만 열려 있거나, 입력이 모두 닫힌 상태에서 사용자에게 보여줄 안내 문구입니다.
        </p>
      </div>

      <Button type="button" onClick={handleSave} disabled={isSaving}>
        {isSaving ? "저장 중..." : "운영 설정 저장"}
      </Button>

      <ConfirmModal {...modalProps} />
    </section>
  );
}
