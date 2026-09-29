import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Alert, EmptyState } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { Checkbox, Fieldset, SelectField, TextField } from "@/components/ui/form";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { MODALITY_LABEL, WEEKDAYS } from "@/lib/format";
import { addAvailabilityAction, deleteAvailabilityAction } from "../actions";

export const metadata: Metadata = { title: "Availability" };

const ZONES = Intl.supportedValuesOf("timeZone").filter((z) => /^(America|Europe|Africa|Atlantic|Pacific)\//.test(z));

export default async function AvailabilityPage() {
  const user = await requireUser({ role: "provider" });
  const [windows, locations] = await asUser(user, async (q) => [
    await q<{ id: string; weekday: number; start_time: string; end_time: string; timezone: string; modality: string; location: string | null }>(
      `select a.id, a.weekday, to_char(a.start_time, 'HH24:MI') as start_time, to_char(a.end_time, 'HH24:MI') as end_time, a.timezone, a.modality,
              coalesce(l.label, l.city) as location
         from public.availability a left join public.locations l on l.id = a.location_id
        where a.provider_id = public.current_provider_id() order by (a.weekday + 6) % 7, a.start_time`,
    ),
    await q<{ id: string; label: string | null; city: string }>(`select id, label, city from public.locations where provider_id = public.current_provider_id()`),
  ] as const);
  const currentTz = windows[0]?.timezone ?? "America/Toronto";

  return (
    <>
      <PageHeader title="Availability" description="Weekly hours when patients can request appointments on Kora. You still confirm every request." />
      <Alert tone="info" className="mb-6">
        Kora doesn&apos;t sync with external scheduling systems yet. Keep these hours in line with your practice calendar;
        confirmed Kora appointments automatically block their time slots.
      </Alert>
      <div className="grid gap-8 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader title="Weekly hours" />
          <CardBody>
            {windows.length ? (
              <ul className="divide-y divide-line rounded-2xl ring-1 ring-line">
                {windows.map((w) => (
                  <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-semibold text-ink">{WEEKDAYS[w.weekday]} · {w.start_time}–{w.end_time}</p>
                      <p className="mt-1 flex flex-wrap gap-1.5 text-sm text-muted">
                        <Badge tone="info">{MODALITY_LABEL[w.modality]}</Badge>
                        {w.location ? <Badge>{w.location}</Badge> : null}
                        <span>{w.timezone.replace("_", " ")}</span>
                      </p>
                    </div>
                    <form action={deleteAvailabilityAction}>
                      <input type="hidden" name="id" value={w.id} />
                      <Button type="submit" variant="ghost" size="sm" aria-label={`Remove ${WEEKDAYS[w.weekday]} ${w.start_time}–${w.end_time}`}>
                        <Trash2 aria-hidden className="size-4" />
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No hours yet" description="Add the days and times you're available for Kora appointment requests." />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Add hours" />
          <CardBody>
            <ActionForm action={addAvailabilityAction} className="space-y-5">
              <Fieldset legend="Days">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                    <Checkbox key={d} name="weekdays" value={String(d)} label={WEEKDAYS[d].slice(0, 3)} defaultChecked={d >= 1 && d <= 5} />
                  ))}
                </div>
              </Fieldset>
              <div className="grid grid-cols-2 gap-4">
                <TextField label="From" name="start" type="time" required defaultValue="09:00" />
                <TextField label="To" name="end" type="time" required defaultValue="17:00" />
              </div>
              <SelectField label="Time zone" name="timezone" defaultValue={currentTz}>
                {ZONES.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
              </SelectField>
              <SelectField label="Visit types" name="modality" defaultValue="both">
                <option value="both">Virtual or in person</option>
                <option value="virtual">Virtual only</option>
                <option value="in_person">In person only</option>
              </SelectField>
              <SelectField label="Location (optional)" name="locationId" defaultValue="">
                <option value="">No specific location</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.label ?? l.city}</option>)}
              </SelectField>
              <SubmitButton>Add hours</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
