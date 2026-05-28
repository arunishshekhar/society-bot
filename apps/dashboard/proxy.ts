import { NextResponse, type NextRequest } from 'next/server';

export function proxy(req: NextRequest) {
  const session = req.cookies.get('admin-session');
  // Validate the cookie value is a non-empty string (not forgeable with empty value)
  const isAuthenticated = session && session.value.length > 0;
  const isLogin = req.nextUrl.pathname.startsWith('/login');

  if (!isAuthenticated && !isLogin) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (isAuthenticated && isLogin) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|api/login).*)'],
};
