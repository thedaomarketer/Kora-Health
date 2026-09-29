import type { Metadata } from "next";
import { History, Link2, ShieldCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/form";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { disconnectIntegrationAction, revokeScopeAction } from "../actions";

export const metadata: Metadata = { title: "Connected apps" };

interface Integration { slug: string; name: string; category: string; description: string; status: string; scopes: { scope: string; description: string }[] }
interface Connection { id: string; integration_slug: string; name: string; status: string; connected_at: string; permissions: { scope: string; revoked_at: string | null }[] }
interface HistoryRow { action: string; target_id: string | null; created_at: string; metadata: Record<string, unknown> }

const ACTION_LABEL: Record<string, string> = {
  "integration.connected": "Connected",
  "integration.disconnected": "Disconnected",
  "integration.scope_revoked": "Permission revoked",
  "consent.granted": "Consent granted",
  "consent.revoked": "Consent withdrawn",
};

export default async function ConnectionsPage() {
  const user = await requireUser({ role: "patient" });
  const [catalog, connections, history] = await asUser(user, async (q) => [
    await q<Integration>(`select slug, name, category, description, status, scopes from public.integrations order by sort_order`),
    await q<Connection>(
      `select c.id, c.integration_slug, i.name, c.status, c.connected_at,
              coalesce((select json_agg(json_build_object('scope', p.scope, 'revoked_at', p.revoked_at)) from public.integration_permissions p where p.connection_id = c.id), '[]') as permissions
         from public.integration_connections c join public.integrations i on i.slug = c.integration_slug
        where c.status = 'active' order by c.connected_at desc`,
    ),
    await q<HistoryRow>(
      `select action, target_id, created_at, metadata from public.audit_logs
        where subject_user_id = auth.uid() and (action like 'integration.%' or action like 'consent.%')
        order by created_at desc limit 25`,
    ),
  ] as const);

  return (
    <>
      <PageHeader title="Connected apps" description="Connect health apps, devices and records — only with your explicit permission." />
      <Alert tone="info" title="Integrations are coming soon" className="mb-6">
        None of these connections are live yet. Each will be enabled only once it&apos;s fully built, reviewed and tested.
        Until then nothing is connected and no data is imported.
      </Alert>

      <div className="grid gap-4 md:grid-cols-2">
        {catalog.map((i) => (
          <Card key={i.slug} className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Link2 aria-hidden className="size-5" /></div>
                <h2 className="font-semibold text-ink">{i.name}</h2>
              </div>
              <Badge tone={i.status === "available" ? "success" : "neutral"}>{i.status === "available" ? "Available" : "Coming soon"}</Badge>
            </div>
            <p className="mt-3 text-sm text-muted">{i.description}</p>
            {i.scopes.length ? (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Permissions it would request</p>
                <ul className="mt-2 space-y-1 text-sm text-ink/85">
                  {i.scopes.map((s) => <li key={s.scope} className="flex gap-2"><ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-600" />{s.description} <span className="text-muted">(read only)</span></li>)}
                </ul>
              </div>
            ) : null}
            <div className="mt-auto pt-5">
              <Button variant="secondary" size="sm" disabled aria-disabled>
                {i.status === "available" ? "Connect" : "Not available yet"}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader title="Your connections" description="Review permissions, revoke access or disconnect." />
        <CardBody>
          {connections.length ? (
            <ul className="space-y-4">
              {connections.map((c) => (
                <li key={c.id} className="rounded-2xl p-4 ring-1 ring-line">
                  <p className="font-semibold text-ink">{c.name}</p>
                  <p className="text-sm text-muted">Connected {formatDateTime(c.connected_at)}</p>
                  <ul className="mt-3 space-y-2">
                    {c.permissions.map((p) => (
                      <li key={p.scope} className="flex items-center justify-between gap-2 text-sm">
                        <span>{p.scope} {p.revoked_at ? <Badge>Revoked</Badge> : <Badge tone="success">Active</Badge>}</span>
                        {!p.revoked_at ? (
                          <form action={revokeScopeAction}>
                            <input type="hidden" name="connectionId" value={c.id} />
                            <input type="hidden" name="scope" value={p.scope} />
                            <Button type="submit" variant="ghost" size="sm">Revoke</Button>
                          </form>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <form action={disconnectIntegrationAction} className="mt-4 flex flex-wrap items-center gap-4 border-t border-line pt-4">
                    <input type="hidden" name="connectionId" value={c.id} />
                    <Checkbox name="deleteData" label="Also delete data imported from this app" />
                    <Button type="submit" variant="danger" size="sm">Disconnect</Button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">You have no connected apps.</p>
          )}
        </CardBody>
      </Card>

      <Card className="mt-8">
        <CardHeader title="Access history" description="Connection and consent changes on your account." />
        <CardBody>
          {history.length ? (
            <ul className="space-y-2">
              {history.map((h, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                  <History aria-hidden className="size-4 text-brand-700" />
                  <span className="font-medium text-ink">{ACTION_LABEL[h.action] ?? h.action}</span>
                  <span className="text-muted">{h.target_id?.replace(/_/g, " ")}</span>
                  <span className="text-muted">· {formatDateTime(h.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No activity yet.</p>
          )}
        </CardBody>
      </Card>
    </>
  );
}
