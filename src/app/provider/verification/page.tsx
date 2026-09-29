import type { Metadata } from "next";
import { FileCheck2, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Alert, EmptyState } from "@/components/ui/alert";
import { Badge, VerificationBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { SelectField, TextField } from "@/components/ui/form";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { getOwnProviderProfile } from "@/lib/profiles";
import { addCredentialAction, deleteCredentialAction, submitVerificationAction } from "../actions";

export const metadata: Metadata = { title: "Verification" };

const REVIEW_LABEL: Record<string, string> = {
  submitted: "Awaiting review",
  approved: "Approved",
  rejected: "Not approved",
  more_info_requested: "More information requested",
  withdrawn: "Withdrawn",
};

export default async function VerificationPage({ searchParams }: PageProps<"/provider/verification">) {
  const user = await requireUser({ role: "provider" });
  const { submitted } = await searchParams;
  const profile = await getOwnProviderProfile(user);
  if (!profile) return null;
  const [credentials, reviews] = await asUser(user, async (q) => [
    await q<{ id: string; credential_type: string; issuing_body: string; jurisdiction: string; credential_number: string | null; expires_on: string | null }>(
      `select id, credential_type, issuing_body, jurisdiction, credential_number, expires_on from public.provider_credentials
        where provider_id = public.current_provider_id() order by created_at`,
    ),
    await q<{ id: string; status: string; submitted_at: string; reviewed_at: string | null; decision_reason: string | null }>(
      `select id, status, submitted_at, reviewed_at, decision_reason from public.provider_verifications
        where provider_id = public.current_provider_id() order by submitted_at desc limit 10`,
    ),
  ] as const);
  const canSubmit = ["unverified", "rejected"].includes(profile.verification_status) && credentials.some((c) => ["license", "registration"].includes(c.credential_type));

  return (
    <>
      <PageHeader title="Verification" description="Kora verifies your license with the regulator's public register before showing “License verified” on your profile." />
      {submitted ? <Alert tone="success" role="status" className="mb-6">Submitted. Kora will review your credentials and notify you.</Alert> : null}
      <Card className="mb-8 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Current status</p>
            <div className="mt-1"><VerificationBadge status={profile.verification_status} verifiedAt={profile.verified_at} /></div>
          </div>
          {canSubmit ? (
            <ActionForm action={submitVerificationAction}>
              <SubmitButton pendingLabel="Submitting…">Submit for verification</SubmitButton>
            </ActionForm>
          ) : null}
        </div>
        {profile.verification_status === "verified" ? (
          <p className="mt-4 text-sm text-muted">Changing your credentials will return your profile to &ldquo;Verification pending&rdquo; until it&apos;s reviewed again.</p>
        ) : null}
        {profile.verification_status === "suspended" ? (
          <Alert tone="danger" className="mt-4">Your profile has been suspended by Kora. Contact support for details.</Alert>
        ) : null}
      </Card>

      <div className="grid gap-8 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader title="Your credentials" description="Private — only you and Kora verifiers can see these details." />
          <CardBody>
            {credentials.length ? (
              <ul className="divide-y divide-line rounded-2xl ring-1 ring-line">
                {credentials.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-3 p-4">
                    <div>
                      <p className="font-semibold capitalize text-ink">{c.credential_type}</p>
                      <p className="text-sm text-muted">{c.issuing_body} · {c.jurisdiction}</p>
                      <p className="text-sm text-muted">{c.credential_number ? `No. ${c.credential_number}` : "No number provided"}{c.expires_on ? ` · Expires ${c.expires_on}` : ""}</p>
                    </div>
                    <form action={deleteCredentialAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <Button type="submit" variant="ghost" size="sm" aria-label={`Remove ${c.credential_type}`}><Trash2 aria-hidden className="size-4" /></Button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon={<FileCheck2 aria-hidden className="size-6" />} title="No credentials yet" description="Add your professional license or registration to get verified." />}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Add a credential" />
          <CardBody>
            <ActionForm action={addCredentialAction} resetOnSuccess className="space-y-4">
              <SelectField label="Type" name="type" defaultValue="license">
                <option value="license">Professional license</option>
                <option value="registration">Regulatory registration</option>
                <option value="certification">Board certification</option>
                <option value="degree">Degree</option>
              </SelectField>
              <TextField label="Issuing regulator or body" name="issuingBody" required placeholder="e.g. College of Physicians and Surgeons of Ontario" />
              <TextField label="Jurisdiction" name="jurisdiction" required placeholder="e.g. Ontario, Canada" />
              <TextField label="License / registration number" name="number" hint="Used to look you up in the public register." />
              <TextField label="Expiry date (optional)" name="expiresOn" type="date" />
              <SubmitButton>Add credential</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-8">
        <CardHeader title="Review history" />
        <CardBody>
          {reviews.length ? (
            <ul className="space-y-3">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-xl p-3 ring-1 ring-line">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge tone={r.status === "approved" ? "success" : r.status === "rejected" ? "danger" : "warning"}>{REVIEW_LABEL[r.status] ?? r.status}</Badge>
                    <span className="text-muted">Submitted {formatDateTime(r.submitted_at)}{r.reviewed_at ? ` · Reviewed ${formatDateTime(r.reviewed_at)}` : ""}</span>
                  </p>
                  {r.decision_reason ? <p className="mt-2 text-sm text-ink/85">{r.decision_reason}</p> : null}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">Not submitted yet.</p>}
        </CardBody>
      </Card>
    </>
  );
}
