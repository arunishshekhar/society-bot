import { adminFetch, AdminRecord, text } from '../lib/admin-api';

export const dynamic = 'force-dynamic';

export default async function ServicesPage() {
  const services = (await adminFetch<AdminRecord[]>('/admin/services')) ?? [];
  return (
    <main className="mx-auto max-w-6xl px-6 py-8 text-zinc-950">
      <h1 className="text-2xl font-semibold">Services</h1>
      <table className="mt-6 w-full border-collapse text-sm">
        <thead><tr className="border-b text-left"><th className="py-2">Name</th><th>Category</th><th>Resident</th><th>Status</th></tr></thead>
        <tbody>{services.map((s) => {
          const resident = s.resident as AdminRecord | undefined;
          return <tr key={String(s.id)} className="border-b"><td className="py-2">{text(s.name)}</td><td>{text(s.category)}</td><td>{text(resident?.flatNumber)}</td><td>{s.isDisabled ? 'Disabled' : s.isPaused ? 'Paused' : 'Active'}</td></tr>;
        })}</tbody>
      </table>
    </main>
  );
}
