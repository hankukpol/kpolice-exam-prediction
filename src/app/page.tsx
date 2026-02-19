import Link from "next/link";
import { getServerSession } from "next-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  return (
    <main className="min-h-screen bg-slate-50 py-16">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4">
        <Card className="border-slate-200">
          <CardHeader className="space-y-3">
            <CardTitle className="text-3xl font-bold text-slate-900">
              경찰 필기시험 합격예측 프로그램
            </CardTitle>
            <p className="text-sm leading-relaxed text-slate-600">
              OMR 답안을 입력하면 과목별 점수와 합격 가능성을 빠르게 분석할 수 있습니다.
              대구·경북을 포함한 전국 18개 지역 채용 데이터를 기반으로 예측합니다.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 text-sm text-slate-700">
              <p>1. 시험 정보 및 OMR 답안 입력</p>
              <p>2. 과목별 점수, 과락 여부, 총점 분석</p>
              <p>3. 지역별 배수 위치 및 합격 가능 구간 확인</p>
            </div>

            {session?.user ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                <p className="font-medium">{session.user.name}님, 로그인 상태입니다.</p>
                <p className="mt-1">권한: {session.user.role === "ADMIN" ? "관리자" : "일반 사용자"}</p>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                현재 로그인되어 있지 않습니다. 로그인 후 서비스를 이용해주세요.
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Link href="/auth/login">
                <Button>로그인</Button>
              </Link>
              <Link href="/auth/register">
                <Button variant="outline">회원가입</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
