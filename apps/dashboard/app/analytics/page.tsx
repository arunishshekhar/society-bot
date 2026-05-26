import { adminFetch, AdminRecord, text } from '../lib/admin-api';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const analytics = await adminFetch<AdminRecord>('/admin/analytics');
  const groups = (analytics?.workerGroups as AdminRecord[] | undefined) ?? [];
  const recent = (analytics?.recentResidents as AdminRecord[] | undefined) ?? [];
  return (
    <main className="mx-auto max-w-6xl px-6 py-8 text-zinc-950">
      <h1 className="text-2xl font-semibold">Analytics</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {['totalResidents', 'activeServices', 'activeCarpools', 'workerEntries'].map((key) => (
          <div key={key} className="rounded border border-zinc-200 bg-white p-4"><div className="text-sm text-zinc-500">{key}</div><div className="mt-2 text-2xl font-semibold">{text(analytics?.[key])}</div></div>
        ))}
      </div>
      <h2 className="mt-8 font-semibold">Top Worker Categories</h2>
      <ul className="mt-3 text-sm">{groups.map((g) => <li key={String(g.category)}>{text(g.category)}: {text((g._count as AdminRecord | undefined)?.category)}</li>)}</ul>
      <h2 className="mt-8 font-semibold">Recent Registrations</h2>
      <ul className="mt-3 text-sm">{recent.map((r) => <li key={String(r.id)}>{text(r.name)} - {text(r.flatNumber)}</li>)}</ul>
    </main>
  );
}
