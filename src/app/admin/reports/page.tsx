import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Alert, EmptyState } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, PageHeader } from "@/components/ui/card";
import { SelectField, TextField } from "@/components/ui/form";
import { requireAdmin } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { resolveReportAction } from "../actions";

export const metadata: Metadata = { title: "Reports" };

interface Report { id: string; target_type: string; target_id: string; reason: string; details: string | null; status: string; created_at: string; provider_slug: string | null; resolution_note: string | null }

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const user = await requireAdmin("moderator");
  const sp = await searchParams;
  const view = sp.view === "closed" ? "closed" : "open";
  const viewMessage = typeof sp.message === "string" && /^[0-9a-f-]{36}$/.test(sp.message) ? sp.message : null;
  const [reports, reported] = await asUser(user, async (q) => [
    await q<Report>(
      `select r.id, r.target_type, r.target_id, r.reason, r.details, r.status, r.created_at, r.resolution_note,
              (select p.slug from public.provider_profiles p where p.id = r.target_id and r.target_type = 'provider_profile') as provider_slug
         from public.reports r where ${view === "open" ? "r.status in ('open','reviewing')" : "r.status in ('actioned','dismissed')"}
        order by r.created_at ${view === "open" ? "asc" : "desc"} limit 200`,
    ),
    viewMessage ? await q<{ body: string; created_at: string; sender_id: string }>(`select body, created_at, sender_id from public.admin_get_reported_message($1)`, [viewMessage]) : [],
  ] as const);

  return (
    <>
      <PageHeader title="Reports & moderation" description="Reports from patients and providers. Moderators can view only the specific message that was reported; every view is logged."
        actions={<div className="flex gap-2 text-sm"><Link href="/admin/reports" className={view === "open" ? "font-semibold text-brand-800 underline" : "text-brand-700"}>Open</Link><Link href="/admin/reports?view=closed" className={view === "closed" ? "font-semibold text-brand-800 underline" : "text-brand-700"}>Closed</Link></div>} />
      {reported.length ? (
        <Alert tone="info" title="Reported message (access logged)" className="mb-6">
          <p className="whitespace-pre-wrap">{reported[0].body}</p>
          <p className="mt-1 text-xs">Sent {formatDateTime(reported[0].created_at)} · sender {reported[0].sender_id.slice(0, 8)}…</p>
        </Alert>
      ) : null}
      {reports.length ? (
        <ul className="space-y-4">
          {reports.map((r) => (
            <li key={r.id}>
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold capitalize text-ink">{r.reason.replace(/_/g, " ")} · {r.target_type.replace(/_/g, " ")}</p>
                    <p className="text-sm text-muted">Reported {formatDateTime(r.created_at)}</p>
                  </div>
                  <Badge tone={r.status === "open" ? "warning" : r.status === "reviewing" ? "info" : "neutral"}>{r.status}</Badge>
                </div>
                {r.details ? <p className="mt-3 rounded-xl bg-canvas p-3 text-sm">{r.details}</p> : null}
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  {r.provider_slug ? <Link href={`/providers/${r.provider_slug}`} className="font-semibold text-brand-700 underline">View profile</Link> : null}
                  {r.target_type === "message" ? <Link href={`/admin/reports?message=${r.id}`} className="font-semibold text-brand-700 underline">View reported message</Link> : null}
                  {r.target_type === "conversation" ? <span className="text-muted">Conversation reports can&apos;t be opened by staff; ask the reporter to report specific messages or contact the parties.</span> : null}
                </div>
                {r.resolution_note ? <p className="mt-2 text-sm text-muted">Note: {r.resolution_note}</p> : null}
                {view === "open" ? (
                  <ActionForm action={resolveReportAction} className="mt-4 flex flex-wrap items-end gap-3">
                    <input type="hidden" name="reportId" value={r.id} />
                    <SelectField label="Outcome" name="status" defaultValue="reviewing">
                      <option value="reviewing">Mark reviewing</option>
                      <option value="actioned">Actioned</option>
                      <option value="dismissed">Dismissed</option>
                    </SelectField>
                    <TextField label="Internal note" name="note" className="min-w-64 flex-1" />
                    <SubmitButton size="md">Update</SubmitButton>
                  </ActionForm>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      ) : <EmptyState title={view === "open" ? "No open reports" : "No closed reports"} />}
    </>
  );
}
