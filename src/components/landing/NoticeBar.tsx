import type { PublicNoticeItem } from "@/lib/site-settings";

interface NoticeBarProps {
  notices: PublicNoticeItem[];
}

export default function NoticeBar({ notices }: NoticeBarProps) {
  if (notices.length < 1) return null;

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
      <h2 className="text-base font-semibold text-amber-900">공지사항</h2>
      <ul className="mt-3 space-y-3">
        {notices.map((notice) => (
          <li key={notice.id} className="rounded-lg border border-amber-200 bg-white p-3">
            <p className="text-sm font-semibold text-slate-900">{notice.title}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{notice.content}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
