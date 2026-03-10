import { ExamType } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { checkExamNumberAvailability } from "@/lib/pre-registration";
import { consumeFixedWindowRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

export const runtime = "nodejs";

const CHECK_WINDOW_MS = 60 * 1000;
const CHECK_LIMIT_PER_IP = 30;

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const ip = getClientIp(request);
  const rateLimit = consumeFixedWindowRateLimit({
    namespace: "exam-number-check-ip",
    key: ip,
    limit: CHECK_LIMIT_PER_IP,
    windowMs: CHECK_WINDOW_MS,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSec) },
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const examId = parsePositiveInt(searchParams.get("examId"));
  const regionId = parsePositiveInt(searchParams.get("regionId"));
  const examNumber = searchParams.get("examNumber")?.trim() ?? "";
  const examTypeParam = searchParams.get("examType")?.trim() ?? "";

  if (!examId || !regionId || !examNumber) {
    return NextResponse.json(
      { error: "examId, regionId, examNumber가 모두 필요합니다." },
      { status: 400 }
    );
  }

  const examType = examTypeParam === ExamType.CAREER ? ExamType.CAREER : ExamType.PUBLIC;

  try {
    const userId = Number(session.user.id);
    const result = await checkExamNumberAvailability({
      examId,
      regionId,
      examType,
      examNumber,
      userId,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("수험번호 확인 중 오류가 발생했습니다.", error);
    return NextResponse.json({ error: "수험번호 확인에 실패했습니다." }, { status: 500 });
  }
}
