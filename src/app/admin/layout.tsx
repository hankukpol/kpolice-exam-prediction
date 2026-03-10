import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { authOptions } from "@/lib/auth";
import { getVerifiedSessionUser, isVerifiedAdmin } from "@/lib/session-user";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/admin/login?callbackUrl=/admin");
  }

  const verifiedUser = await getVerifiedSessionUser(session).catch(() => null);
  if (!verifiedUser || !isVerifiedAdmin(verifiedUser)) {
    redirect("/admin/login?error=admin_only&callbackUrl=/admin");
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-police-950">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
}
