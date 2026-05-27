import { SubmitButton } from '../components/submit-button';
import { adminFetch, AdminRecord, text } from '../lib/admin-api';
import { createFaqAction, updateFaqAction } from '../actions/faq';
import { DeleteButton } from './delete-button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button, buttonVariants } from '@/components/ui/button';
import Link from 'next/link';
import React from 'react';

export const dynamic = 'force-dynamic';

export default async function FaqPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit: editId } = await searchParams;
  const faqs = (await adminFetch<AdminRecord[]>('/admin/faqs')) ?? [];

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Society FAQs</h1>
      </div>

      <div className="mb-8 rounded-md border p-4 bg-muted/30">
        <h2 className="text-lg font-medium mb-4">Add New FAQ</h2>
        <form action={createFaqAction} className="flex flex-col gap-4 max-w-2xl">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Question</label>
            <Input name="question" placeholder="e.g., What are the gym timings?" required />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Answer</label>
            <Textarea name="answer" placeholder="Provide a detailed answer..." required rows={3} />
          </div>
          <SubmitButton className="w-fit">Add FAQ</SubmitButton>
        </form>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Question</TableHead>
              <TableHead>Answer</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {faqs.map((f) => (
              <React.Fragment key={String(f.id)}>
                <TableRow>
                  <TableCell className="font-medium align-top">{text(f.question)}</TableCell>
                  <TableCell className="whitespace-pre-wrap align-top max-w-md">{text(f.answer)}</TableCell>
                  <TableCell className="text-right align-top">
                    <div className="flex justify-end gap-2">
                      <Link href={`/faq?edit=${f.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>Edit</Link>
                      <DeleteButton id={String(f.id)} />
                    </div>
                  </TableCell>
                </TableRow>
                {editId === String(f.id) && (
                  <TableRow key={`edit-${String(f.id)}`} className="bg-muted/50">
                    <TableCell colSpan={3}>
                      <form action={updateFaqAction} className="flex flex-col gap-3 p-2 max-w-2xl">
                        <input type="hidden" name="id" value={String(f.id)} />
                        <div className="grid gap-1">
                          <label className="text-xs font-medium">Question</label>
                          <Input name="question" defaultValue={text(f.question)} placeholder="Question" required />
                        </div>
                        <div className="grid gap-1">
                          <label className="text-xs font-medium">Answer</label>
                          <Textarea name="answer" defaultValue={text(f.answer)} placeholder="Answer" required rows={4} />
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <SubmitButton size="sm">Save Changes</SubmitButton>
                          <Link href="/faq" className={buttonVariants({ variant: "outline", size: "sm" })}>Cancel</Link>
                        </div>
                      </form>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
            {faqs.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center">
                  No FAQs found. Add one above.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
