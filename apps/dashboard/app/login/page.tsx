export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 text-zinc-950">
      <form action="/api/login" method="post" className="w-full max-w-sm rounded border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold">Admin Login</h1>
        <input
          name="password"
          type="password"
          placeholder="Password"
          className="mt-5 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
        />
        {error ? <p className="mt-3 text-sm text-red-600">Invalid password.</p> : null}
        <button className="mt-5 w-full rounded bg-zinc-950 px-3 py-2 text-sm font-medium text-white">
          Sign in
        </button>
      </form>
    </main>
  );
}
