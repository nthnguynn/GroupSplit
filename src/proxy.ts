import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const user = req.auth?.user as any;

  // OWASP Security Headers
  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-XSS-Protection", "1; mode=block");

  const publicRoutes = [
    "/",
    "/login",
    "/register",
    "/verify-email",
    "/forgot-password",
    "/reset-password",
  ];

  const isPublicRoute = publicRoutes.some((route) => pathname === route);
  const isInviteRoute = pathname.startsWith("/groups/join/");
  const isApiAuth = pathname.startsWith("/api/auth");
  const isWebhookRoute = pathname.startsWith("/api/webhook/");
  const isUploadsRoute = pathname.startsWith("/uploads/");
  const isStaticFile =
    pathname.startsWith("/logo.") ||
    pathname.startsWith("/favicon.") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".svg");

  if (isApiAuth || isStaticFile) return response;
  if (isPublicRoute || isInviteRoute || isWebhookRoute || isUploadsRoute) {
    return response;
  }

  // Yêu cầu đăng nhập cho tất cả các đường dẫn riêng tư
  if (!isLoggedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // Bảo vệ đường dẫn Admin và zalo-helper (chỉ tài khoản có role ADMIN)
  const isAdmin = user?.role === "ADMIN";
  // /api/zalo/* điều khiển Zalo Bot (đổi webhook, đọc tin nhắn) → chỉ Admin
  const isAdminOnlyRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/zalo/") ||
    pathname.startsWith("/zalo-helper");

  if (isAdminOnlyRoute && !isAdmin) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Quyền truy cập bị từ chối. Chỉ dành cho Quản trị viên!" },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return response;
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.png|logo.ico).*)",
  ],
};
