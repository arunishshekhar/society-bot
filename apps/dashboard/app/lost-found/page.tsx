import { adminFetch, AdminRecord, text } from '../lib/admin-api';
import { SubmitButton } from '../components/submit-button';
import {
  resolveFoundItemAction,
  deleteFoundItemAction,
  resolveLostItemAction,
  deleteLostItemAction,
} from '../actions/admin';
import { ReprocessButton } from './reprocess-button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button, buttonVariants } from '@/components/ui/button';
import Link from 'next/link';
import React from 'react';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

export default async function LostFoundPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab = 'found' } = await searchParams;

  const [foundItemsRaw, lostItemsRaw] = await Promise.all([
    adminFetch<AdminRecord[]>('/admin/lost-found/found'),
    adminFetch<AdminRecord[]>('/admin/lost-found/lost'),
  ]);
  const foundItems = foundItemsRaw ?? [];
  const lostItems = lostItemsRaw ?? [];

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Lost &amp; Found</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/lost-found?tab=found"
            className={buttonVariants({ variant: tab === 'found' ? 'default' : 'outline' })}
          >
            Found Items
          </Link>
          <Link
            href="/lost-found?tab=lost"
            className={buttonVariants({ variant: tab === 'lost' ? 'default' : 'outline' })}
          >
            Lost Items
          </Link>
          <ReprocessButton />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {tab === 'found' && <TableHead>Photo ID</TableHead>}
              <TableHead>Description (User)</TableHead>
              {tab === 'found' && <TableHead>Collection Point</TableHead>}
              <TableHead>AI Description</TableHead>
              <TableHead>Reported By</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tab === 'found' && foundItems.map((item) => (
              <TableRow key={String(item.id)}>
                <TableCell className="text-xs text-muted-foreground w-32 truncate" title={String(item.imageFileId)}>
                  {String(item.imageFileId).substring(0, 10)}...
                </TableCell>
                <TableCell className="font-medium">{text(item.originalDescription)}</TableCell>
                <TableCell>{text(item.collectionLocation)}</TableCell>
                <TableCell>
                  <details className="text-sm cursor-pointer max-w-xs">
                    <summary className="truncate">{text(item.aiDescription).substring(0, 30)}...</summary>
                    <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">{text(item.aiDescription)}</p>
                  </details>
                </TableCell>
                <TableCell>
                  {item.reportedBy ? `${text((item.reportedBy as AdminRecord).flatNumber)} · ${text((item.reportedBy as AdminRecord).name)}` : '-'}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {new Date(String(item.createdAt)).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                    item.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {text(item.status)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {item.status === 'OPEN' && (
                      <form action={resolveFoundItemAction}>
                        <input type="hidden" name="id" value={String(item.id)} />
                        <SubmitButton variant="outline" size="sm">Resolve</SubmitButton>
                      </form>
                    )}
                    <form action={deleteFoundItemAction}>
                      <input type="hidden" name="id" value={String(item.id)} />
                      <SubmitButton variant="destructive" size="sm">Del</SubmitButton>
                    </form>
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {tab === 'lost' && lostItems.map((item) => (
              <TableRow key={String(item.id)}>
                <TableCell className="font-medium">{text(item.originalDescription)}</TableCell>
                <TableCell>
                  <details className="text-sm cursor-pointer max-w-xs">
                    <summary className="truncate">{text(item.aiDescription).substring(0, 30)}...</summary>
                    <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">{text(item.aiDescription)}</p>
                  </details>
                </TableCell>
                <TableCell>
                  {item.reportedBy ? `${text((item.reportedBy as AdminRecord).flatNumber)} · ${text((item.reportedBy as AdminRecord).name)}` : '-'}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {new Date(String(item.createdAt)).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                    item.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {text(item.status)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {item.status === 'OPEN' && (
                      <form action={resolveLostItemAction}>
                        <input type="hidden" name="id" value={String(item.id)} />
                        <SubmitButton variant="outline" size="sm">Resolve</SubmitButton>
                      </form>
                    )}
                    <form action={deleteLostItemAction}>
                      <input type="hidden" name="id" value={String(item.id)} />
                      <SubmitButton variant="destructive" size="sm">Del</SubmitButton>
                    </form>
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {tab === 'found' && foundItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No found items reported.
                </TableCell>
              </TableRow>
            )}

            {tab === 'lost' && lostItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No lost items reported.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
