import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { validSessions } from '../../../lib/sessions';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const password = String(form.get('password') ?? '');

  const expected = process.env.ADMIN_PASSWORD ?? '';
  let valid = false;
  try {
    const expBuf = Buffer.from(expected);
    const recBuf = Buffer.from(password);
    valid =
      expected.length > 0 &&
      expBuf.length === recBuf.length &&
      timingSafeEqual(expBuf, recBuf);
  } catch {
    valid = false;
  }

  if (!valid) {
    return NextResponse.redirect(new URL('/login?error=1', req.url));
  }

  // Store the token server-side so the middleware can validate it.
  const sessionToken = crypto.randomUUID();
  validSessions.add(sessionToken);

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

