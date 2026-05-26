import { SubmitButton } from "../components/submit-button";
import { adminFetch, AdminRecord, text } from '../lib/admin-api';
import { updateCarpoolAction, toggleCarpoolAction, deleteCarpoolAction } from '../actions/admin';

export const dynamic = 'force-dynamic';

export default async function CarpoolPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit: editId } = await searchParams;
  const routes = (await adminFetch<AdminRecord[]>('/admin/carpool')) ?? [];

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 text-zinc-950">
      <h1 className="text-2xl font-semibold">Carpool Routes</h1>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-zinc-500">
            <th className="py-2">Destination</th>
            <th>Departure</th>
            <th>Return</th>
            <th>Seats</th>
            <th>Days</th>
            <th>Resident</th>
            <th>Status</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {routes.map((r) => {
            const resident = r.resident as AdminRecord | undefined;
            return (
              <>
                <tr key={String(r.id)} className="border-b">
                  <td className="py-2 font-medium">{text(r.destination)}</td>
                  <td>{text(r.departureTime)}</td>
                  <td>{text(r.returnTime)}</td>
                  <td>{text(r.seatsAvailable)}</td>
                  <td className="max-w-[120px] truncate">{Array.isArray(r.days) ? (r.days as string[]).join(', ') : '-'}</td>
                  <td>{text(resident?.flatNumber)}</td>
                  <td>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${r.isPaused ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {r.isPaused ? 'Paused' : 'Active'}
                    </span>
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <a href={`/carpool?edit=${r.id}`} className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50">Edit</a>
                      <form action={toggleCarpoolAction}>
                        <input type="hidden" name="id" value={String(r.id)} />
                        <input type="hidden" name="isPaused" value={String(!r.isPaused)} />
                        <SubmitButton className={`rounded border px-2 py-1 text-xs ${r.isPaused ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                          {r.isPaused ? 'Resume' : 'Pause'}
                        </SubmitButton>
                      </form>
                      <form action={deleteCarpoolAction}>
                        <input type="hidden" name="id" value={String(r.id)} />
                        <SubmitButton className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100">Del</SubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
                {editId === String(r.id) && (
                  <tr key={`edit-${String(r.id)}`} className="bg-zinc-50">
                    <td colSpan={8} className="p-4">
                      <form action={updateCarpoolAction} className="flex flex-wrap gap-3">
                        <input type="hidden" name="id" value={String(r.id)} />
                        <input name="destination" defaultValue={text(r.destination)} placeholder="Destination" className="rounded border border-zinc-300 px-3 py-1.5 text-sm" />
                        <input name="departureTime" defaultValue={text(r.departureTime)} placeholder="Departure time" className="rounded border border-zinc-300 px-3 py-1.5 text-sm" />
                        <input name="returnTime" defaultValue={text(r.returnTime) === '-' ? '' : text(r.returnTime)} placeholder="Return time (optional)" className="rounded border border-zinc-300 px-3 py-1.5 text-sm" />
                        <input name="seatsAvailable" type="number" min="1" defaultValue={String(r.seatsAvailable ?? 1)} placeholder="Seats" className="w-24 rounded border border-zinc-300 px-3 py-1.5 text-sm" />
                        <SubmitButton className="rounded bg-zinc-900 px-4 py-1.5 text-sm text-white">Save</SubmitButton>
                        <a href="/carpool" className="rounded border border-zinc-300 px-4 py-1.5 text-sm">Cancel</a>
                      </form>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
      {routes.length === 0 && <p className="mt-6 text-sm text-zinc-500">No carpool routes found.</p>}
    </main>
  );
}
