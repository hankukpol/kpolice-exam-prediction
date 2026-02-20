import type { PublicBannerItem } from "@/lib/banners";

interface BannerImageProps {
  banner: PublicBannerItem;
  className?: string;
  fullWidth?: boolean;
}

function isExternalUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

export default function BannerImage({ banner, className, fullWidth = false }: BannerImageProps) {
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={banner.imageUrl}
      alt={banner.altText || "배너 이미지"}
      className={
        fullWidth
          ? "shrink-0 h-auto max-w-none w-[160%] min-[1200px]:w-[1920px] object-cover object-center bg-white"
          : "block h-auto w-full border border-slate-200 object-cover bg-white"
      }
    />
  );

  if (!banner.linkUrl) {
    return fullWidth ? (
      <div className="flex w-full justify-center overflow-hidden">
        {image}
      </div>
    ) : (
      image
    );
  }

  const external = isExternalUrl(banner.linkUrl);

  return (
    <a
      href={banner.linkUrl}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer noopener" : undefined}
      className={fullWidth ? "flex w-full justify-center overflow-hidden" : "block"}
    >
      {image}
    </a>
  );
}
