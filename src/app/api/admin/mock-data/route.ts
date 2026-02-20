import { NextRequest, NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/admin-auth";
import { generateMockData, resetMockData } from "@/lib/mock-data";
import { getSiteSettings } from "@/lib/site-settings";

export const runtime = "nodejs";

interface GeneratePayload {
  examId?: unknown;
  publicPerRegion?: unknown;
  careerPerRegion?: unknown;
  resetBeforeGenerate?: unknown;
}

function parsePositiveInt(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : undefined;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  }
  return undefined;
}

function parseBoolean(value: unknown, fallbackValue: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallbackValue;
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if ("error" in guard) return guard.error;

  try {
    const body = (await request.json()) as GeneratePayload;
    const settings = await getSiteSettings();
    const careerExamEnabled = Boolean(settings["site.careerExamEnabled"] ?? true);

    const result = await generateMockData({
      examId: parsePositiveInt(body.examId),
      publicPerRegion: parsePositiveInt(body.publicPerRegion),
      careerPerRegion: parsePositiveInt(body.careerPerRegion),
      careerEnabled: careerExamEnabled,
      resetBeforeGenerate: parseBoolean(body.resetBeforeGenerate, true),
    });

    return NextResponse.json({
      success: true,
      message: "목업 데이터 생성이 완료되었습니다.",
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "목업 데이터 생성에 실패했습니다.";
    console.error("POST /api/admin/mock-data error", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdminRoute();
  if ("error" in guard) return guard.error;

  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope");
    const examId = parsePositiveInt(searchParams.get("examId"));

    const result = await resetMockData({
      examId: scope === "all" ? undefined : examId,
    });

    return NextResponse.json({
      success: true,
      message: "목업 데이터 초기화가 완료되었습니다.",
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "목업 데이터 초기화에 실패했습니다.";
    console.error("DELETE /api/admin/mock-data error", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
