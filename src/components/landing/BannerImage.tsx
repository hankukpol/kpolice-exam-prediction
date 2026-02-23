import type { PublicBannerItem } from "@/lib/banners";

interface BannerImageProps {
  banner: PublicBannerItem;
  className?: string;
  fullWidth?: boolean;
}

function isExternalUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

function joinClassNames(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export default function BannerImage({ banner, className, fullWidth = false }: BannerImageProps) {
  // HTML 에디터 모드 배너: htmlContent를 직접 렌더링
  if (banner.htmlContent) {
    return (
      <div
        className={fullWidth ? "flex w-full justify-center overflow-hidden" : "block"}
        dangerouslySetInnerHTML={{ __html: banner.htmlContent }}
      />
    );
  }

  // 레거시 이미지 모드 배너: 기존 로직 유지
  if (!banner.imageUrl) return null;

  const safeLinkUrl = banner.linkUrl && !banner.linkUrl.startsWith("//") ? banner.linkUrl : null;

  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={banner.imageUrl}
      alt={banner.altText || "배너 이미지"}
      className={joinClassNames(
        fullWidth
          ? "shrink-0 h-auto max-w-none w-[160%] min-[1200px]:w-[1920px] object-cover object-center bg-white"
          : "block h-auto w-full border border-slate-200 object-cover bg-white",
        className
      )}
    />
  );

  if (!safeLinkUrl) {
    return fullWidth ? (
      <div className="flex w-full justify-center overflow-hidden">
        {image}
      </div>
    ) : (
      image
    );
  }

  const external = isExternalUrl(safeLinkUrl);

  return (
    <a
      href={safeLinkUrl}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer noopener" : undefined}
      className={fullWidth ? "flex w-full justify-center overflow-hidden" : "block"}
    >
      {image}
    </a>
  );
}
