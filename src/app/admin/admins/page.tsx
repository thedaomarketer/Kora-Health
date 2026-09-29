import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { SelectField, TextField } from "@/components/ui/form";
import { hasAdminRole, requireAdmin } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { grantAdminAction, revokeAdminAction } from "../actions";

export const metadata: Metadata = { title: "Administrators" };

export default async function AdminsPage() {
  const user = await requireAdmin();
  const superadmin = hasAdminRole(user, "superadmin");
  const rows = await asUser(user, (q) => q<{ user_id: string; email: string; display_name: string; admin_role: string; granted_at: string }>(
    `select a.user_id, u.email, u.display_name, a.admin_role, a.granted_at from public.administrators a join public.users u on u.id = a.user_id order by a.granted_at`,
  ));
  return (
    <>
      <PageHeader title="Administrators" description="Moderators handle reports and accounts; verifiers review credentials; superadmins manage roles. Every change is audited." />
      {!superadmin ? <Alert tone="info" className="mb-6">Only superadmins can change roles.</Alert> : null}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-line/80">
            <div>
              <p className="font-semibold text-ink">{r.display_name || r.email} <span className="font-normal text-muted">· {r.email}</span></p>
              <p className="text-sm text-muted"><Badge tone="info">{r.admin_role}</Badge> since {formatDateTime(r.granted_at)}</p>
            </div>
            {superadmin && r.user_id !== user.id ? (
              <form action={revokeAdminAction}><input type="hidden" name="userId" value={r.user_id} /><Button type="submit" variant="ghost" size="sm">Revoke</Button></form>
            ) : null}
          </li>
        ))}
      </ul>
      {superadmin ? (
        <Card className="mt-8 max-w-2xl">
          <CardHeader title="Grant a role" />
          <CardBody>
            <ActionForm action={grantAdminAction} className="flex flex-wrap items-end gap-3">
              <TextField label="Account email" name="email" type="email" required className="min-w-64 flex-1" />
              <SelectField label="Role" name="role" defaultValue="moderator">
                <option value="moderator">Moderator</option>
                <option value="verifier">Verifier</option>
                <option value="superadmin">Superadmin</option>
              </SelectField>
              <SubmitButton>Grant</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
