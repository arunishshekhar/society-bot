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

// ── Residents ─────────────────────────────────────────────
export async function updateResidentAction(formData: FormData) {
  const id = String(formData.get('id'));
  await apiFetch(`/admin/residents/${id}`, 'PATCH', {
    name: formData.get('name') || undefined,
    flatNumber: formData.get('flatNumber') || undefined,
    phone: formData.get('phone') || null,
    isActive: formData.get('isActive') === 'true',
  });
  revalidatePath('/residents');
  redirect('/residents');
}

export async function deleteResidentAction(formData: FormData) {
  const id = String(formData.get('id'));
  await apiFetch(`/admin/residents/${id}`, 'DELETE');
  revalidatePath('/residents');
  redirect('/residents');
}

// ── Workers ────────────────────────────────────────────────
export async function createWorkerAction(formData: FormData) {
  const rating = formData.get('rating');
  await apiFetch('/admin/workers', 'POST', {
    name: formData.get('name'),
    phone: formData.get('phone'),
    category: formData.get('category'),
    rating: rating ? Number(rating) : null,
    notes: formData.get('notes') || null,
  });
  revalidatePath('/workers');
  redirect('/workers');
}

export async function updateWorkerAction(formData: FormData) {
  const id = String(formData.get('id'));
  const rating = formData.get('rating');
  await apiFetch(`/admin/workers/${id}`, 'PATCH', {
    name: formData.get('name') || undefined,
    phone: formData.get('phone') || undefined,
    category: formData.get('category') || undefined,
    rating: rating ? Number(rating) : null,
    notes: formData.get('notes') || null,
  });
  revalidatePath('/workers');
  redirect('/workers');
}

export async function deleteWorkerAction(formData: FormData) {
  const id = String(formData.get('id'));
  await apiFetch(`/admin/workers/${id}`, 'DELETE');
  revalidatePath('/workers');
  redirect('/workers');
}

export async function banWorkerAction(formData: FormData) {
  const id = String(formData.get('id'));
  const unban = formData.get('unban') === 'true';
  await apiFetch(`/admin/workers/${id}/${unban ? 'unban' : 'ban'}`, 'PATCH');
  revalidatePath('/workers');
  redirect('/workers');
}

// ── Services ───────────────────────────────────────────────
export async function createServiceAction(formData: FormData) {
  await apiFetch('/admin/services', 'POST', {
    name: formData.get('name'),
    category: formData.get('category'),
    description: formData.get('description') || null,
    timing: formData.get('timing') || '',
    contactPreference: formData.get('contactPreference') || 'telegram',
  });
  revalidatePath('/services');
  redirect('/services');
}

export async function updateServiceAction(formData: FormData) {
  const id = String(formData.get('id'));
  await apiFetch(`/admin/services/${id}`, 'PATCH', {
    name: formData.get('name') || undefined,
    category: formData.get('category') || undefined,
    description: formData.get('description') || null,
  });
  revalidatePath('/services');
  redirect('/services');
}

export async function toggleServiceAction(formData: FormData) {
  const id = String(formData.get('id'));
  const isDisabled = formData.get('isDisabled') === 'true';
  await apiFetch(`/admin/services/${id}/disable`, 'PATCH', { isDisabled });
  revalidatePath('/services');
  redirect('/services');
}

export async function deleteServiceAction(formData: FormData) {
  const id = String(formData.get('id'));
  await apiFetch(`/admin/services/${id}`, 'DELETE');
  revalidatePath('/services');
  redirect('/services');
}

// ── Carpool ────────────────────────────────────────────────
export async function updateCarpoolAction(formData: FormData) {
  const id = String(formData.get('id'));
  const seats = formData.get('seatsAvailable');
  await apiFetch(`/admin/carpool/${id}`, 'PATCH', {
    destinationAddress: formData.get('destinationAddress') || undefined,
    departureTime: formData.get('departureTime') || undefined,
    returnTime: formData.get('returnTime') || null,
    seatsAvailable: seats ? Number(seats) : undefined,
  });
  revalidatePath('/carpool');
  redirect('/carpool');
}

export async function toggleCarpoolAction(formData: FormData) {
  const id = String(formData.get('id'));
  const isPaused = formData.get('isPaused') === 'true';
  await apiFetch(`/admin/carpool/${id}`, 'PATCH', { isPaused });
  revalidatePath('/carpool');
  redirect('/carpool');
}

export async function deleteCarpoolAction(formData: FormData) {
  const id = String(formData.get('id'));
  await apiFetch(`/admin/carpool/${id}`, 'DELETE');
  revalidatePath('/carpool');
  redirect('/carpool');
}

// ── Categories ─────────────────────────────────────────────
export async function createCategoryAction(formData: FormData) {
  const type = String(formData.get('type'));
  await apiFetch('/admin/categories', 'POST', {
    name: formData.get('name'),
    type,
  });
  revalidatePath(type === 'worker' ? '/workers' : '/services');
  redirect(type === 'worker' ? '/workers' : '/services');
}

export async function deleteCategoryAction(formData: FormData) {
  const id = String(formData.get('id'));
  const type = String(formData.get('type'));
  await apiFetch(`/admin/categories/${id}`, 'DELETE');
  revalidatePath(type === 'worker' ? '/workers' : '/services');
  redirect(type === 'worker' ? '/workers' : '/services');
}

// ── Broadcast ──────────────────────────────────────────────
export async function broadcastAction(formData: FormData) {
  const message = String(formData.get('message') ?? '').trim();
  const imageFile = formData.get('image') as File | null;

  if (!message && (!imageFile || imageFile.size === 0)) {
    redirect('/broadcast?error=empty');
  }

  formData.append('sentBy', 'dashboard');

  let success = false;
  let sentCount = 0;
  
  try {
    const res = await fetch(`${api}/admin/broadcast`, {
      method: 'POST',
      headers: { 'x-admin-api-key': key },
      body: formData,
      cache: 'no-store',
    });

    if (res.ok) {
      success = true;
      const result = (await res.json()) as { recipientCount?: number };
      sentCount = result.recipientCount ?? 0;
    }
  } catch {
    success = false;
  }
  
  if (success) {
    redirect(`/broadcast?sent=${sentCount}`);
  } else {
    redirect('/broadcast?error=send');
  }
}

