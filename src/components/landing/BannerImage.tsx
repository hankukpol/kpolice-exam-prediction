import type { PublicBannerItem } from "@/lib/banners";

interface BannerImageProps {
  banner: PublicBannerItem;
}

function isExternalUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

export default function BannerImage({ banner }: BannerImageProps) {
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={banner.imageUrl}
      alt={banner.altText || "배너 이미지"}
      className="h-auto w-full rounded-2xl border border-slate-200 object-cover"
    />
  );

  if (!banner.linkUrl) {
    return image;
  }

  const external = isExternalUrl(banner.linkUrl);

  return (
    <a
      href={banner.linkUrl}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer noopener" : undefined}
      className="block"
    >
      {image}
    </a>
  );
}
