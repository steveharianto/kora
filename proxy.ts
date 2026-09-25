import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_CUSTOMER_PATHS = [
  "/account/login",
  "/account/register",
  "/account/reset-password",
];

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const adminSession = request.cookies.get("kora_admin_session");
  const customerSession = request.cookies.get("kora_customer_session");

  /* ── Admin guard ───────────────────────────────────────────────── */
  const isLoginPage = pathname === "/admin";
  const isAdminSubRoute = pathname.startsWith("/admin/") && !isLoginPage;

  if (!adminSession?.value && isAdminSubRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin";
    return NextResponse.redirect(loginUrl);
  }
  if (adminSession?.value && isLoginPage) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/admin/dashboard";
    return NextResponse.redirect(dashboardUrl);
  }

  /* ── Customer guard ────────────────────────────────────────────── */
  if (pathname.startsWith("/account")) {
    const isPublic = PUBLIC_CUSTOMER_PATHS.some(
      (p) => pathname === p || pathname.startsWith(p + "/"),
    );
    const isResetSent = pathname === "/account/reset-password/sent";

    // Not logged in, trying to access a private page
    if (!isPublic && !isResetSent && !customerSession?.value) {
      const loginUrl = request.nextUrl.clone();
      const original = pathname + request.nextUrl.search;
      loginUrl.pathname = "/account/login";
      loginUrl.search = `?redirect=${encodeURIComponent(original)}`;
      return NextResponse.redirect(loginUrl);
    }

    // Already logged in, visiting login/register
    if (
      customerSession?.value &&
      (pathname === "/account/login" || pathname === "/account/register")
    ) {
      const accountUrl = request.nextUrl.clone();
      accountUrl.pathname = "/account";
      accountUrl.search = "";
      return NextResponse.redirect(accountUrl);
    }
  }

  /* ── Checkout guard ────────────────────────────────────────────── */
  if (pathname.startsWith("/checkout") && !customerSession?.value) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/account/login";
    loginUrl.search = `?redirect=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*", "/checkout/:path*"],
};
