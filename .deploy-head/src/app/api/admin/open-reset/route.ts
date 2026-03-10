import { NextRequest, NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/admin-auth";
import { runOpenReset } from "@/lib/open-reset";

export const runtime = "nodejs";

const OPEN_RESET_CONFIRM_TEXT = "OPEN RESET";

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if ("error" in guard) return guard.error;

  let body: { confirmText?: unknown };
  try {
    body = (await request.json()) as { confirmText?: unknown };
  } catch {
    return NextResponse.json({ error: "요청 본문(JSON) 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const confirmText = typeof body.confirmText === "string" ? body.confirmText.trim() : "";
  if (confirmText !== OPEN_RESET_CONFIRM_TEXT) {
    return NextResponse.json(
      { error: `확인 문구를 정확히 입력해 주세요. (${OPEN_RESET_CONFIRM_TEXT})` },
      { status: 400 }
    );
  }

  try {
    const result = await runOpenReset();
    return NextResponse.json({
      success: true,
      message: "오픈 전 전체 초기화가 완료되었습니다.",
      result,
    });
  } catch (error) {
    console.error("POST /api/admin/open-reset error", error);
    const detail = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ error: `오픈 전 전체 초기화에 실패했습니다. (${detail})` }, { status: 500 });
  }
}
