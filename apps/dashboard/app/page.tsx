import { SubmitButton } from './components/submit-button';
import { adminFetch, AdminRecord, text } from './lib/admin-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ plate?: string }> }) {
  const { plate: rawPlate } = await searchParams;
  const plate = rawPlate?.trim();
  const vehicleArray = plate
    ? await adminFetch<AdminRecord[]>(`/admin/vehicles/lookup?plate=${encodeURIComponent(plate)}`)
    : null;
  const vehicle = vehicleArray && vehicleArray.length > 0 ? vehicleArray[0] : null;
  const resident = vehicle?.resident as AdminRecord | undefined;

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-2xl">Vehicle Lookup</CardTitle>
          <CardDescription>Search for a vehicle by its license plate number.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex gap-2">
            <Input 
              name="plate" 
              defaultValue={plate} 
              placeholder="e.g. KA01AB1234" 
              className="max-w-md"
            />
            <SubmitButton>Search</SubmitButton>
          </form>
          {plate && !vehicle && (
            <p className="mt-4 text-sm font-medium text-muted-foreground">No vehicle found for plate "{plate}".</p>
          )}
        </CardContent>
      </Card>

      {vehicle && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{text(vehicle.number)}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1">
                <dt className="text-sm font-medium text-muted-foreground">Owner</dt>
                <dd className="text-sm font-medium">{text(resident?.name)}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-sm font-medium text-muted-foreground">Flat</dt>
                <dd className="text-sm font-medium">{text(resident?.flatNumber)}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-sm font-medium text-muted-foreground">Phone</dt>
                <dd className="text-sm font-medium">{text(resident?.phone)}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-sm font-medium text-muted-foreground">Parking Slot</dt>
                <dd className="text-sm font-medium">{text(vehicle.parkingSlot)}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-sm font-medium text-muted-foreground">Model</dt>
                <dd className="text-sm font-medium">{text(vehicle.model)}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-sm font-medium text-muted-foreground">Color</dt>
                <dd className="text-sm font-medium">{text(vehicle.color)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
