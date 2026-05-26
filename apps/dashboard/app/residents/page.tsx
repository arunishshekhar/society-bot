import { SubmitButton } from '../components/submit-button';
import { adminFetch, AdminRecord, text } from '../lib/admin-api';
import { updateResidentAction } from '../actions/admin';
import { DeleteButton } from './delete-button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button, buttonVariants } from '@/components/ui/button';
import Link from 'next/link';
import React from 'react';

export const dynamic = 'force-dynamic';

export default async function ResidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; edit?: string }>;
}) {
  const { search: rawSearch, edit: editId } = await searchParams;
  const search = rawSearch ?? '';
  const residents = (await adminFetch<AdminRecord[]>(`/admin/residents?search=${encodeURIComponent(search)}`)) ?? [];

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Residents</h1>
        <form className="flex w-full max-w-sm items-center gap-2">
          <Input 
            name="search" 
            defaultValue={search} 
            placeholder="Search name or flat" 
          />
          <SubmitButton>Search</SubmitButton>
        </form>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Flat</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Vehicles</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {residents.map((r) => (
              <React.Fragment key={String(r.id)}>
                <TableRow>
                  <TableCell className="font-medium">{text(r.name)}</TableCell>
                  <TableCell>{text(r.flatNumber)}</TableCell>
                  <TableCell>{text(r.phone)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${r.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {r.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </TableCell>
                  <TableCell>{Array.isArray(r.vehicles) ? r.vehicles.length : 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link  href={`/residents?search=${search}&edit=${r.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>Edit</Link>
                      <DeleteButton id={String(r.id)} />
                    </div>
                  </TableCell>
                </TableRow>
                {editId === String(r.id) && (
                  <TableRow key={`edit-${String(r.id)}`} className="bg-muted/50">
                    <TableCell colSpan={6}>
                      <form action={updateResidentAction} className="flex flex-wrap items-end gap-3 p-2">
                        <input type="hidden" name="id" value={String(r.id)} />
                        <div className="grid gap-1">
                          <label className="text-xs font-medium">Name</label>
                          <Input name="name" defaultValue={text(r.name)} placeholder="Name" className="w-40" />
                        </div>
                        <div className="grid gap-1">
                          <label className="text-xs font-medium">Flat</label>
                          <Input name="flatNumber" defaultValue={text(r.flatNumber)} placeholder="Flat" className="w-24" />
                        </div>
                        <div className="grid gap-1">
                          <label className="text-xs font-medium">Phone</label>
                          <Input name="phone" defaultValue={text(r.phone) === '-' ? '' : text(r.phone)} placeholder="Phone" className="w-32" />
                        </div>
                        <div className="grid gap-1">
                          <label className="text-xs font-medium">Status</label>
                          <Select name="isActive" defaultValue={String(r.isActive)}>
                            <SelectTrigger className="w-28">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true">Active</SelectItem>
                              <SelectItem value="false">Disabled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <SubmitButton size="sm">Save</SubmitButton>
                        <Link  href="/residents" className={buttonVariants({ variant: "outline", size: "sm" })}>Cancel</Link>
                      </form>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
            {residents.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No residents found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
