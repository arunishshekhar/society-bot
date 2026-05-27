import { adminFetch, AdminRecord, text } from '../lib/admin-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Briefcase, Car, ShieldCheck } from 'lucide-react';
import { WorkerChart } from './worker-chart';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const analytics = await adminFetch<AdminRecord>('/admin/analytics');
  
  const groups = (analytics?.workerGroups as AdminRecord[] | undefined) ?? [];
  const chartData = groups.map((g) => ({
    category: String(g.category),
    count: Number((g._count as Record<string, number>)?.category || 0)
  }));

  const recent = (analytics?.recentResidents as AdminRecord[] | undefined) ?? [];

  const stats = [
    { label: 'Total Residents', value: analytics?.totalResidents, icon: Users, color: 'text-blue-500' },
    { label: 'Active Services', value: analytics?.activeServices, icon: Briefcase, color: 'text-emerald-500' },
    { label: 'Active Carpools', value: analytics?.activeCarpools, icon: Car, color: 'text-amber-500' },
    { label: 'Worker Entries', value: analytics?.workerEntries, icon: ShieldCheck, color: 'text-purple-500' },
  ];

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Analytics Dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                <Icon className={`h-4 w-4 ${s.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{text(s.value)}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Worker Categories</CardTitle>
            <CardDescription>Number of registered workers by category.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <WorkerChart data={chartData} />
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Registrations</CardTitle>
            <CardDescription>Latest residents to join the bot.</CardDescription>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent registrations.</p>
            ) : (
              <div className="space-y-4">
                {recent.map((r, i) => (
                  <div key={i} className="flex items-center">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">{text(r.name)}</p>
                      <p className="text-sm text-muted-foreground">Flat: {text(r.flatNumber)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
