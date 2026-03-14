import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const supabaseOrigin = (() => {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
})();

const vercelToolbarOrigins = {
  connect: ["https://vercel.live", "wss://ws-us3.pusher.com"],
  font: ["https://vercel.live", "https://assets.vercel.com"],
  frame: ["https://vercel.live"],
  img: ["https://vercel.live", "https://vercel.com"],
  script: ["https://vercel.live"],
  style: ["https://vercel.live"],
};

const connectSrc = [
  "'self'",
  ...(isDev ? ["ws:", "wss:"] : []),
  ...vercelToolbarOrigins.connect,
  ...(supabaseOrigin ? [supabaseOrigin] : []),
].join(" ");

const fontSrc = ["'self'", "data:", ...vercelToolbarOrigins.font].join(" ");
const frameSrc = vercelToolbarOrigins.frame.join(" ");
const imgSrc = [
  "'self'",
  "data:",
  "blob:",
  ...vercelToolbarOrigins.img,
  ...(supabaseOrigin ? [supabaseOrigin] : []),
].join(" ");
const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  ...(isDev ? ["'unsafe-eval'"] : []),
  ...vercelToolbarOrigins.script,
].join(" ");
const styleSrc = ["'self'", "'unsafe-inline'", ...vercelToolbarOrigins.style].join(" ");

const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  `frame-src ${frameSrc}`,
  `img-src ${imgSrc}`,
  `font-src ${fontSrc}`,
  `style-src ${styleSrc}`,
  `script-src ${scriptSrc}`,
  `connect-src ${connectSrc}`,
  "form-action 'self'",
  "upgrade-insecure-requests",
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspDirectives.join("; ") },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
