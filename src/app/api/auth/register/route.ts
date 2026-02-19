import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface RegisterRequestBody {
  name?: string;
  email?: string;
  password?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterRequestBody;
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password?.trim();

    if (!name || !email || !password) {
      return NextResponse.json(
        { message: "이름, 이메일, 비밀번호를 모두 입력해주세요." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { message: "비밀번호는 8자 이상이어야 합니다." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ message: "이미 가입된 이메일입니다." }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    return NextResponse.json({ message: "회원가입이 완료되었습니다." }, { status: 201 });
  } catch (error) {
    console.error("회원가입 처리 중 오류가 발생했습니다.", error);
    return NextResponse.json(
      { message: "회원가입 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
