import { adminFetch, AdminRecord, text } from '../lib/admin-api';
import { updateResidentAction } from '../actions/admin';
import { DeleteButton } from './delete-button';

export const dynamic = 'force-dynamic';

export default async function ResidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; edit?: string }>;
}) {
  const { search: rawSearch, edit: editId } = await searchParams;
  const search = rawSearch ?? '';
  const residents = (await adminFetch<AdminRecord[]>(`/admin/residents?search=${encodeURIComponent(search)}`)) ?? [];

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 text-zinc-950">
      <h1 className="text-2xl font-semibold">Residents</h1>
      <form className="mt-5 flex gap-2">
        <input name="search" defaultValue={search} placeholder="Search name or flat" className="w-full max-w-md rounded border border-zinc-300 px-3 py-2 text-sm" />
        <button className="rounded bg-zinc-900 px-4 py-2 text-sm text-white">Search</button>
      </form>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-zinc-500">
            <th className="py-2">Name</th>
            <th>Flat</th>
            <th>Phone</th>
            <th>Status</th>
            <th>Vehicles</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {residents.map((r) => (
            <>
              <tr key={String(r.id)} className="border-b">
                <td className="py-2">{text(r.name)}</td>
                <td>{text(r.flatNumber)}</td>
                <td>{text(r.phone)}</td>
                <td>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${r.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                    {r.isActive ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td>{Array.isArray(r.vehicles) ? r.vehicles.length : 0}</td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    <a href={`/residents?search=${search}&edit=${r.id}`} className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50">Edit</a>
                    <DeleteButton id={String(r.id)} />
                  </div>
                </td>
              </tr>
              {editId === String(r.id) && (
                <tr key={`edit-${String(r.id)}`} className="bg-zinc-50">
                  <td colSpan={6} className="p-4">
                    <form action={updateResidentAction} className="flex flex-wrap gap-3">
                      <input type="hidden" name="id" value={String(r.id)} />
                      <input name="name" defaultValue={text(r.name)} placeholder="Name" className="rounded border border-zinc-300 px-3 py-1.5 text-sm" />
                      <input name="flatNumber" defaultValue={text(r.flatNumber)} placeholder="Flat" className="rounded border border-zinc-300 px-3 py-1.5 text-sm" />
                      <input name="phone" defaultValue={text(r.phone) === '-' ? '' : text(r.phone)} placeholder="Phone" className="rounded border border-zinc-300 px-3 py-1.5 text-sm" />
                      <select name="isActive" defaultValue={String(r.isActive)} className="rounded border border-zinc-300 px-3 py-1.5 text-sm">
                        <option value="true">Active</option>
                        <option value="false">Disabled</option>
                      </select>
                      <button type="submit" className="rounded bg-zinc-900 px-4 py-1.5 text-sm text-white">Save</button>
                      <a href="/residents" className="rounded border border-zinc-300 px-4 py-1.5 text-sm">Cancel</a>
                    </form>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
      {residents.length === 0 && <p className="mt-6 text-sm text-zinc-500">No residents found.</p>}
    </main>
  );
}
