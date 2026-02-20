import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const publicAuthPaths = new Set(["/login", "/register"]);

function isAuthApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/auth");
}

function isProtectedPath(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/exam");
}

function isAdminPath(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/exam/admin");
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!isProtectedPath(pathname) || publicAuthPaths.has(pathname) || isAuthApiPath(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    const callbackPath = `${pathname}${request.nextUrl.search}`;
    loginUrl.searchParams.set("callbackUrl", callbackPath);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminPath(pathname) && token.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/exam", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/((?!_next/static|_next/image|favicon.ico).*)"],
};
