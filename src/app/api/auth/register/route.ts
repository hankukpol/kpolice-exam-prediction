import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumeFixedWindowRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { validateRegisterInput } from "@/lib/validations";

export const runtime = "nodejs";

// IP당 1시간에 5회 가입 시도 제한 (계정 대량 생성 방지)
const REGISTER_IP_LIMIT = 5;
const REGISTER_IP_WINDOW_MS = 60 * 60 * 1000;

const MSG = {
  fallback: "\uD68C\uC6D0\uAC00\uC785 \uC815\uBCF4\uB97C \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694.",
  usernameDup: "\uC774\uBBF8 \uC0AC\uC6A9 \uC911\uC778 \uC544\uC774\uB514\uC785\uB2C8\uB2E4.",
  emailDup: "\uC774\uBBF8 \uC0AC\uC6A9 \uC911\uC778 \uC774\uBA54\uC77C\uC785\uB2C8\uB2E4.",
  success: "\uD68C\uC6D0\uAC00\uC785\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.",
  error: "\uD68C\uC6D0\uAC00\uC785 \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.",
  tooMany: "\uC78C\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.",
};

export async function POST(request: NextRequest) {
  // IP 기반 레이트리밋 (계정 대량 생성 및 아이디 열거 공격 방지)
  const clientIp = getClientIp(request);
  const ipRateLimit = consumeFixedWindowRateLimit({
    namespace: "register-ip",
    key: clientIp,
    limit: REGISTER_IP_LIMIT,
    windowMs: REGISTER_IP_WINDOW_MS,
  });
  if (!ipRateLimit.allowed) {
    return NextResponse.json(
      { error: MSG.tooMany },
      { status: 429, headers: { "Retry-After": String(ipRateLimit.retryAfterSec) } }
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const validation = validateRegisterInput({
      name: typeof body.name === "string" ? body.name : "",
      username: typeof body.username === "string" ? body.username : "",
      contactPhone: typeof body.contactPhone === "string" ? body.contactPhone : "",
      email: typeof body.email === "string" ? body.email : "",
      password: typeof body.password === "string" ? body.password : "",
      agreeToTerms: body.agreeToTerms === true,
      agreeToPrivacy: body.agreeToPrivacy === true,
    });

    if (!validation.isValid || !validation.data) {
      return NextResponse.json({ error: validation.errors[0] ?? MSG.fallback }, { status: 400 });
    }

    const { name, username, contactPhone, email, password } = validation.data;
    const [existingUsername, existingEmail] = await Promise.all([
      prisma.user.findUnique({ where: { phone: username }, select: { id: true } }),
      prisma.user.findUnique({ where: { email }, select: { id: true } }),
    ]);

    if (existingUsername) {
      return NextResponse.json({ error: MSG.usernameDup }, { status: 409 });
    }

    if (existingEmail) {
      return NextResponse.json({ error: MSG.emailDup }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const agreedAt = new Date();

    await prisma.user.create({
      data: {
        name,
        phone: username,
        contactPhone,
        email,
        password: hashedPassword,
        termsAgreedAt: agreedAt,
        privacyAgreedAt: agreedAt,
      },
    });

    return NextResponse.json({ message: MSG.success });
  } catch {
    return NextResponse.json({ error: MSG.error }, { status: 500 });
  }
}
