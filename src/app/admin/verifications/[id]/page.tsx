import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge, VerificationBadge, type VerificationStatus } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { Checkbox, Fieldset, SelectField, TextAreaField, TextField } from "@/components/ui/form";
import { requireAdmin } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { reviewVerificationAction, suspendProviderAction } from "../../actions";

export const metadata: Metadata = { title: "Review verification" };

export default async function ReviewVerification({ params }: PageProps<"/admin/verifications/[id]">) {
  const user = await requireAdmin("verifier");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await asUser(user, async (q) => {
    const [v] = await q<{ id: string; status: string; submitted_at: string; provider_id: string; name: string; slug: string; profession: string | null; verification_status: VerificationStatus; is_demo: boolean; email: string; user_id: string }>(
      `select v.id, v.status, v.submitted_at, p.id as provider_id, concat_ws(' ', p.honorific, p.display_name) as name, p.slug,
              pr.name as profession, p.verification_status, p.is_demo, u.email, p.user_id
         from public.provider_verifications v join public.provider_profiles p on p.id = v.provider_id
         join public.users u on u.id = p.user_id left join public.professions pr on pr.id = p.profession_id
        where v.id = $1`,
      [id],
    );
    if (!v) return null;
    const credentials = await q<{ id: string; credential_type: string; issuing_body: string; jurisdiction: string; credential_number: string | null; expires_on: string | null }>(
      `select id, credential_type, issuing_body, jurisdiction, credential_number, expires_on from public.provider_credentials where provider_id = $1 order by created_at`,
      [v.provider_id],
    );
    await q(`select public.admin_record_event('credentials_viewed', 'provider_verification', $1, $2)`, [id, v.user_id]);
    return { v, credentials };
  });
  if (!data) notFound();
  const { v, credentials } = data;

  return (
    <>
      <PageHeader title={`Review: ${v.name}`} description={`${v.profession ?? "Profession not set"} · ${v.email} · submitted ${formatDateTime(v.submitted_at)}`} actions={<Link href={`/providers/${v.slug}`} className="text-sm font-semibold text-brand-700 underline">Public profile</Link>} />
      {v.is_demo ? <Alert tone="info" className="mb-6">This is fictional development sample data. Do not approve sample profiles in production.</Alert> : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Submitted credentials" description="Private. Access to this page is recorded in the audit log." />
          <CardBody>
            {credentials.length ? (
              <ul className="space-y-3">
                {credentials.map((c) => (
                  <li key={c.id} className="rounded-xl p-4 ring-1 ring-line">
                    <p className="font-semibold capitalize text-ink">{c.credential_type}</p>
                    <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
                      <dt className="text-muted">Issuing body</dt><dd>{c.issuing_body}</dd>
                      <dt className="text-muted">Jurisdiction</dt><dd>{c.jurisdiction}</dd>
                      <dt className="text-muted">Number</dt><dd>{c.credential_number ?? "—"}</dd>
                      <dt className="text-muted">Expires</dt><dd>{c.expires_on ?? "—"}</dd>
                    </dl>
                  </li>
                ))}
              </ul>
            ) : <Alert tone="warning">No credentials on file.</Alert>}
            <p className="mt-4 flex items-center gap-2 text-sm text-muted">Current profile status: <VerificationBadge status={v.verification_status} /></p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Decision" />
          <CardBody>
            {v.status !== "submitted" ? (
              <Alert tone="info">This submission was already reviewed ({v.status}).</Alert>
            ) : (
              <ActionForm action={reviewVerificationAction} className="space-y-5">
                <input type="hidden" name="verificationId" value={v.id} />
                <Fieldset legend="Verification checklist" hint="All four are required to approve. Check each against the regulator's public register.">
                  <Checkbox name="license_found_in_public_register" label="License/registration found in the regulator's public register" />
                  <Checkbox name="name_matches" label="Name on the register matches the profile" />
                  <Checkbox name="license_active" label="License is active and in good standing (no restrictions that bar practice)" />
                  <Checkbox name="jurisdiction_matches" label="Jurisdiction matches where the provider practices" />
                </Fieldset>
                <TextField label="Register reference (optional)" name="registerUrl" hint="e.g. the register URL or lookup reference" />
                <SelectField label="Decision" name="decision" defaultValue="approved">
                  <option value="approved">Approve — show “License verified”</option>
                  <option value="more_info_requested">Request more information</option>
                  <option value="rejected">Reject</option>
                </SelectField>
                <TextAreaField label="Reason shown to provider (required unless approving)" name="reason" rows={3} maxLength={1000} />
                <SubmitButton>Record decision</SubmitButton>
              </ActionForm>
            )}
          </CardBody>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader title="Suspend provider" description="Removes the profile from the directory and revokes verification. Use for serious concerns (e.g. impersonation, lapsed license)." />
        <CardBody>
          <ActionForm action={suspendProviderAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="providerId" value={v.provider_id} />
            <TextField label="Reason" name="reason" required className="min-w-72 flex-1" />
            <SubmitButton variant="danger">Suspend</SubmitButton>
          </ActionForm>
          <p className="mt-2 text-xs text-muted"><Badge tone="danger">Audited</Badge> This action is recorded and the provider is notified.</p>
        </CardBody>
      </Card>
    </>
  );
}
