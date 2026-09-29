import type { Metadata } from "next";
import { HeartPulse, Lock, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Alert, EmptyState } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { SelectField, TextField } from "@/components/ui/form";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { getConsents } from "@/lib/profiles";
import { deleteHealthEntryAction, saveHealthEntryAction } from "../actions";
import { setConsentAction } from "@/app/settings/actions";

export const metadata: Metadata = { title: "Health information" };

const CATEGORIES: [string, string][] = [
  ["allergy", "Allergies"],
  ["medication", "Medications"],
  ["condition", "Conditions"],
  ["immunization", "Immunizations"],
  ["procedure", "Procedures & surgeries"],
  ["measurement", "Measurements"],
  ["note", "Notes"],
];

interface Entry { id: string; category: string; label: string; value: string | null; unit: string | null; recorded_on: string | null; source: string }

export default async function HealthPage() {
  const user = await requireUser({ role: "patient" });
  const consents = await getConsents(user);
  const enabled = consents.health_data_storage?.granted === true;
  const entries = await asUser(user, (q) => q<Entry>(`select id, category, label, value, unit, recorded_on, source from public.health_data order by category, recorded_on desc nulls last, created_at desc`));

  return (
    <>
      <PageHeader
        title="Health information"
        description="Keep track of details you may want to share with a clinician. This is your personal record — it isn't shared with providers or reviewed by anyone."
      />
      <Alert tone="info" className="mb-6">
        Entries are for your reference only. Kora doesn&apos;t interpret them, and they aren&apos;t a medical record. Check any
        medication changes with your prescriber or pharmacist.
      </Alert>

      {!enabled ? (
        <Card className="p-6 sm:p-8">
          <Lock aria-hidden className="size-7 text-brand-700" />
          <h2 className="mt-3 text-lg font-semibold text-ink">Turn on health information storage</h2>
          <p className="mt-2 max-w-2xl text-muted">
            To store health information, Kora needs your consent. Only you can see these entries. You can turn this off
            later — existing entries stay until you delete them, and you can delete everything at any time.
          </p>
          {entries.length ? <p className="mt-2 text-sm text-muted">You have {entries.length} saved entr{entries.length === 1 ? "y" : "ies"}; turn storage back on to add more.</p> : null}
          <form action={setConsentAction} className="mt-5">
            <input type="hidden" name="type" value="health_data_storage" />
            <input type="hidden" name="granted" value="1" />
            <input type="hidden" name="back" value="/patient/health" />
            <Button type="submit">I consent — turn on storage</Button>
          </form>
        </Card>
      ) : (
        <Card>
          <CardHeader title="Add an entry" />
          <CardBody>
            <ActionForm action={saveHealthEntryAction} resetOnSuccess className="grid gap-4 md:grid-cols-[12rem_1fr_1fr_8rem_10rem_auto] md:items-end">
              <SelectField label="Category" name="category" defaultValue="allergy">
                {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </SelectField>
              <TextField label="Name" name="label" required maxLength={200} placeholder="e.g. Penicillin" />
              <TextField label="Details (optional)" name="value" maxLength={500} placeholder="e.g. rash, 10 mg daily" />
              <TextField label="Unit" name="unit" maxLength={30} />
              <TextField label="Date" name="recordedOn" type="date" />
              <SubmitButton>Add</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      )}

      <div className="mt-8 space-y-6">
        {entries.length === 0 ? (
          <EmptyState icon={<HeartPulse aria-hidden className="size-6" />} title="No entries yet" description="Add allergies, medications or notes you want handy for appointments." />
        ) : (
          CATEGORIES.filter(([c]) => entries.some((e) => e.category === c)).map(([c, label]) => (
            <Card key={c}>
              <CardHeader title={label} />
              <ul className="divide-y divide-line">
                {entries.filter((e) => e.category === c).map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{e.label}</p>
                      <p className="text-sm text-muted">
                        {[e.value, e.unit].filter(Boolean).join(" ")}
                        {e.recorded_on ? ` · ${e.recorded_on}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {e.source !== "manual" ? <Badge tone="info">Imported</Badge> : null}
                      <form action={deleteHealthEntryAction}>
                        <input type="hidden" name="id" value={e.id} />
                        <Button type="submit" variant="ghost" size="sm" aria-label={`Delete ${e.label}`}>
                          <Trash2 aria-hidden className="size-4" /> Delete
                        </Button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))
        )}
      </div>

      {enabled ? (
        <form action={setConsentAction} className="mt-8">
          <input type="hidden" name="type" value="health_data_storage" />
          <input type="hidden" name="granted" value="0" />
          <input type="hidden" name="back" value="/patient/health" />
          <Button type="submit" variant="ghost" size="sm">Turn off health information storage</Button>
        </form>
      ) : null}
    </>
  );
}
