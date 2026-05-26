import { adminFetch, AdminRecord, text } from '../lib/admin-api';
import {
  createServiceAction,
  updateServiceAction,
  toggleServiceAction,
  deleteServiceAction,
  createCategoryAction,
  deleteCategoryAction,
} from '../actions/admin';
import { SubmitButton } from '../components/submit-button';

export const dynamic = 'force-dynamic';

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; add?: string; addcat?: string }>;
}) {
  const { edit: editId, add, addcat } = await searchParams;
  const [services, categories] = await Promise.all([
    adminFetch<AdminRecord[]>('/admin/services') ?? [],
    adminFetch<AdminRecord[]>('/admin/categories?type=service') ?? [],
  ]);
  const serviceList = services ?? [];
  const categoryList = categories ?? [];
  const categoryNames = categoryList.map((c) => String(c.name));

  const allCategories = [...new Set([
    'cleaning', 'cooking', 'tutoring', 'repair', 'healthcare', 'transport', 'other',
    ...categoryNames,
  ])].sort();

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 text-zinc-950">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Services</h1>
        <div className="flex gap-2">
          <a href="/services?addcat=1" className="rounded border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50">+ Category</a>
          <a href="/services?add=1" className="rounded bg-zinc-900 px-3 py-2 text-sm text-white">+ Add Service</a>
        </div>
      </div>

      {/* Category Manager */}
      {addcat && (
        <section className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-4">
          <h2 className="mb-3 font-medium">Manage Service Categories</h2>
          <form action={createCategoryAction} className="flex gap-2">
            <input type="hidden" name="type" value="service" />
            <input name="name" placeholder="New category name" required className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm" />
            <SubmitButton className="rounded bg-zinc-900 px-4 py-2 text-sm text-white">Add</SubmitButton>
            <a href="/services" className="rounded border border-zinc-300 px-4 py-2 text-sm">Close</a>
          </form>
          {categoryList.length > 0 && (
            <ul className="mt-4 space-y-1">
              {categoryList.map((c) => (
                <li key={String(c.id)} className="flex items-center justify-between rounded bg-white px-3 py-2 text-sm border border-zinc-200">
                  <span className="capitalize">{text(c.name)}</span>
                  <form action={deleteCategoryAction}>
                    <input type="hidden" name="id" value={String(c.id)} />
                    <input type="hidden" name="type" value="service" />
                    <SubmitButton className="text-xs text-red-500 hover:text-red-700">Remove</SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Add Service Form */}
      {add && (
        <section className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-4">
          <h2 className="mb-3 font-medium">Add Service</h2>
          <form action={createServiceAction} className="grid gap-3 sm:grid-cols-2">
            <input name="name" placeholder="Service name *" required className="rounded border border-zinc-300 px-3 py-2 text-sm" />
            <select name="category" required className="rounded border border-zinc-300 px-3 py-2 text-sm">
              {allCategories.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
            </select>
            <input name="timing" placeholder="Timing (e.g. 9am-5pm)" className="rounded border border-zinc-300 px-3 py-2 text-sm" />
            <select name="contactPreference" className="rounded border border-zinc-300 px-3 py-2 text-sm">
              <option value="telegram">Contact via Telegram</option>
              <option value="phone">Contact via Phone</option>
            </select>
            <textarea name="description" placeholder="Description" className="rounded border border-zinc-300 px-3 py-2 text-sm sm:col-span-2" rows={2} />
            <div className="flex gap-2 sm:col-span-2">
              <SubmitButton className="rounded bg-zinc-900 px-4 py-2 text-sm text-white">Save</SubmitButton>
              <a href="/services" className="rounded border border-zinc-300 px-4 py-2 text-sm">Cancel</a>
            </div>
          </form>
        </section>
      )}

      {/* Services Table */}
      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-zinc-500">
            <th className="py-2">Name</th>
            <th>Category</th>
            <th>Resident</th>
            <th>Status</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {serviceList.map((s) => {
            const resident = s.resident as AdminRecord | undefined;
            return (
              <>
                <tr key={String(s.id)} className="border-b">
                  <td className="py-2 font-medium">{text(s.name)}</td>
                  <td className="capitalize">{text(s.category)}</td>
                  <td>{resident ? text(resident.flatNumber) : 'Admin'}</td>
                  <td>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                      s.isDisabled ? 'bg-red-100 text-red-600' : s.isPaused ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {s.isDisabled ? 'Disabled' : s.isPaused ? 'Paused' : 'Active'}
                    </span>
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <a href={`/services?edit=${s.id}`} className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50">Edit</a>
                      <form action={toggleServiceAction}>
                        <input type="hidden" name="id" value={String(s.id)} />
                        <input type="hidden" name="isDisabled" value={String(!s.isDisabled)} />
                        <SubmitButton className={`rounded border px-2 py-1 text-xs ${s.isDisabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                          {s.isDisabled ? 'Enable' : 'Disable'}
                        </SubmitButton>
                      </form>
                      <form action={deleteServiceAction}>
                        <input type="hidden" name="id" value={String(s.id)} />
                        <SubmitButton className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100">Del</SubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
                {editId === String(s.id) && (
                  <tr key={`edit-${String(s.id)}`} className="bg-zinc-50">
                    <td colSpan={5} className="p-4">
                      <form action={updateServiceAction} className="grid gap-3 sm:grid-cols-2">
                        <input type="hidden" name="id" value={String(s.id)} />
                        <input name="name" defaultValue={text(s.name)} placeholder="Name" className="rounded border border-zinc-300 px-3 py-2 text-sm" />
                        <select name="category" defaultValue={String(s.category)} className="rounded border border-zinc-300 px-3 py-2 text-sm">
                          {allCategories.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
                        </select>
                        <textarea name="description" defaultValue={String(s.description ?? '')} placeholder="Description" className="rounded border border-zinc-300 px-3 py-2 text-sm sm:col-span-2" rows={2} />
                        <div className="flex gap-2 sm:col-span-2">
                          <SubmitButton className="rounded bg-zinc-900 px-4 py-2 text-sm text-white">Save</SubmitButton>
                          <a href="/services" className="rounded border border-zinc-300 px-4 py-2 text-sm">Cancel</a>
                        </div>
                      </form>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
      {serviceList.length === 0 && <p className="mt-6 text-sm text-zinc-500">No services found.</p>}
    </main>
  );
}
