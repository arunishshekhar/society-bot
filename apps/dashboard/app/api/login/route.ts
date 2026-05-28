import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createSessionToken } from '../../../lib/session-crypto';

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

  // Create a stateless HMAC-signed token — works across Edge and Node.js runtimes.
  const sessionToken = await createSessionToken();

  const response = NextResponse.redirect(new URL('/', req.url));
  response.cookies.set('admin-session', sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 8, // 8 hours
  });
  return response;
}
