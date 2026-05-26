export default async function BroadcastPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const { sent, error } = await searchParams;
  return (
    <main className="mx-auto max-w-3xl px-6 py-8 text-zinc-950">
      <h1 className="text-2xl font-semibold">Broadcast</h1>
      <form action="/api/broadcast" method="post" encType="multipart/form-data" className="mt-6 rounded border border-zinc-200 bg-white p-4">
        <textarea name="message" rows={8} placeholder="Compose announcement" className="w-full rounded border border-zinc-300 px-3 py-2 text-sm" />
        <input type="file" name="image" accept="image/*" className="mt-4 block w-full text-sm text-zinc-500 file:mr-4 file:rounded file:border-0 file:bg-zinc-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-zinc-700 hover:file:bg-zinc-200" />
        <div className="mt-4 rounded bg-zinc-50 p-3 text-sm">
          <div className="font-medium">Society Notice</div>
          <p className="mt-1 text-zinc-600">Your message will be sent to all active residents.</p>
        </div>
        {sent ? <p className="mt-4 text-sm text-green-700">Sent to {sent} residents.</p> : null}
        {error ? <p className="mt-4 text-sm text-red-600">Broadcast could not be sent.</p> : null}
        <button className="mt-4 rounded bg-zinc-950 px-4 py-2 text-sm font-medium text-white">Send to active residents</button>
      </form>
    </main>
  );
}
