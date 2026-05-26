import { SubmitButton } from '../components/submit-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Admin Login</CardTitle>
          <CardDescription>
            Enter your admin password to access the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/api/login" method="post" className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
              />
              {error && <p className="text-sm font-medium text-destructive">Invalid password.</p>}
            </div>
            <SubmitButton className="w-full">Sign in</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
