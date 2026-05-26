import { SubmitButton } from '../components/submit-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { broadcastAction } from '../actions/admin';

export default async function BroadcastPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const { sent, error } = await searchParams;
  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Broadcast Message</CardTitle>
          <CardDescription>
            Send a message and optional image to all active, fully-onboarded residents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={broadcastAction} className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                name="message"
                placeholder="Type your message here..."
                rows={5}
                className="resize-y"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="image">Attach Image (optional)</Label>
              <Input
                id="image"
                name="image"
                type="file"
                accept="image/*"
                className="cursor-pointer"
              />
            </div>
            
            {sent && (
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Success! Sent to {sent} residents.
              </p>
            )}
            
            {error && (
              <p className="text-sm font-medium text-destructive">
                {error === 'empty' ? 'Please provide a message or an image.' : 'Broadcast could not be sent. Please try again.'}
              </p>
            )}
            
            <SubmitButton className="w-full">Send Broadcast</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
