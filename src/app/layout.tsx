import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "경찰 필기시험 합격예측",
  description: "경찰 채용 필기시험 OMR 채점 및 합격 가능성 예측 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
