import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { toApiErrorMessage } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const userId = Number(session.user.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json({ error: "Invalid user session." }, { status: 401 });
    }

    let body: { rescoreEventId?: number };
    try {
      body = (await request.json()) as { rescoreEventId?: number };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const rescoreEventId = Number(body.rescoreEventId);
    if (!Number.isInteger(rescoreEventId) || rescoreEventId <= 0) {
      return NextResponse.json({ error: "Invalid rescoreEventId." }, { status: 400 });
    }

    const updated = await prisma.rescoreDetail.updateMany({
      where: {
        userId,
        rescoreEventId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return NextResponse.json({
      success: true,
      updatedCount: updated.count,
    });
  } catch (error) {
    console.error("POST /api/notifications/rescore/read error", error);
    return NextResponse.json(
      { error: toApiErrorMessage(error, "Failed to mark rescore notifications as read.") },
      { status: 500 }
    );
  }
}