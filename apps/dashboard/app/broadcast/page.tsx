import { SubmitButton } from '../components/submit-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { broadcastAction } from '../actions/admin';
import { adminFetch, AdminRecord, text } from '../lib/admin-api';
import React from 'react';

export const dynamic = 'force-dynamic';

export default async function BroadcastPage({ searchParams }: { searchParams: Promise<{ sent?: string; pinged?: string; error?: string }> }) {
  const { sent, pinged, error } = await searchParams;
  const broadcasts = await adminFetch<AdminRecord[]>('/admin/broadcast') ?? [];

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      <Card className="mx-auto max-w-2xl mb-8">
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
                className="resize-y bg-background"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="image">Attach Image (optional)</Label>
              <Input
                id="image"
                name="image"
                type="file"
                accept="image/*"
                className="cursor-pointer bg-background"
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

      <Card className="mx-auto max-w-2xl mb-8 border-amber-200 dark:border-amber-900/50">
        <CardHeader className="bg-amber-50 dark:bg-amber-950/20 rounded-t-lg">
          <CardTitle className="text-xl text-amber-800 dark:text-amber-400">Group Actions</CardTitle>
          <CardDescription className="text-amber-700/80 dark:text-amber-400/80">
            Tag users in the group who have not completed their bot registration.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form action={async () => {
            'use server';
            const { pingUnregisteredAction } = await import('../actions/admin');
            await pingUnregisteredAction();
          }}>
            <p className="text-sm text-muted-foreground mb-4">
              This action will scan the bot's database for users who haven't completed onboarding, check if they are currently members of the society group, and send a single message tagging all of them with instructions to start the bot.
            </p>
            {pinged && (
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-4">
                Success! Pinged {pinged} unregistered residents in the group.
              </p>
            )}
            {error === 'ping' && (
              <p className="text-sm font-medium text-destructive mb-4">
                Failed to send ping. Make sure the bot is an admin in the group.
              </p>
            )}
            <SubmitButton className="w-full sm:w-auto" variant="secondary">Ping Unregistered Members</SubmitButton>
          </form>
        </CardContent>
      </Card>

      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle className="text-xl">Broadcast History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Message Preview</TableHead>
                  <TableHead className="text-right">Recipients</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {broadcasts.map((b) => (
                  <TableRow key={String(b.id)}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {new Date(String(b.sentAt)).toLocaleDateString()} {new Date(String(b.sentAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={text(b.message)}>
                      {text(b.message) || "(Image only)"}
                    </TableCell>
                    <TableCell className="text-right">
                      {String(b.recipientCount)}
                    </TableCell>
                  </TableRow>
                ))}
                {broadcasts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center">
                      No past broadcasts found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
