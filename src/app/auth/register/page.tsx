"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RegisterResponse {
  message: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (password !== confirmPassword) {
      setErrorMessage("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("비밀번호는 8자 이상 입력해주세요.");
      return;
    }

    setIsSubmitting(true);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        password,
      }),
    });

    const data = (await response.json()) as RegisterResponse;

    if (!response.ok) {
      setErrorMessage(data.message ?? "회원가입 처리 중 오류가 발생했습니다.");
      setIsSubmitting(false);
      return;
    }

    setSuccessMessage("회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.");
    setTimeout(() => {
      router.push("/auth/login");
    }, 800);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">회원가입</CardTitle>
          <p className="text-sm text-slate-500">
            합격예측 서비스 이용을 위해 기본 정보를 입력해주세요.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">이름</Label>
              <Input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="홍길동"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="8자 이상 입력"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">비밀번호 확인</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="비밀번호를 다시 입력"
                required
              />
            </div>

            {errorMessage ? (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{errorMessage}</p>
            ) : null}

            {successMessage ? (
              <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {successMessage}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "가입 처리 중..." : "회원가입"}
            </Button>
          </form>

          <p className="mt-4 text-sm text-slate-600">
            이미 계정이 있으신가요?{" "}
            <Link href="/auth/login" className="font-medium text-slate-900 underline">
              로그인
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
