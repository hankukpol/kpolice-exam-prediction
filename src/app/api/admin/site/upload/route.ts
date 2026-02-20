import { NextRequest, NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { upsertSiteSettings } from "@/lib/site-settings";
import { deleteUploadedFileByPublicUrl, saveImageUpload, validateImageFile } from "@/lib/upload";

export const runtime = "nodejs";

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if ("error" in guard) return guard.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "업로드할 파일이 필요합니다." }, { status: 400 });
    }

    const validation = await validateImageFile(file, { maxBytes: MAX_UPLOAD_SIZE });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const existing = await prisma.siteSetting.findUnique({
      where: { key: "site.bannerImageUrl" },
      select: { value: true },
    });

    const savedImage = await saveImageUpload({
      file,
      prefix: "site",
      uploadSubdir: "banners",
      maxBytes: MAX_UPLOAD_SIZE,
    });
    const publicUrl = savedImage.publicUrl;

    if (existing?.value && existing.value !== publicUrl) {
      await deleteUploadedFileByPublicUrl(existing.value);
    }

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
