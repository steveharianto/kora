import { NextResponse, type NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const sessionCookie = request.cookies.get('kora_admin_session');
  const pathname = request.nextUrl.pathname;

  const isLoginPage = pathname === '/admin';
  const isAdminSubRoute = pathname.startsWith('/admin/') && !isLoginPage;

  // 1. If not logged in and accessing protected admin routes, redirect to /admin
  if (!sessionCookie?.value && isAdminSubRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/admin';
    return NextResponse.redirect(loginUrl);
  }

  // 2. If already logged in and visiting /admin, redirect directly to /admin/dashboard
  if (sessionCookie?.value && isLoginPage) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/admin/dashboard';
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
