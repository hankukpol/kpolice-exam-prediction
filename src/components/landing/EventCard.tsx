import type { PublicEventItem } from "@/lib/events";

interface EventCardProps {
  event: PublicEventItem;
}

function isExternalUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

export default function EventCard({ event }: EventCardProps) {
  const hasLink = Boolean(event.linkUrl);
  const linkText = event.linkText?.trim() || "자세히 보기";
  const external = hasLink ? isExternalUrl(event.linkUrl as string) : false;

  return (
    <section
      className="rounded-2xl border border-slate-200 p-5 sm:p-6"
      style={{ backgroundColor: event.bgColor || "#ffffff" }}
    >
      <div className="grid gap-4 md:grid-cols-[minmax(220px,360px)_1fr] md:items-center">
        {event.imageUrl ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.imageUrl}
              alt={event.title}
              className="h-auto w-full object-cover"
            />
          </div>
        ) : null}

        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-900">{event.title}</h3>
          {event.description ? (
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{event.description}</p>
          ) : null}
          {hasLink ? (
            <a
              href={event.linkUrl as string}
              target={external ? "_blank" : undefined}
              rel={external ? "noreferrer noopener" : undefined}
              className="inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              {linkText}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
