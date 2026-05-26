import { adminFetch, AdminRecord, text } from './lib/admin-api';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ plate?: string }> }) {
  const { plate: rawPlate } = await searchParams;
  const plate = rawPlate?.trim();
  const vehicle = plate
    ? await adminFetch<AdminRecord>(`/admin/vehicles/lookup?plate=${encodeURIComponent(plate)}`)
    : null;
  const resident = vehicle?.resident as AdminRecord | undefined;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 text-zinc-950">
      <h1 className="text-2xl font-semibold">Vehicle Lookup</h1>
      <form className="mt-5 flex max-w-xl gap-2">
        <input name="plate" defaultValue={plate} placeholder="KA01AB1234" className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm" />
        <button className="rounded bg-zinc-950 px-4 py-2 text-sm font-medium text-white">Search</button>
      </form>
      {plate && !vehicle ? <p className="mt-6 text-sm text-zinc-600">No vehicle found.</p> : null}
      {vehicle ? (
        <section className="mt-6 rounded border border-zinc-200 bg-white p-4">
          <h2 className="font-medium">{text(vehicle.number)}</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-zinc-500">Owner</dt><dd>{text(resident?.name)}</dd></div>
            <div><dt className="text-zinc-500">Flat</dt><dd>{text(resident?.flatNumber)}</dd></div>
            <div><dt className="text-zinc-500">Phone</dt><dd>{text(resident?.phone)}</dd></div>
            <div><dt className="text-zinc-500">Parking</dt><dd>{text(vehicle.parkingSlot)}</dd></div>
            <div><dt className="text-zinc-500">Model</dt><dd>{text(vehicle.model)}</dd></div>
            <div><dt className="text-zinc-500">Color</dt><dd>{text(vehicle.color)}</dd></div>
          </dl>
        </section>
      ) : null}
    </main>
  );
}
