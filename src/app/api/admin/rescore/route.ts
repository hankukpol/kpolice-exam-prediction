import { NextRequest, NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/admin-auth";
import { rescoreExam } from "@/lib/scoring";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if ("error" in guard) return guard.error;

  try {
    const body = (await request.json()) as { examId?: number };
    const examId = Number(body.examId);

    if (!Number.isInteger(examId) || examId <= 0) {
      return NextResponse.json({ error: "유효한 examId가 필요합니다." }, { status: 400 });
    }

    const rescoredCount = await rescoreExam(examId);

    return NextResponse.json({
      success: true,
      examId,
      rescoredCount,
      message: `${rescoredCount}건의 제출 데이터 재채점이 완료되었습니다.`,
    });
  } catch (error) {
    console.error("재채점 처리 중 오류가 발생했습니다.", error);
    return NextResponse.json({ error: "재채점 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
