'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const api = process.env.ADMIN_API_URL ?? 'http://localhost:3001';
const key = process.env.ADMIN_API_KEY ?? '';

async function apiFetch(path: string, method: string, body?: unknown) {
  try {
    const res = await fetch(`${api}${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-admin-api-key': key },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function createFaqAction(formData: FormData) {
  await apiFetch('/admin/faqs', 'POST', {
    question: formData.get('question'),
    answer: formData.get('answer'),
  });
  revalidatePath('/faq');
  redirect('/faq');
}

export async function updateFaqAction(formData: FormData) {
  const id = String(formData.get('id'));
  await apiFetch(`/admin/faqs/${id}`, 'PATCH', {
    question: formData.get('question') || undefined,
    answer: formData.get('answer') || undefined,
  });
  revalidatePath('/faq');
  redirect('/faq');
}

export async function deleteFaqAction(formData: FormData) {
  const id = String(formData.get('id'));
  await apiFetch(`/admin/faqs/${id}`, 'DELETE');
  revalidatePath('/faq');
  redirect('/faq');
}
