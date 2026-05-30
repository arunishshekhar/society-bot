import { NextResponse, type NextRequest } from 'next/server';
import { verifySessionToken } from './lib/session-crypto';

export async function proxy(req: NextRequest) {
  const session = req.cookies.get('admin-session');
  const isLogin = req.nextUrl.pathname.startsWith('/login');



  // Stateless HMAC verification — works in Edge Runtime without shared state
  const isAuthenticated =
    session != null && (await verifySessionToken(session.value));

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
