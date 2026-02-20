import { NextRequest, NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/admin-auth";
import { isBannerZone, revalidateBannerCache } from "@/lib/banners";
import { prisma } from "@/lib/prisma";
import { deleteUploadedFileByPublicUrl, saveImageUpload, validateImageFile } from "@/lib/upload";

export const runtime = "nodejs";

function parseBannerId(request: NextRequest): number | null {
  const { searchParams } = new URL(request.url);
  const rawId = searchParams.get("id");
  if (!rawId) return null;
  const parsed = Number(rawId);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseSortOrder(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const parsed = Number(String(value));
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function parseBooleanOrNull(value: FormDataEntryValue | null): boolean | null {
  if (value === null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

function normalizeOptionalText(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function isValidLinkUrl(value: string | null): boolean {
  if (!value) return true;
  if (value.startsWith("/")) return true;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET() {
  const guard = await requireAdminRoute();
  if ("error" in guard) return guard.error;

  try {
    const banners = await prisma.banner.findMany({
      orderBy: [{ zone: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
    });
    return NextResponse.json({ banners });
  } catch (error) {
    console.error("배너 목록 조회 중 오류가 발생했습니다.", error);
    return NextResponse.json({ error: "배너 목록 조회에 실패했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute();
  if ("error" in guard) return guard.error;

  try {
    const formData = await request.formData();

    const zoneRaw = String(formData.get("zone") ?? "").trim();
    if (!isBannerZone(zoneRaw)) {
      return NextResponse.json({ error: "배너 존(zone) 값이 올바르지 않습니다." }, { status: 400 });
    }

    const image = formData.get("image");
    if (!(image instanceof File)) {
      return NextResponse.json({ error: "업로드할 배너 이미지가 필요합니다." }, { status: 400 });
    }

    const imageValidation = await validateImageFile(image);
    if (!imageValidation.ok) {
      return NextResponse.json({ error: imageValidation.error }, { status: 400 });
    }

    const linkUrl = normalizeOptionalText(formData.get("linkUrl"));
    const altText = normalizeOptionalText(formData.get("altText")) ?? "";
    const sortOrder = parseSortOrder(formData.get("sortOrder"));
    const isActive = parseBooleanOrNull(formData.get("isActive"));

    if (!isValidLinkUrl(linkUrl)) {
      return NextResponse.json({ error: "배너 링크 URL 형식이 올바르지 않습니다." }, { status: 400 });
    }

    if (sortOrder === null && formData.get("sortOrder") !== null) {
      return NextResponse.json({ error: "sortOrder는 0 이상의 정수여야 합니다." }, { status: 400 });
    }

    if (isActive === null && formData.get("isActive") !== null) {
      return NextResponse.json({ error: "isActive 값이 올바르지 않습니다." }, { status: 400 });
    }

    const savedImage = await saveImageUpload({
      file: image,
      prefix: zoneRaw,
      uploadSubdir: "banners",
    });

    const created = await prisma.banner.create({
      data: {
        zone: zoneRaw,
        imageUrl: savedImage.publicUrl,
        linkUrl,
        altText,
        isActive: isActive ?? true,
        sortOrder: sortOrder ?? 0,
      },
    });

    revalidateBannerCache();

    return NextResponse.json(
      {
        success: true,
        banner: created,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("배너 생성 중 오류가 발생했습니다.", error);
    return NextResponse.json({ error: "배너 생성에 실패했습니다." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireAdminRoute();
  if ("error" in guard) return guard.error;

  const bannerId = parseBannerId(request);
  if (!bannerId) {
    return NextResponse.json({ error: "수정할 배너 ID가 필요합니다." }, { status: 400 });
  }

  try {
    const existing = await prisma.banner.findUnique({
      where: { id: bannerId },
    });
    if (!existing) {
      return NextResponse.json({ error: "수정할 배너를 찾을 수 없습니다." }, { status: 404 });
    }

    const formData = await request.formData();

    const zoneRaw = normalizeOptionalText(formData.get("zone"));
    if (zoneRaw !== null && !isBannerZone(zoneRaw)) {
      return NextResponse.json({ error: "배너 존(zone) 값이 올바르지 않습니다." }, { status: 400 });
    }

    const linkUrl = normalizeOptionalText(formData.get("linkUrl"));
    const altText = normalizeOptionalText(formData.get("altText"));
    const sortOrder = parseSortOrder(formData.get("sortOrder"));
    const isActive = parseBooleanOrNull(formData.get("isActive"));

    if (!isValidLinkUrl(linkUrl)) {
      return NextResponse.json({ error: "배너 링크 URL 형식이 올바르지 않습니다." }, { status: 400 });
    }
    if (sortOrder === null && formData.get("sortOrder") !== null) {
      return NextResponse.json({ error: "sortOrder는 0 이상의 정수여야 합니다." }, { status: 400 });
    }
    if (isActive === null && formData.get("isActive") !== null) {
      return NextResponse.json({ error: "isActive 값이 올바르지 않습니다." }, { status: 400 });
    }

    const image = formData.get("image");
    let nextImageUrl = existing.imageUrl;
    let shouldDeletePreviousImage = false;

    if (image instanceof File) {
      const imageValidation = await validateImageFile(image);
      if (!imageValidation.ok) {
        return NextResponse.json({ error: imageValidation.error }, { status: 400 });
      }

      const savedImage = await saveImageUpload({
        file: image,
        prefix: zoneRaw ?? existing.zone,
        uploadSubdir: "banners",
      });

      nextImageUrl = savedImage.publicUrl;
      shouldDeletePreviousImage = true;
    }

    const updated = await prisma.banner.update({
      where: { id: bannerId },
      data: {
        zone: zoneRaw ?? existing.zone,
        imageUrl: nextImageUrl,
        linkUrl,
        altText: altText ?? existing.altText,
        isActive: isActive ?? existing.isActive,
        sortOrder: sortOrder ?? existing.sortOrder,
      },
    });

    if (shouldDeletePreviousImage && existing.imageUrl !== nextImageUrl) {
      await deleteUploadedFileByPublicUrl(existing.imageUrl);
    }

    revalidateBannerCache();

    return NextResponse.json({
      success: true,
      banner: updated,
    });
  } catch (error) {
    console.error("배너 수정 중 오류가 발생했습니다.", error);
    return NextResponse.json({ error: "배너 수정에 실패했습니다." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdminRoute();
  if ("error" in guard) return guard.error;

  const bannerId = parseBannerId(request);
  if (!bannerId) {
    return NextResponse.json({ error: "삭제할 배너 ID가 필요합니다." }, { status: 400 });
  }

  try {
    const deleted = await prisma.banner.delete({
      where: { id: bannerId },
    });

    await deleteUploadedFileByPublicUrl(deleted.imageUrl);
    revalidateBannerCache();

    return NextResponse.json({
      success: true,
      deletedId: bannerId,
    });
  } catch (error) {
    console.error("배너 삭제 중 오류가 발생했습니다.", error);
    return NextResponse.json({ error: "배너 삭제에 실패했습니다." }, { status: 500 });
  }
}
