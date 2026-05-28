import { NextResponse, type NextRequest } from 'next/server';
import { validSessions } from './lib/sessions';

export function proxy(req: NextRequest) {
  const session = req.cookies.get('admin-session');
  const isAuthenticated = session != null && validSessions.has(session.value);
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
