import { adminFetch, AdminRecord, text } from '../lib/admin-api';

export const dynamic = 'force-dynamic';

export default async function WorkersPage() {
  const workers = (await adminFetch<AdminRecord[]>('/admin/workers')) ?? [];
  return (
    <main className="mx-auto max-w-6xl px-6 py-8 text-zinc-950">
      <h1 className="text-2xl font-semibold">Workers</h1>
      <table className="mt-6 w-full border-collapse text-sm">
        <thead><tr className="border-b text-left"><th className="py-2">Name</th><th>Category</th><th>Phone</th><th>Rating</th><th>Added By</th><th>Status</th></tr></thead>
        <tbody>{workers.map((w) => {
          const resident = w.resident as AdminRecord | undefined;
          return <tr key={String(w.id)} className="border-b"><td className="py-2">{text(w.name)}</td><td>{text(w.category)}</td><td>{text(w.phone)}</td><td>{text(w.rating)}</td><td>{text(resident?.flatNumber)}</td><td>{w.isBanned ? 'Banned' : 'Visible'}</td></tr>;
        })}</tbody>
      </table>
    </main>
  );
}
