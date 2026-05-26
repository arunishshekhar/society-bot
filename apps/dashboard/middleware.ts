import { NextResponse, type NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const session = req.cookies.get('admin-session');
  const isLogin = req.nextUrl.pathname.startsWith('/login');

  if (!session && !isLogin) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (session && isLogin) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|api/login).*)'],
};
