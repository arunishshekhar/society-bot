'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch } from '../lib/api-client';

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
