import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { features, env } from "@/lib/env";

export const metadata: Metadata = { title: "Admin overview" };

const LABELS: Record<string, string> = {
  patients: "Patients", providers: "Provider accounts", published_providers: "Published providers", verified_providers: "Verified providers",
  pending_verifications: "Pending verifications", open_reports: "Open reports", suspended_users: "Suspended accounts",
  appointment_requests_7d: "Requests (7 days)", appointments_confirmed_7d: "Confirmed (7 days)", messages_7d: "Messages (7 days)",
  ai_messages_7d: "AI messages (7 days)", active_integrations: "Active integrations",
};

export default async function AdminOverview() {
  const user = await requireAdmin();
  const started = Date.now();
  const [{ s }] = await asUser(user, (q) => q<{ s: Record<string, number> }>(`select public.admin_platform_stats() as s`));
  const dbLatency = Date.now() - started;
  const health = [
    ["Database", true, `${dbLatency} ms round trip`],
    ["Authentication", features.auth, features.auth ? "Supabase Auth configured" : "Not configured"],
    ["Kora AI", features.ai, features.ai ? `Model ${env.KORA_AI_MODEL}` : "No API key — safety responses only"],
    ["Payments", features.payments, features.payments ? "Stripe configured" : "Not configured"],
    ["File storage", features.storage, features.storage ? "Enabled" : "Attachments disabled"],
    ["Scheduled reminders", Boolean(env.CRON_SECRET), env.CRON_SECRET ? "Cron secret set" : "CRON_SECRET missing"],
    ["Account deletion", features.accountDeletion, features.accountDeletion ? "Service role configured" : "Not configured"],
  ] as const;
  return (
    <>
      <PageHeader title="Platform overview" description={`Environment: ${env.NEXT_PUBLIC_KORA_ENV}. Aggregate counts only — no personal data.`} />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(LABELS).map(([k, label]) => (
          <li key={k} className="rounded-3xl bg-white p-5 ring-1 ring-line/80">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-1 text-3xl font-bold text-ink">{s[k] ?? 0}</p>
          </li>
        ))}
      </ul>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="System health" />
          <CardBody>
            <ul className="space-y-3">
              {health.map(([name, ok, detail]) => (
                <li key={name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 font-medium text-ink">
                    {ok ? <CheckCircle2 aria-hidden className="size-4 text-emerald-600" /> : <XCircle aria-hidden className="size-4 text-amber-600" />}
                    {name}
                  </span>
                  <span className="text-muted">{detail}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Work queues" />
          <CardBody className="space-y-3 text-sm">
            <Link href="/admin/verifications" className="flex items-center justify-between rounded-xl p-3 ring-1 ring-line hover:bg-brand-50">
              Verifications awaiting review <Badge tone={s.pending_verifications ? "warning" : "neutral"}>{s.pending_verifications}</Badge>
            </Link>
            <Link href="/admin/reports" className="flex items-center justify-between rounded-xl p-3 ring-1 ring-line hover:bg-brand-50">
              Open reports <Badge tone={s.open_reports ? "warning" : "neutral"}>{s.open_reports}</Badge>
            </Link>
            <p className="text-xs text-muted">Signed in as {user.email} · role: {user.adminRole}</p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
