import { SubmitButton } from "../components/submit-button";
import { adminFetch, AdminRecord, text } from '../lib/admin-api';
import {
  createWorkerAction,
  updateWorkerAction,
  deleteWorkerAction,
  banWorkerAction,
  createCategoryAction,
  deleteCategoryAction,
} from '../actions/admin';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import React from 'react';

export const dynamic = 'force-dynamic';

export default async function WorkersPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; add?: string; addcat?: string }>;
}) {
  const { edit: editId, add, addcat } = await searchParams;
  const [workers, categories] = await Promise.all([
    adminFetch<AdminRecord[]>('/admin/workers') ?? [],
    adminFetch<AdminRecord[]>('/admin/categories?type=worker') ?? [],
  ]);
  const workerList = workers ?? [];
  const categoryList = categories ?? [];
  const categoryNames = categoryList.map((c) => String(c.name));

  const allCategories = [...new Set([
    'plumber', 'electrician', 'maid', 'carpenter', 'ac repair',
    'painter', 'driver', 'cook', 'other',
    ...categoryNames,
  ])].sort();

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Workers</h1>
        <div className="flex gap-2">
          <Link href="/workers?addcat=1" className={buttonVariants({ variant: "outline" })}>
            + Category
          </Link>
          <Link href="/workers?add=1" className={buttonVariants({})}>
            + Add Worker
          </Link>
        </div>
      </div>

      {/* Category Manager */}
      {addcat && (
        <Card className="mb-6 bg-muted/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Manage Worker Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createCategoryAction} className="flex gap-2 mb-4">
              <input type="hidden" name="type" value="worker" />
              <Input name="name" placeholder="New category name" required className="max-w-xs bg-background" />
              <SubmitButton>Add</SubmitButton>
              <Link href="/workers" className={buttonVariants({ variant: "outline" })}>
                Close
              </Link>
            </form>
            {categoryList.length > 0 && (
              <div className="grid gap-2 max-w-md">
                {categoryList.map((c) => (
                  <div key={String(c.id)} className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm shadow-sm">
                    <span className="capitalize font-medium">{text(c.name)}</span>
                    <form action={deleteCategoryAction}>
                      <input type="hidden" name="id" value={String(c.id)} />
                      <input type="hidden" name="type" value="worker" />
                      <SubmitButton variant="ghost" size="sm" className="h-auto p-1 text-destructive hover:text-destructive hover:bg-destructive/10">
                        Remove
                      </SubmitButton>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Worker Form */}
      {add && (
        <Card className="mb-6 bg-muted/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Add Worker</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createWorkerAction} className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Name *</label>
                <Input name="name" placeholder="Name" required className="bg-background" />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Phone *</label>
                <Input name="phone" placeholder="Phone" required className="bg-background" />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Category *</label>
                <Select name="category" required>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {allCategories.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Rating</label>
                <Select name="rating">
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="No rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No rating</SelectItem>
                    {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n} ★</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <label className="text-sm font-medium">Notes</label>
                <Textarea name="notes" placeholder="Notes" className="bg-background resize-y" rows={2} />
              </div>
              <div className="flex gap-2 sm:col-span-2 pt-2">
                <SubmitButton>Save Worker</SubmitButton>
                <Link href="/workers" className={buttonVariants({ variant: "outline" })}>
                  Cancel
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Workers Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Added by</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workerList.map((w) => (
              <React.Fragment key={String(w.id)}>
                <TableRow>
                  <TableCell className="font-medium">{text(w.name)}</TableCell>
                  <TableCell>{text(w.phone)}</TableCell>
                  <TableCell className="capitalize">{text(w.category)}</TableCell>
                  <TableCell>{w.rating ? `${w.rating} ★` : '-'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      w.isBanned ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : w.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-muted text-muted-foreground'
                    }`}>
                      {w.isBanned ? 'Banned' : w.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell>{w.resident ? text((w.resident as AdminRecord).flatNumber) : 'Admin'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/workers?edit=${w.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                        Edit
                      </Link>
                      <form action={banWorkerAction}>
                        <input type="hidden" name="id" value={String(w.id)} />
                        <input type="hidden" name="unban" value={String(!!w.isBanned)} />
                        <SubmitButton variant={w.isBanned ? "outline" : "secondary"} size="sm" className={w.isBanned ? "text-emerald-600 hover:text-emerald-700 border-emerald-200" : "text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100"}>
                          {w.isBanned ? 'Unban' : 'Ban'}
                        </SubmitButton>
                      </form>
                      <form action={deleteWorkerAction}>
                        <input type="hidden" name="id" value={String(w.id)} />
                        <SubmitButton variant="destructive" size="sm">Del</SubmitButton>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
                {editId === String(w.id) && (
                  <TableRow key={`edit-${String(w.id)}`} className="bg-muted/50">
                    <TableCell colSpan={7}>
                      <form action={updateWorkerAction} className="grid gap-4 sm:grid-cols-2 p-2">
                        <input type="hidden" name="id" value={String(w.id)} />
                        <div className="grid gap-2">
                          <label className="text-xs font-medium">Name</label>
                          <Input name="name" defaultValue={text(w.name)} placeholder="Name" className="bg-background" />
                        </div>
                        <div className="grid gap-2">
                          <label className="text-xs font-medium">Phone</label>
                          <Input name="phone" defaultValue={text(w.phone)} placeholder="Phone" className="bg-background" />
                        </div>
                        <div className="grid gap-2">
                          <label className="text-xs font-medium">Category</label>
                          <Select name="category" defaultValue={String(w.category)}>
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                              {allCategories.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <label className="text-xs font-medium">Rating</label>
                          <Select name="rating" defaultValue={String(w.rating ?? '')}>
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="No rating" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">No rating</SelectItem>
                              {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n} ★</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2 sm:col-span-2">
                          <label className="text-xs font-medium">Notes</label>
                          <Textarea name="notes" defaultValue={String(w.notes ?? '')} placeholder="Notes" className="bg-background resize-y" rows={2} />
                        </div>
                        <div className="flex gap-2 sm:col-span-2">
                          <SubmitButton size="sm">Save Changes</SubmitButton>
                          <Link href="/workers" className={buttonVariants({ variant: "outline", size: "sm" })}>
                            Cancel
                          </Link>
                        </div>
                      </form>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
            {workerList.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No workers found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
