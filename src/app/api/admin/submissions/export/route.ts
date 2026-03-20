import { NextRequest, NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/admin-auth";
import { buildAdminSubmissionWhere, parseAdminSubmissionExamType } from "@/lib/admin-submissions";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/request-ip";

export const runtime = "nodejs";

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(date);
}

function formatExamType(examType: "PUBLIC" | "CAREER"): string {
  return examType === "PUBLIC" ? "공채" : "경행경채";
}

function formatGender(gender: "MALE" | "FEMALE"): string {
  return gender === "MALE" ? "남성" : "여성";
}

export async function GET(request: NextRequest) {
  const guard = await requireAdminRoute();
  if ("error" in guard) return guard.error;

  try {
    const { searchParams } = new URL(request.url);
    const examId = parsePositiveInt(searchParams.get("examId"));
    const regionId = parsePositiveInt(searchParams.get("regionId"));
    const userId = parsePositiveInt(searchParams.get("userId"));
    const examType = parseAdminSubmissionExamType(searchParams.get("examType"));
    const search = searchParams.get("search")?.trim() ?? "";

    if (searchParams.get("examType") && !examType) {
      return NextResponse.json({ error: "examType은 PUBLIC 또는 CAREER여야 합니다." }, { status: 400 });
    }

    const rows = await prisma.submission.findMany({
      where: buildAdminSubmissionWhere(
        {
          examId,
          regionId,
          userId,
          examType,
          search,
        },
        { predictionEligibleOnly: true }
      ),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        examNumber: true,
        examType: true,
        gender: true,
        totalScore: true,
        finalScore: true,
        createdAt: true,
        user: {
          select: {
            name: true,
            phone: true,
            contactPhone: true,
          },
        },
        exam: {
          select: {
            year: true,
            round: true,
            name: true,
          },
        },
        region: {
          select: {
            name: true,
          },
        },
      },
    });

    const header = [
      "제출ID",
      "이름",
      "아이디",
      "연락처",
      "시험",
      "지역",
      "채용유형",
      "성별",
      "응시번호",
      "총점",
      "최종점수",
      "제출일시",
    ].join(",");

    const lines = rows.map((row) =>
      [
        String(row.id),
        escapeCsvField(row.user.name),
        escapeCsvField(row.user.phone),
        escapeCsvField(row.user.contactPhone ?? ""),
        escapeCsvField(`${row.exam.year}-${row.exam.round} ${row.exam.name}`),
        escapeCsvField(row.region.name),
        escapeCsvField(formatExamType(row.examType)),
        escapeCsvField(formatGender(row.gender)),
        escapeCsvField(row.examNumber),
        String(Number(row.totalScore).toFixed(2)),
        String(Number(row.finalScore).toFixed(2)),
        escapeCsvField(formatDate(row.createdAt)),
      ].join(",")
    );

    const csv = "\uFEFF" + [header, ...lines].join("\n");
    const filename = `합격예측제출명단_${new Date().toISOString().slice(0, 10)}.csv`;
    const clientIp = getClientIp(request);

    console.log(
      `[감사] 합격예측 제출 명단 CSV 내보내기 - 관리자ID=${guard.session.user.id}, IP=${clientIp}, 건수=${rows.length}, 시간=${new Date().toISOString()}`
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    console.error("합격예측 제출 명단 CSV 내보내기 오류:", error);
    return NextResponse.json({ error: "합격예측 제출 명단 내보내기에 실패했습니다." }, { status: 500 });
  }
}