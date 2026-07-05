'use client';

import { useTransition } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { deleteBroadcastAction } from '../actions/admin';

interface Broadcast {
  id: string;
  message: unknown;
  sentAt: unknown;
  sentBy: unknown;
  recipientCount: unknown;
}

function text(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

function DeleteButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm('Delete this broadcast? This will attempt to recall the messages from all recipients\' chats.')) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set('id', id);
      await deleteBroadcastAction(formData);
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
      onClick={handleDelete}
      disabled={isPending}
      aria-label="Delete broadcast"
      title="Delete broadcast and recall messages"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}

export function BroadcastHistory({ broadcasts }: { broadcasts: Broadcast[] }) {
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Message Preview</TableHead>
            <TableHead className="text-right">Recipients</TableHead>
            <TableHead className="w-[48px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {broadcasts.map((b) => (
            <TableRow key={b.id}>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {new Date(String(b.sentAt)).toLocaleDateString()}{' '}
                {new Date(String(b.sentAt)).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </TableCell>
              <TableCell
                className="max-w-[200px] truncate"
                title={text(b.message)}
              >
                {text(b.message) || '(Image only)'}
              </TableCell>
              <TableCell className="text-right">
                {String(b.recipientCount)}
              </TableCell>
              <TableCell className="text-right pr-2">
                <DeleteButton id={b.id} />
              </TableCell>
            </TableRow>
          ))}
          {broadcasts.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="h-24 text-center">
                No past broadcasts found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
