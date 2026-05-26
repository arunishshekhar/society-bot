import { adminFetch, AdminRecord, text } from '../lib/admin-api';

export const dynamic = 'force-dynamic';

export default async function CarpoolPage() {
  const routes = (await adminFetch<AdminRecord[]>('/admin/carpool')) ?? [];
  return (
    <main className="mx-auto max-w-6xl px-6 py-8 text-zinc-950">
      <h1 className="text-2xl font-semibold">Carpool</h1>
      <table className="mt-6 w-full border-collapse text-sm">
        <thead><tr className="border-b text-left"><th className="py-2">Destination</th><th>Time</th><th>Seats</th><th>Days</th><th>Resident</th></tr></thead>
        <tbody>{routes.map((r) => {
          const resident = r.resident as AdminRecord | undefined;
          return <tr key={String(r.id)} className="border-b"><td className="py-2">{text(r.destination)}</td><td>{text(r.departureTime)}</td><td>{text(r.seatsAvailable)}</td><td>{Array.isArray(r.days) ? r.days.join(', ') : '-'}</td><td>{text(resident?.flatNumber)}</td></tr>;
        })}</tbody>
      </table>
    </main>
  );
}
