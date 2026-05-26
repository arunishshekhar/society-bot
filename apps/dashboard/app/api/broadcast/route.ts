import { NextResponse, type NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const message = String(form.get('message') ?? '').trim();
  const imageFile = form.get('image') as File | null;

  if (!message && (!imageFile || imageFile.size === 0)) {
    return NextResponse.redirect(new URL('/broadcast?error=empty', req.url));
  }

  if (!process.env.ADMIN_API_URL || !process.env.ADMIN_API_KEY) {
    return NextResponse.redirect(new URL('/broadcast?error=config', req.url));
  }

  form.append('sentBy', 'dashboard');

  try {
    const response = await fetch(`${process.env.ADMIN_API_URL}/admin/broadcast`, {
      method: 'POST',
      headers: {
        'x-admin-api-key': process.env.ADMIN_API_KEY,
      },
      body: form,
    });

    if (!response.ok) {
      return NextResponse.redirect(new URL('/broadcast?error=send', req.url));
    }

    const result = (await response.json()) as { recipientCount?: number };
    return NextResponse.redirect(new URL(`/broadcast?sent=${result.recipientCount ?? 0}`, req.url));
  } catch {
    return NextResponse.redirect(new URL('/broadcast?error=send', req.url));
  }
}
