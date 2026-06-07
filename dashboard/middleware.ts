import { NextRequest, NextResponse } from 'next/server';

// Gate the whole dashboard behind a login. Unauthenticated requests are
// redirected to /login (pages) or rejected (API). The auth cookie holds the
// server-only AUTH_TOKEN, set by /api/login on a correct password.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always-public: the login page and the auth endpoints.
  if (pathname === '/login' || pathname.startsWith('/api/login') || pathname.startsWith('/api/logout')) {
    return NextResponse.next();
  }

  const token = req.cookies.get('jh_auth')?.value;
  if (token && token === process.env.AUTH_TOKEN) {
    return NextResponse.next();
  }

  // API calls get a 401; page navigations get redirected to /login.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('from', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next internals and static asset files.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?)$).*)'],
};
