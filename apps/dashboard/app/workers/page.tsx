import { adminFetch, AdminRecord, text } from '../lib/admin-api';
import {
  createWorkerAction,
  updateWorkerAction,
  deleteWorkerAction,
  banWorkerAction,
  createCategoryAction,
  deleteCategoryAction,
} from '../actions/admin';

export const dynamic = 'force-dynamic';

export default async function WorkersPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; add?: string; addcat?: string }>;
}) {
  const { edit: editId, add, addcat } = await searchParams;
  const [workers, categories] = await Promise.all([
    adminFetch<AdminRecord[]>('/admin/workers') ?? [],
    adminFetch<AdminRecord[]>('/admin/categories?type=worker') ?? [],
  ]);
  const workerList = workers ?? [];
  const categoryList = categories ?? [];
  const categoryNames = categoryList.map((c) => String(c.name));

  const allCategories = [...new Set([
    'plumber', 'electrician', 'maid', 'carpenter', 'ac repair',
    'painter', 'driver', 'cook', 'other',
    ...categoryNames,
  ])].sort();

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 text-zinc-950">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Workers</h1>
        <div className="flex gap-2">
          <a href="/workers?addcat=1" className="rounded border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50">+ Category</a>
          <a href="/workers?add=1" className="rounded bg-zinc-900 px-3 py-2 text-sm text-white">+ Add Worker</a>
        </div>
      </div>

      {/* Category Manager */}
      {addcat && (
        <section className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-4">
          <h2 className="mb-3 font-medium">Manage Worker Categories</h2>
          <form action={createCategoryAction} className="flex gap-2">
            <input type="hidden" name="type" value="worker" />
            <input name="name" placeholder="New category name" required className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm" />
            <button type="submit" className="rounded bg-zinc-900 px-4 py-2 text-sm text-white">Add</button>
            <a href="/workers" className="rounded border border-zinc-300 px-4 py-2 text-sm">Close</a>
          </form>
          {categoryList.length > 0 && (
            <ul className="mt-4 space-y-1">
              {categoryList.map((c) => (
                <li key={String(c.id)} className="flex items-center justify-between rounded bg-white px-3 py-2 text-sm border border-zinc-200">
                  <span className="capitalize">{text(c.name)}</span>
                  <form action={deleteCategoryAction}>
                    <input type="hidden" name="id" value={String(c.id)} />
                    <input type="hidden" name="type" value="worker" />
                    <button type="submit" className="text-xs text-red-500 hover:text-red-700">Remove</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Add Worker Form */}
      {add && (
        <section className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-4">
          <h2 className="mb-3 font-medium">Add Worker</h2>
          <form action={createWorkerAction} className="grid gap-3 sm:grid-cols-2">
            <input name="name" placeholder="Name *" required className="rounded border border-zinc-300 px-3 py-2 text-sm" />
            <input name="phone" placeholder="Phone *" required className="rounded border border-zinc-300 px-3 py-2 text-sm" />
            <select name="category" required className="rounded border border-zinc-300 px-3 py-2 text-sm">
              {allCategories.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
            </select>
            <select name="rating" className="rounded border border-zinc-300 px-3 py-2 text-sm">
              <option value="">No rating</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} ★</option>)}
            </select>
            <textarea name="notes" placeholder="Notes" className="rounded border border-zinc-300 px-3 py-2 text-sm sm:col-span-2" rows={2} />
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" className="rounded bg-zinc-900 px-4 py-2 text-sm text-white">Save</button>
              <a href="/workers" className="rounded border border-zinc-300 px-4 py-2 text-sm">Cancel</a>
            </div>
          </form>
        </section>
      )}

      {/* Workers Table */}
      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-zinc-500">
            <th className="py-2">Name</th>
            <th>Phone</th>
            <th>Category</th>
            <th>Rating</th>
            <th>Status</th>
            <th>Added by</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {workerList.map((w) => (
            <>
              <tr key={String(w.id)} className="border-b">
                <td className="py-2 font-medium">{text(w.name)}</td>
                <td>{text(w.phone)}</td>
                <td className="capitalize">{text(w.category)}</td>
                <td>{w.rating ? `${w.rating} ★` : '-'}</td>
                <td>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                    w.isBanned ? 'bg-red-100 text-red-600' : w.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
                  }`}>
                    {w.isBanned ? 'Banned' : w.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>{w.resident ? text((w.resident as AdminRecord).flatNumber) : 'Admin'}</td>
                <td>
                  <div className="flex justify-end gap-1">
                    <a href={`/workers?edit=${w.id}`} className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50">Edit</a>
                    <form action={banWorkerAction}>
                      <input type="hidden" name="id" value={String(w.id)} />
                      <input type="hidden" name="unban" value={String(!!w.isBanned)} />
                      <button type="submit" className={`rounded border px-2 py-1 text-xs ${w.isBanned ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                        {w.isBanned ? 'Unban' : 'Ban'}
                      </button>
                    </form>
                    <form action={deleteWorkerAction}>
                      <input type="hidden" name="id" value={String(w.id)} />
                      <button type="submit" className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100">Del</button>
                    </form>
                  </div>
                </td>
              </tr>
              {editId === String(w.id) && (
                <tr key={`edit-${String(w.id)}`} className="bg-zinc-50">
                  <td colSpan={7} className="p-4">
                    <form action={updateWorkerAction} className="grid gap-3 sm:grid-cols-2">
                      <input type="hidden" name="id" value={String(w.id)} />
                      <input name="name" defaultValue={text(w.name)} placeholder="Name" className="rounded border border-zinc-300 px-3 py-2 text-sm" />
                      <input name="phone" defaultValue={text(w.phone)} placeholder="Phone" className="rounded border border-zinc-300 px-3 py-2 text-sm" />
                      <select name="category" defaultValue={String(w.category)} className="rounded border border-zinc-300 px-3 py-2 text-sm">
                        {allCategories.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
                      </select>
                      <select name="rating" defaultValue={String(w.rating ?? '')} className="rounded border border-zinc-300 px-3 py-2 text-sm">
                        <option value="">No rating</option>
                        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} ★</option>)}
                      </select>
                      <textarea name="notes" defaultValue={String(w.notes ?? '')} placeholder="Notes" className="rounded border border-zinc-300 px-3 py-2 text-sm sm:col-span-2" rows={2} />
                      <div className="flex gap-2 sm:col-span-2">
                        <button type="submit" className="rounded bg-zinc-900 px-4 py-2 text-sm text-white">Save</button>
                        <a href="/workers" className="rounded border border-zinc-300 px-4 py-2 text-sm">Cancel</a>
                      </div>
                    </form>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
      {workerList.length === 0 && <p className="mt-6 text-sm text-zinc-500">No workers found.</p>}
    </main>
  );
}
