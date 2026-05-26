import { NextResponse, type NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const password = String(form.get('password') ?? '');

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.redirect(new URL('/login?error=1', req.url));
  }

  const response = NextResponse.redirect(new URL('/', req.url));
  response.cookies.set('admin-session', '1', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  return response;
}
