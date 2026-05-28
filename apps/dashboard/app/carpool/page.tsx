import { SubmitButton } from "../components/submit-button";
import { adminFetch, AdminRecord, text } from '../lib/admin-api';
import { updateCarpoolAction, toggleCarpoolAction, deleteCarpoolAction } from '../actions/admin';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button, buttonVariants } from '@/components/ui/button';
import Link from 'next/link';
import React from 'react';

export const dynamic = 'force-dynamic';

export default async function CarpoolPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit: editId } = await searchParams;
  const routes = (await adminFetch<AdminRecord[]>('/admin/carpool')) ?? [];

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Carpool Routes</h1>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Destination</TableHead>
              <TableHead>Departure</TableHead>
              <TableHead>Return</TableHead>
              <TableHead>Seats</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Resident</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {routes.map((r) => {
              const resident = r.resident as AdminRecord | undefined;
              return (
                <React.Fragment key={String(r.id)}>
                  <TableRow>
                    <TableCell className="font-medium">{(r as any).startAddress ?? 'Society'} → {text((r as any).destinationAddress)}</TableCell>
                    <TableCell>{text(r.departureTime)}</TableCell>
                    <TableCell>{text(r.returnTime)}</TableCell>
                    <TableCell>{text(r.seatsAvailable)}</TableCell>
                    <TableCell className="max-w-[120px] truncate">{Array.isArray((r as any).recurringDays) ? ((r as any).recurringDays as string[]).join(', ') : '-'}</TableCell>
                    <TableCell>{text(resident?.flatNumber)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        r.isPaused ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      }`}>
                        {r.isPaused ? 'Paused' : 'Active'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link  href={`/carpool?edit=${r.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>Edit</Link>
                        <form action={toggleCarpoolAction}>
                          <input type="hidden" name="id" value={String(r.id)} />
                          <input type="hidden" name="isPaused" value={String(!r.isPaused)} />
                          <SubmitButton variant={r.isPaused ? "outline" : "secondary"} size="sm" className={r.isPaused ? "text-emerald-600 hover:text-emerald-700 border-emerald-200" : "text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100"}>
                            {r.isPaused ? 'Resume' : 'Pause'}
                          </SubmitButton>
                        </form>
                        <form action={deleteCarpoolAction}>
                          <input type="hidden" name="id" value={String(r.id)} />
                          <SubmitButton variant="destructive" size="sm">Del</SubmitButton>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                  {editId === String(r.id) && (
                    <TableRow key={`edit-${String(r.id)}`} className="bg-muted/50">
                      <TableCell colSpan={8}>
                        <form action={updateCarpoolAction} className="flex flex-wrap items-end gap-3 p-2">
                          <input type="hidden" name="id" value={String(r.id)} />
                          <div className="grid gap-1">
                            <label className="text-xs font-medium">Destination</label>
                            <Input name="destinationAddress" defaultValue={text((r as any).destinationAddress)} placeholder="Destination" className="w-40 bg-background" />
                          </div>
                          <div className="grid gap-1">
                            <label className="text-xs font-medium">Departure</label>
                            <Input name="departureTime" defaultValue={text(r.departureTime)} placeholder="Departure" className="w-32 bg-background" />
                          </div>
                          <div className="grid gap-1">
                            <label className="text-xs font-medium">Return</label>
                            <Input name="returnTime" defaultValue={text(r.returnTime) === '-' ? '' : text(r.returnTime)} placeholder="Return" className="w-32 bg-background" />
                          </div>
                          <div className="grid gap-1">
                            <label className="text-xs font-medium">Seats</label>
                            <Input name="seatsAvailable" type="number" min="1" defaultValue={String(r.seatsAvailable ?? 1)} placeholder="Seats" className="w-24 bg-background" />
                          </div>
                          <SubmitButton size="sm">Save</SubmitButton>
                          <Link  href="/carpool" className={buttonVariants({ variant: "outline", size: "sm" })}>Cancel</Link>
                        </form>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
            {routes.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  No carpool routes found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
