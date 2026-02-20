import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

const navItems = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/exams", label: "시험 관리" },
  { href: "/admin/answers", label: "정답 관리" },
  { href: "/admin/regions", label: "모집인원 관리" },
  { href: "/admin/site", label: "사이트 관리" },
  { href: "/admin/users", label: "사용자 관리" },
  { href: "/admin/comments", label: "댓글 관리" },
  { href: "/admin/submissions", label: "제출 현황" },
  { href: "/admin/stats", label: "참여 통계" },
];

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-8">
      <aside className="hidden w-52 shrink-0 rounded-xl border border-slate-200 bg-white p-4 md:block">
        <p className="text-sm font-semibold text-slate-900">관리자 메뉴</p>
        <nav className="mt-4 flex flex-col gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <section className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-6">
        {children}
      </section>
    </main>
  );
}
