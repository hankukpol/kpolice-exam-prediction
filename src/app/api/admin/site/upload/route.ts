import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/admin-auth";
import { upsertSiteSettings } from "@/lib/site-settings";

export const runtime = "nodejs";

const MAX_UPLOAD_SIZE = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function extensionByMimeType(mimeType: string): string | null {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return null;
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if ("error" in guard) return guard.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "업로드할 파일이 필요합니다." }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "jpg, png, webp 형식의 이미지 파일만 업로드할 수 있습니다." },
        { status: 400 }
      );
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ error: "이미지 파일은 2MB 이하만 업로드할 수 있습니다." }, { status: 400 });
    }

    const extension = extensionByMimeType(file.type);
    if (!extension) {
      return NextResponse.json({ error: "지원하지 않는 파일 형식입니다." }, { status: 400 });
    }

    const fileName = `banner-${Date.now()}-${randomUUID().slice(0, 8)}.${extension}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    const outputPath = path.join(uploadDir, fileName);

    await mkdir(uploadDir, { recursive: true });
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await writeFile(outputPath, fileBuffer);

    const publicUrl = `/uploads/${fileName}`;
    await upsertSiteSettings([{ key: "site.bannerImageUrl", value: publicUrl }]);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      message: "배너 이미지가 업로드되었습니다.",
    });
  } catch (error) {
    console.error("배너 이미지 업로드 중 오류가 발생했습니다.", error);
    return NextResponse.json({ error: "배너 이미지 업로드에 실패했습니다." }, { status: 500 });
  }
}
