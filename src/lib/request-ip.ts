import "server-only";

type HeaderValueLike = string | string[] | null | undefined;

function readHeaderValue(headers: unknown, key: string): HeaderValueLike {
  if (!headers || typeof headers !== "object") {
    return undefined;
  }

  if (typeof (headers as { get?: unknown }).get === "function") {
    try {
      return ((headers as { get: (name: string) => string | null }).get(key) ?? undefined) as
        | string
        | undefined;
    } catch {
      return undefined;
    }
  }

  const record = headers as Record<string, unknown>;
  const exact = record[key];
  if (typeof exact === "string" || Array.isArray(exact)) {
    return exact as string | string[];
  }

  const lowerKey = key.toLowerCase();
  const lower = record[lowerKey];
  if (typeof lower === "string" || Array.isArray(lower)) {
    return lower as string | string[];
  }

  return undefined;
}

function normalizeHeaderValue(value: HeaderValueLike): string | null {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (Array.isArray(value) && value.length > 0) {
    const candidate = value[0];
    return typeof candidate === "string" ? candidate.trim() || null : null;
  }

  return null;
}

export function getClientIp(requestLike: unknown): string {
  const headers =
    requestLike && typeof requestLike === "object" && "headers" in (requestLike as Record<string, unknown>)
      ? (requestLike as { headers: unknown }).headers
      : undefined;

  const xForwardedFor = normalizeHeaderValue(readHeaderValue(headers, "x-forwarded-for"));
  if (xForwardedFor) {
    const first = xForwardedFor.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  const xRealIp = normalizeHeaderValue(readHeaderValue(headers, "x-real-ip"));
  if (xRealIp) {
    return xRealIp;
  }

  const cfIp = normalizeHeaderValue(readHeaderValue(headers, "cf-connecting-ip"));
  if (cfIp) {
    return cfIp;
  }

  return "unknown";
}
