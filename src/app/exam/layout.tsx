import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import ExamTabNavigation from "@/components/layout/ExamTabNavigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ExamLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/exam/input");
  }

  const userId = Number(session.user.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    redirect("/login?callbackUrl=/exam/input");
  }

  const activeExam = await prisma.exam.findFirst({
    where: { isActive: true },
    orderBy: [{ examDate: "desc" }, { id: "desc" }],
    select: { id: true },
  });

  const submissionCount = await prisma.submission.count({
    where: activeExam
      ? {
          userId,
          examId: activeExam.id,
        }
      : {
          userId,
        },
  });

  return (
    <main className="pb-10">
      <ExamTabNavigation hasSubmission={submissionCount > 0} />
      <div className="mx-auto w-full max-w-7xl px-4 py-6">{children}</div>
    </main>
  );
}
