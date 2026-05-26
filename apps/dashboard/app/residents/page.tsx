import { adminFetch, AdminRecord, text } from '../lib/admin-api';

export const dynamic = 'force-dynamic';

export default async function ResidentsPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const { search: rawSearch } = await searchParams;
  const search = rawSearch ?? '';
  const residents = (await adminFetch<AdminRecord[]>(`/admin/residents?search=${encodeURIComponent(search)}`)) ?? [];
  return (
    <main className="mx-auto max-w-6xl px-6 py-8 text-zinc-950">
      <h1 className="text-2xl font-semibold">Residents</h1>
      <form className="mt-5"><input name="search" defaultValue={search} placeholder="Search name or flat" className="w-full max-w-md rounded border border-zinc-300 px-3 py-2 text-sm" /></form>
      <table className="mt-6 w-full border-collapse text-sm">
        <thead><tr className="border-b text-left"><th className="py-2">Name</th><th>Flat</th><th>Telegram</th><th>Status</th><th>Vehicles</th></tr></thead>
        <tbody>{residents.map((r) => <tr key={String(r.id)} className="border-b"><td className="py-2">{text(r.name)}</td><td>{text(r.flatNumber)}</td><td>{text(r.telegramId)}</td><td>{r.isActive ? 'Active' : 'Disabled'}</td><td>{Array.isArray(r.vehicles) ? r.vehicles.length : 0}</td></tr>)}</tbody>
      </table>
    </main>
  );
}
