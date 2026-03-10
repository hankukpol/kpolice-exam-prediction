import { NextResponse } from "next/server";
import { confirmPasswordReset } from "@/lib/password-reset";

export const runtime = "nodejs";

const MSG = {
  error: "\uBE44\uBC00\uBC88\uD638 \uC7AC\uC124\uC815\uC744 \uCC98\uB9AC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const result = await confirmPasswordReset({
      username: typeof body.username === "string" ? body.username : "",
      email: typeof body.email === "string" ? body.email : "",
      resetCode:
        typeof body.resetCode === "string"
          ? body.resetCode
          : typeof body.recoveryCode === "string"
            ? body.recoveryCode
            : "",
      password: typeof body.password === "string" ? body.password : "",
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: MSG.error }, { status: 500 });
  }
}
