"use client";

import { useCallback, useMemo, useState } from "react";
import { shareToKakao } from "@/lib/kakao";

interface ShareDataResponse {
  submissionId: number;
  exam: {
    id: number;
    name: string;
    year: number;
    round: number;
  };
  user: {
    name: string;
  };
  examType: "PUBLIC" | "CAREER";
  examTypeLabel: string;
  region: {
    id: number;
    name: string;
  };
  totalScore: number;
  finalScore: number;
  rank: number;
  totalParticipants: number;
  predictionGrade: string | null;
}

interface ShareButtonProps {
  submissionId?: number;
  sharePath: "/exam/result" | "/exam/prediction";
}

function buildOgImageUrl(origin: string, data: ShareDataResponse): string {
  const query = new URLSearchParams({
    examTitle: `${data.exam.year}년 ${data.exam.round}차 ${data.exam.name}`,
    userName: data.user.name,
    examTypeLabel: data.examTypeLabel,
    regionName: data.region.name,
    finalScore: data.finalScore.toFixed(2),
    rank: String(data.rank),
    totalParticipants: String(data.totalParticipants),
    predictionGrade: data.predictionGrade ?? "-",
  });
  return `${origin}/api/share/og-image?${query.toString()}`;
}

export default function ShareButton({ submissionId, sharePath }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const query = useMemo(() => {
    return submissionId ? `?submissionId=${submissionId}` : "";
  }, [submissionId]);

  const loadShareData = useCallback(async (): Promise<ShareDataResponse> => {
    const response = await fetch(`/api/share/data${query}`, { method: "GET", cache: "no-store" });
    const data = (await response.json()) as ShareDataResponse & { error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? "공유 데이터를 불러오지 못했습니다.");
    }
    return data;
  }, [query]);

  const execute = useCallback(
    async (fn: (data: ShareDataResponse, origin: string, shareUrl: string) => Promise<void>) => {
      setLoading(true);
      try {
        const data = await loadShareData();
        const origin = window.location.origin;
        const shareUrl = `${origin}${sharePath}?submissionId=${data.submissionId}`;
        await fn(data, origin, shareUrl);
      } catch (error) {
        const message = error instanceof Error ? error.message : "공유 처리 중 오류가 발생했습니다.";
        window.alert(message);
      } finally {
        setLoading(false);
        setOpen(false);
      }
    },
    [loadShareData, sharePath]
  );

  return (
    <div className="relative">
      <button
        type="button"
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        onClick={() => setOpen((prev) => !prev)}
      >
        공유하기
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-20 w-44 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
          <button
            type="button"
            disabled={loading}
            className="w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            onClick={() =>
              void execute(async (_data, _origin, shareUrl) => {
                await navigator.clipboard.writeText(shareUrl);
                window.alert("링크가 복사되었습니다.");
              })
            }
          >
            링크 복사
          </button>
          <button
            type="button"
            disabled={loading}
            className="w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            onClick={() =>
              void execute(async (data, origin, shareUrl) => {
                if (navigator.share) {
                  await navigator.share({
                    title: `${data.exam.name} 합격예측 결과`,
                    text: `${data.user.name}님의 ${data.examTypeLabel} ${data.region.name} 결과`,
                    url: shareUrl,
                  });
                } else {
                  await navigator.clipboard.writeText(shareUrl);
                  window.alert("공유 기능을 지원하지 않아 링크를 복사했습니다.");
                }

                // 카카오 공유 준비용 사전 로드 (키가 있으면 동작)
                if (process.env.NEXT_PUBLIC_KAKAO_JS_KEY) {
                  const imageUrl = buildOgImageUrl(origin, data);
                  await shareToKakao({
                    title: `${data.exam.name} 합격예측 결과`,
                    description: `${data.user.name} · ${data.examTypeLabel} · ${data.region.name}`,
                    imageUrl,
                    linkUrl: shareUrl,
                  });
                }
              })
            }
          >
            카카오/시스템 공유
          </button>
          <button
            type="button"
            disabled={loading}
            className="w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            onClick={() =>
              void execute(async (data, origin) => {
                const imageUrl = buildOgImageUrl(origin, data);
                const response = await fetch(imageUrl, { method: "GET" });
                if (!response.ok) {
                  throw new Error("공유 이미지 생성에 실패했습니다.");
                }
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = `share-${data.submissionId}.png`;
                document.body.appendChild(anchor);
                anchor.click();
                anchor.remove();
                URL.revokeObjectURL(url);
              })
            }
          >
            이미지 저장
          </button>
        </div>
      ) : null}
    </div>
  );
}
