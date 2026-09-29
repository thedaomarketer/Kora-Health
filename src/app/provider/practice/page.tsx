import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { EmptyState } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { SelectField, TextAreaField, TextField } from "@/components/ui/form";
import { requireUser } from "@/lib/auth/session";
import { COUNTRIES } from "@/lib/constants";
import { MODALITY_LABEL } from "@/lib/format";
import { getOwnProviderProfile } from "@/lib/profiles";
import { deleteLocationAction, deleteServiceAction, saveLocationAction, saveServiceAction } from "../actions";

export const metadata: Metadata = { title: "Services & locations" };

export default async function PracticePage() {
  const user = await requireUser({ role: "provider" });
  const profile = await getOwnProviderProfile(user);
  if (!profile) return null;
  return (
    <>
      <PageHeader title="Services & locations" description="Services determine appointment length. Locations are shown on your public profile." />
      <div className="grid gap-8 xl:grid-cols-2">
        <Card>
          <CardHeader title="Services" />
          <CardBody className="space-y-6">
            {profile.service_list.length ? (
              <ul className="divide-y divide-line rounded-2xl ring-1 ring-line">
                {profile.service_list.map((s) => (
                  <li key={s.id} className="p-4">
                    <details>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                        <span>
                          <span className="font-semibold text-ink">{s.name}</span>
                          <span className="ml-2 inline-flex gap-1"><Badge>{s.duration_minutes} min</Badge><Badge tone="info">{MODALITY_LABEL[s.modality]}</Badge></span>
                        </span>
                        <span className="text-sm font-semibold text-brand-700">Edit</span>
                      </summary>
                      <ServiceForm service={s} />
                      <form action={deleteServiceAction} className="mt-2">
                        <input type="hidden" name="id" value={s.id} />
                        <Button type="submit" variant="ghost" size="sm"><Trash2 aria-hidden className="size-4" /> Remove service</Button>
                      </form>
                    </details>
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="No services yet" description="Add at least one service so patients can choose an appointment type." />}
            <div>
              <h3 className="mb-3 font-semibold text-ink">Add a service</h3>
              <ServiceForm />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Locations" />
          <CardBody className="space-y-6">
            {profile.location_list.length ? (
              <ul className="divide-y divide-line rounded-2xl ring-1 ring-line">
                {profile.location_list.map((l) => (
                  <li key={l.id} className="flex items-start justify-between gap-3 p-4">
                    <div>
                      <p className="font-semibold text-ink">{l.label ?? "Location"}</p>
                      <p className="text-sm text-muted">{[l.address_line1, l.city, l.region, COUNTRIES[l.country] ?? l.country, l.postal_code].filter(Boolean).join(", ")}</p>
                    </div>
                    <form action={deleteLocationAction}>
                      <input type="hidden" name="id" value={l.id} />
                      <Button type="submit" variant="ghost" size="sm" aria-label={`Remove ${l.label ?? "location"}`}><Trash2 aria-hidden className="size-4" /></Button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="No locations" description="Add a location if you see patients in person." />}
            <div>
              <h3 className="mb-3 font-semibold text-ink">Add a location</h3>
              <ActionForm action={saveLocationAction} resetOnSuccess className="space-y-4">
                <TextField label="Label (optional)" name="label" placeholder="e.g. Downtown clinic" />
                <TextField label="Street address (optional)" name="address" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="City" name="city" required />
                  <TextField label="Province / state" name="region" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField label="Country" name="country" required defaultValue="">
                    <option value="" disabled>Select…</option>
                    {Object.entries(COUNTRIES).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
                  </SelectField>
                  <TextField label="Postal code" name="postalCode" />
                </div>
                <SubmitButton>Add location</SubmitButton>
              </ActionForm>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function ServiceForm({ service }: { service?: { id: string; name: string; description: string | null; modality: string; duration_minutes: number; fee_note: string | null } }) {
  return (
    <ActionForm action={saveServiceAction} resetOnSuccess={!service} className="mt-4 space-y-4">
      <input type="hidden" name="id" value={service?.id ?? ""} />
      <TextField label="Service name" name="name" required defaultValue={service?.name} placeholder="e.g. New patient consultation" />
      <TextAreaField label="Description (optional)" name="description" rows={2} defaultValue={service?.description ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Offered" name="modality" defaultValue={service?.modality ?? "both"}>
          <option value="both">Virtual or in person</option>
          <option value="virtual">Virtual only</option>
          <option value="in_person">In person only</option>
        </SelectField>
        <TextField label="Length (minutes)" name="duration" type="number" min={10} max={240} step={5} required defaultValue={service?.duration_minutes ?? 30} />
      </div>
      <TextField label="Fee information (optional)" name="feeNote" defaultValue={service?.fee_note ?? ""} placeholder="e.g. Covered by provincial health insurance" />
      <SubmitButton size="sm">{service ? "Save service" : "Add service"}</SubmitButton>
    </ActionForm>
  );
}
