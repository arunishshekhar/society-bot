import { adminFetch, AdminRecord, text } from '../lib/admin-api';
import {
  createServiceAction,
  updateServiceAction,
  toggleServiceAction,
  deleteServiceAction,
  createCategoryAction,
  deleteCategoryAction,
} from '../actions/admin';
import { SubmitButton } from '../components/submit-button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import React from 'react';

export const dynamic = 'force-dynamic';

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; add?: string; addcat?: string }>;
}) {
  const { edit: editId, add, addcat } = await searchParams;
  const [services, categories] = await Promise.all([
    adminFetch<AdminRecord[]>('/admin/services') ?? [],
    adminFetch<AdminRecord[]>('/admin/categories?type=service') ?? [],
  ]);
  const serviceList = services ?? [];
  const categoryList = categories ?? [];
  const categoryNames = categoryList.map((c) => String(c.name));

  const allCategories = [...new Set([
    'cleaning', 'cooking', 'tutoring', 'repair', 'healthcare', 'transport', 'other',
    ...categoryNames,
  ])].sort();

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Services</h1>
        <div className="flex gap-2">
          <Link  href="/services?addcat=1" className={buttonVariants({ variant: "outline", size: "default" })}>+ Category</Link>
          <Link  href="/services?add=1" className={buttonVariants({ variant: "default", size: "default" })}>+ Add Service</Link>
        </div>
      </div>

      {/* Category Manager */}
      {addcat && (
        <Card className="mb-6 bg-muted/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Manage Service Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createCategoryAction} className="flex gap-2 mb-4">
              <input type="hidden" name="type" value="service" />
              <Input name="name" placeholder="New category name" required className="max-w-xs bg-background" />
              <SubmitButton>Add</SubmitButton>
              <Link  href="/services" className={buttonVariants({ variant: "outline", size: "default" })}>Close</Link>
            </form>
            {categoryList.length > 0 && (
              <div className="grid gap-2 max-w-md">
                {categoryList.map((c) => (
                  <div key={String(c.id)} className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm shadow-sm">
                    <span className="capitalize font-medium">{text(c.name)}</span>
                    <form action={deleteCategoryAction}>
                      <input type="hidden" name="id" value={String(c.id)} />
                      <input type="hidden" name="type" value="service" />
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

      {/* Add Service Form */}
      {add && (
        <Card className="mb-6 bg-muted/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Add Service</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createServiceAction} className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Service Name *</label>
                <Input name="name" placeholder="Service name" required className="bg-background" />
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
                <label className="text-sm font-medium">Timing</label>
                <Input name="timing" placeholder="e.g. 9am-5pm" className="bg-background" />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Contact Preference</label>
                <Select name="contactPreference" defaultValue="telegram">
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Contact Preference" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="telegram">Contact via Telegram</SelectItem>
                    <SelectItem value="phone">Contact via Phone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea name="description" placeholder="Description" className="bg-background resize-y" rows={2} />
              </div>
              <div className="flex gap-2 sm:col-span-2 pt-2">
                <SubmitButton>Save Service</SubmitButton>
                <Link  href="/services" className={buttonVariants({ variant: "outline", size: "default" })}>Cancel</Link>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Services Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Resident</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {serviceList.map((s) => {
              const resident = s.resident as AdminRecord | undefined;
              return (
                <React.Fragment key={String(s.id)}>
                  <TableRow>
                    <TableCell className="font-medium">{text(s.name)}</TableCell>
                    <TableCell className="capitalize">{text(s.category)}</TableCell>
                    <TableCell>{resident ? text(resident.flatNumber) : 'Admin'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        s.isDisabled ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : s.isPaused ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      }`}>
                        {s.isDisabled ? 'Disabled' : s.isPaused ? 'Paused' : 'Active'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link  href={`/services?edit=${s.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>Edit</Link>
                        <form action={toggleServiceAction}>
                          <input type="hidden" name="id" value={String(s.id)} />
                          <input type="hidden" name="isDisabled" value={String(!s.isDisabled)} />
                          <SubmitButton variant={s.isDisabled ? "outline" : "secondary"} size="sm" className={s.isDisabled ? "text-emerald-600 hover:text-emerald-700 border-emerald-200" : "text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100"}>
                            {s.isDisabled ? 'Enable' : 'Disable'}
                          </SubmitButton>
                        </form>
                        <form action={deleteServiceAction}>
                          <input type="hidden" name="id" value={String(s.id)} />
                          <SubmitButton variant="destructive" size="sm">Del</SubmitButton>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                  {editId === String(s.id) && (
                    <TableRow key={`edit-${String(s.id)}`} className="bg-muted/50">
                      <TableCell colSpan={5}>
                        <form action={updateServiceAction} className="grid gap-4 sm:grid-cols-2 p-2">
                          <input type="hidden" name="id" value={String(s.id)} />
                          <div className="grid gap-2">
                            <label className="text-xs font-medium">Name</label>
                            <Input name="name" defaultValue={text(s.name)} placeholder="Name" className="bg-background" />
                          </div>
                          <div className="grid gap-2">
                            <label className="text-xs font-medium">Category</label>
                            <Select name="category" defaultValue={String(s.category)}>
                              <SelectTrigger className="bg-background">
                                <SelectValue placeholder="Category" />
                              </SelectTrigger>
                              <SelectContent>
                                {allCategories.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2 sm:col-span-2">
                            <label className="text-xs font-medium">Description</label>
                            <Textarea name="description" defaultValue={String(s.description ?? '')} placeholder="Description" className="bg-background resize-y" rows={2} />
                          </div>
                          <div className="flex gap-2 sm:col-span-2">
                            <SubmitButton size="sm">Save Changes</SubmitButton>
                            <Link  href="/services" className={buttonVariants({ variant: "outline", size: "sm" })}>Cancel</Link>
                          </div>
                        </form>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
            {serviceList.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No services found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
