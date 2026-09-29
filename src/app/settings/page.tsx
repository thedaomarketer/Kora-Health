import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { PatientProfileForm } from "@/components/forms/profile-forms";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { TextField } from "@/components/ui/form";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { getReferenceData } from "@/lib/directory";
import { features } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { getConsents, getPatientProfile } from "@/lib/profiles";
import { deleteAccountAction, setConsentAction, updateAccountAction } from "./actions";

export const metadata: Metadata = { title: "Settings" };

const CONSENTS = [
  { type: "ai_assistant", title: "Kora AI", text: "Messages you send to Kora AI are processed by our AI service provider and stored so you can revisit them.", roles: ["patient", "provider"] },
  { type: "health_data_storage", title: "Health information storage", text: "Kora stores health information you enter. Only you can see it.", roles: ["patient"] },
  { type: "matching_personalization", title: "Personalized provider suggestions", text: "Use your saved preferences to suggest providers. Never uses race or ethnicity.", roles: ["patient"] },
  { type: "product_updates", title: "Product updates", text: "Occasional emails about new Kora features.", roles: ["patient", "provider"] },
] as const;

const ACTION_LABEL: Record<string, string> = {
  "account.created": "Account created",
  "account.password_changed": "Password changed",
  "consent.granted": "Consent granted",
  "consent.revoked": "Consent withdrawn",
  "appointment.request_created": "Appointment requested",
  "appointment.confirmed": "Appointment confirmed",
  "appointment.cancelled": "Appointment cancelled",
  "appointment.request_withdrawn": "Request withdrawn",
  "appointment.request_declined": "Request declined",
  "message.conversation_started": "Conversation started",
  "health_data.insert": "Health entry added",
  "health_data.update": "Health entry updated",
  "health_data.delete": "Health entry deleted",
  "integration.connected": "App connected",
  "integration.disconnected": "App disconnected",
  "provider.profile_created": "Provider profile created",
  "provider.verification_submitted": "Verification submitted",
  "admin.verification_approved": "Verification approved",
  "admin.verification_rejected": "Verification not approved",
  "admin.user_status_changed": "Account status changed by Kora",
};

export default async function SettingsPage() {
  const user = await requireUser({ next: "/settings" });
  const [consents, history, profile, reference] = await Promise.all([
    getConsents(user),
    asUser(user, (q) => q<{ action: string; target_id: string | null; created_at: string; actor_id: string | null }>(
      `select action, target_id, created_at, actor_id from public.audit_logs where subject_user_id = auth.uid() order by created_at desc limit 30`,
    )),
    user.role === "patient" ? getPatientProfile(user) : Promise.resolve(null),
    user.role === "patient" ? getReferenceData() : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader title="Settings" description="Manage your account, privacy and preferences." />
      <div className="space-y-8">
        <Card>
          <CardHeader title="Account" />
          <CardBody>
            <ActionForm action={updateAccountAction} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <TextField label="Name" name="displayName" defaultValue={user.displayName} required />
              <TextField label="Email" name="email" defaultValue={user.email} disabled hint="Contact support to change your email." />
              <SubmitButton>Save</SubmitButton>
            </ActionForm>
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
              <p className="text-sm text-muted">Account type: <Badge tone="brand">{user.role === "provider" ? "Provider" : "Patient"}</Badge></p>
              <ButtonLink href="/reset-password" variant="secondary" size="sm">Change password</ButtonLink>
              {user.role === "provider" ? <ButtonLink href="/provider/profile" variant="ghost" size="sm">Edit public profile</ButtonLink> : null}
            </div>
          </CardBody>
        </Card>

        <Card id="privacy">
          <CardHeader title="Privacy & consent" description="Each choice is separate and can be changed at any time. Changes are recorded in your access history." />
          <ul className="divide-y divide-line">
            {CONSENTS.filter((c) => (c.roles as readonly string[]).includes(user.role)).map((c) => {
              const current = consents[c.type];
              const granted = current?.granted === true;
              return (
                <li key={c.type} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
                  <div className="max-w-xl">
                    <p className="flex items-center gap-2 font-semibold text-ink">
                      {c.title} {granted ? <Badge tone="success">On</Badge> : <Badge>Off</Badge>}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">{c.text}</p>
                    {current ? <p className="mt-1 text-xs text-muted">Last changed {formatDateTime(current.created_at)} · version {current.version}</p> : null}
                  </div>
                  <form action={setConsentAction}>
                    <input type="hidden" name="type" value={c.type} />
                    <input type="hidden" name="granted" value={granted ? "0" : "1"} />
                    <Button type="submit" variant={granted ? "secondary" : "primary"} size="sm">{granted ? "Turn off" : "Turn on"}</Button>
                  </form>
                </li>
              );
            })}
          </ul>
        </Card>

        {profile && reference ? (
          <Card>
            <CardHeader title="Care preferences" description="Used to personalize provider suggestions (when enabled) and to pre-fill searches." />
            <CardBody>
              <PatientProfileForm profile={profile} reference={reference} mode="settings" />
            </CardBody>
          </Card>
        ) : null}

        <Card id="history">
          <CardHeader title="Access history" description="Significant events on your account. Entries marked “by Kora” were performed by Kora staff." />
          <CardBody>
            {history.length ? (
              <ul className="space-y-2">
                {history.map((h, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                    <ShieldCheck aria-hidden className="size-4 text-brand-700" />
                    <span className="font-medium text-ink">{ACTION_LABEL[h.action] ?? h.action}</span>
                    {h.action.startsWith("consent.") && h.target_id ? <span className="text-muted">{h.target_id.replace(/_/g, " ")}</span> : null}
                    {h.actor_id && h.actor_id !== user.id ? <Badge tone="info">by Kora</Badge> : null}
                    <span className="text-muted">· {formatDateTime(h.created_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No events yet.</p>
            )}
          </CardBody>
        </Card>

        <Card className="ring-red-200">
          <CardHeader title="Delete account" description="Permanently delete your account and associated information. This can't be undone." />
          <CardBody>
            <ul className="mb-5 list-disc space-y-1 pl-5 text-sm text-muted">
              <li>Your profile, preferences, saved providers, health information and Kora AI conversations are deleted.</li>
              <li>Your appointment requests, appointments and messages are deleted{user.role === "provider" ? ", and your public profile is removed" : ""}.</li>
              <li>Security audit records are kept with a pseudonymous identifier only.</li>
            </ul>
            {features.accountDeletion ? (
              <ActionForm action={deleteAccountAction} className="flex flex-wrap items-end gap-3">
                <TextField label='Type "DELETE" to confirm' name="confirm" autoComplete="off" required />
                <SubmitButton variant="danger" pendingLabel="Deleting…">Delete my account</SubmitButton>
              </ActionForm>
            ) : (
              <p className="text-sm text-muted">
                Self-service deletion isn&apos;t configured in this environment. <Link href="/privacy" className="text-brand-700 underline">Contact us</Link> to delete your account.
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
