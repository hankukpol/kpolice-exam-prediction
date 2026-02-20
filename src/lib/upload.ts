import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const DEFAULT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export interface SaveImageUploadOptions {
  file: File;
  prefix: string;
  uploadSubdir: string;
  maxBytes?: number;
  allowedMimeTypes?: ReadonlySet<string>;
}

export interface SavedImageResult {
  fileName: string;
  absolutePath: string;
  publicUrl: string;
}

function extensionByMimeType(mimeType: string): string | null {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return null;
}

function detectMimeTypeByMagicBytes(bytes: Uint8Array): string | null {
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (isJpeg) {
    return "image/jpeg";
  }

  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  if (isPng) {
    return "image/png";
  }

  const isWebp =
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  if (isWebp) {
    return "image/webp";
  }

  return null;
}

function sanitizePrefix(prefix: string): string {
  const sanitized = prefix.trim().replace(/[^a-zA-Z0-9_-]/g, "-");
  return sanitized || "upload";
}

export async function validateImageFile(
  file: File,
  options?: {
    maxBytes?: number;
    allowedMimeTypes?: ReadonlySet<string>;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const maxBytes = options?.maxBytes ?? DEFAULT_IMAGE_MAX_BYTES;
  const allowedMimeTypes = options?.allowedMimeTypes ?? DEFAULT_ALLOWED_IMAGE_MIME_TYPES;

  if (!allowedMimeTypes.has(file.type)) {
    return { ok: false, error: "jpg, png, webp 형식의 이미지 파일만 업로드할 수 있습니다." };
  }

  if (file.size > maxBytes) {
    const maxMb = Math.floor(maxBytes / (1024 * 1024));
    return { ok: false, error: `이미지 파일은 ${maxMb}MB 이하만 업로드할 수 있습니다.` };
  }

  if (!extensionByMimeType(file.type)) {
    return { ok: false, error: "지원하지 않는 파일 형식입니다." };
  }

  const headBytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const detectedMimeType = detectMimeTypeByMagicBytes(headBytes);
  if (!detectedMimeType || !allowedMimeTypes.has(detectedMimeType)) {
    return { ok: false, error: "이미지 파일 시그니처를 확인할 수 없습니다. jpg/png/webp 파일만 가능합니다." };
  }

  if (detectedMimeType !== file.type) {
    return { ok: false, error: "파일 확장자 또는 MIME 타입이 실제 이미지 형식과 일치하지 않습니다." };
  }

  return { ok: true };
}

export async function saveImageUpload(options: SaveImageUploadOptions): Promise<SavedImageResult> {
  const maxBytes = options.maxBytes ?? DEFAULT_IMAGE_MAX_BYTES;
  const allowedMimeTypes = options.allowedMimeTypes ?? DEFAULT_ALLOWED_IMAGE_MIME_TYPES;
  const validation = await validateImageFile(options.file, { maxBytes, allowedMimeTypes });
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const extension = extensionByMimeType(options.file.type);
  if (!extension) {
    throw new Error("지원하지 않는 파일 형식입니다.");
  }

  const safePrefix = sanitizePrefix(options.prefix);
  const fileName = `${safePrefix}-${Date.now()}-${randomUUID().slice(0, 8)}.${extension}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", options.uploadSubdir);
  const absolutePath = path.join(uploadDir, fileName);
  await mkdir(uploadDir, { recursive: true });

  const fileBuffer = Buffer.from(await options.file.arrayBuffer());
  await writeFile(absolutePath, fileBuffer);

  return {
    fileName,
    absolutePath,
    publicUrl: `/uploads/${options.uploadSubdir}/${fileName}`,
  };
}

function toAbsolutePublicPath(publicUrl: string): string | null {
  if (!publicUrl.startsWith("/uploads/")) {
    return null;
  }

  if (publicUrl.includes("..")) {
    return null;
  }

  const relativePath = publicUrl.replace(/^\/+/, "");
  const absolutePath = path.resolve(path.join(process.cwd(), "public", relativePath));
  const uploadsRoot = path.resolve(path.join(process.cwd(), "public", "uploads"));

  if (!absolutePath.startsWith(uploadsRoot)) {
    return null;
  }

  return absolutePath;
}

export async function deleteUploadedFileByPublicUrl(publicUrl: string | null | undefined): Promise<void> {
  if (!publicUrl) return;

  const absolutePath = toAbsolutePublicPath(publicUrl);
  if (!absolutePath) return;

  await rm(absolutePath, { force: true });
}
