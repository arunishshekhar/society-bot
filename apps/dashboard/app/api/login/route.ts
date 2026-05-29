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
    return new Response(null, {
      status: 303,
      headers: { Location: new URL('/login?error=1', req.url).toString() },
    });
  }

  // Create a stateless HMAC-signed token — works across Edge and Node.js runtimes.
  const sessionToken = await createSessionToken();

  const response = new Response(null, {
    status: 303,
    headers: { Location: new URL('/', req.url).toString() },
  });
  
  // Need to set cookie manually on standard Response
  const cookieHeader = `admin-session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 8}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
  response.headers.set('Set-Cookie', cookieHeader);
  
  return response;
}
