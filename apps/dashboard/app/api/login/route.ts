import { NextResponse, type NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const password = String(form.get('password') ?? '');

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.redirect(new URL('/login?error=1', req.url));
  }

  // Use a cryptographically random token — NOT a guessable constant like '1'
  const sessionToken = crypto.randomUUID();

  const response = NextResponse.redirect(new URL('/', req.url));
  response.cookies.set('admin-session', sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    // Only send over HTTPS in production
    secure: process.env.NODE_ENV === 'production',
    // Expire in 8 hours
    maxAge: 60 * 60 * 8,
  });
  return response;
}

