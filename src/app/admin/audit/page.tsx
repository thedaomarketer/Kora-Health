import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Audit log" };

const PAGE = 50;

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const prefix = typeof sp.action === "string" && /^[a-z_.]{1,60}$/.test(sp.action) ? sp.action : "";
  const subject = typeof sp.subject === "string" && /^[0-9a-f-]{36}$/.test(sp.subject) ? sp.subject : "";
  const page = Math.max(1, Math.min(200, Number(sp.page) || 1));
  const rows = await asUser(user, (q) =>
    q<{ id: number; actor_id: string | null; subject_user_id: string | null; action: string; target_type: string | null; target_id: string | null; metadata: Record<string, unknown>; created_at: string }>(
      `select id, actor_id, subject_user_id, action, target_type, target_id, metadata, created_at from public.audit_logs
        where ($1 = '' or action like $1 || '%') and ($2 = '' or subject_user_id::text = $2 or actor_id::text = $2)
        order by id desc limit ${PAGE} offset ${(page - 1) * PAGE}`,
      [prefix, subject],
    ),
  );
  const qs = (p: number) => `/admin/audit?${new URLSearchParams({ ...(prefix && { action: prefix }), ...(subject && { subject }), page: String(p) })}`;
  return (
    <>
      <PageHeader title="Audit log" description="Append-only record of security-relevant events. Entries can't be edited or deleted." />
      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="action" className="block text-sm font-semibold text-ink">Action prefix</label>
          <input id="action" name="action" defaultValue={prefix} placeholder="e.g. admin. or consent." className="mt-1 block min-h-11 rounded-xl border-0 px-3 ring-1 ring-inset ring-line" />
        </div>
        <div>
          <label htmlFor="subject" className="block text-sm font-semibold text-ink">User id (actor or subject)</label>
          <input id="subject" name="subject" defaultValue={subject} className="mt-1 block min-h-11 w-80 max-w-full rounded-xl border-0 px-3 ring-1 ring-inset ring-line" />
        </div>
        <button type="submit" className="min-h-11 rounded-full bg-brand-700 px-5 font-semibold text-white">Filter</button>
      </form>
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line/80">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
            <tr><th scope="col" className="px-3 py-2">Time</th><th scope="col" className="px-3 py-2">Action</th><th scope="col" className="px-3 py-2">Actor</th><th scope="col" className="px-3 py-2">Subject</th><th scope="col" className="px-3 py-2">Target</th><th scope="col" className="px-3 py-2">Details</th></tr>
          </thead>
          <tbody className="divide-y divide-line font-mono text-xs">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-3 py-2 font-sans">{formatDateTime(r.created_at)}</td>
                <td className="px-3 py-2 font-semibold text-ink">{r.action}</td>
                <td className="px-3 py-2">{r.actor_id ? <Link className="underline" href={`/admin/audit?subject=${r.actor_id}`}>{r.actor_id.slice(0, 8)}</Link> : "system"}</td>
                <td className="px-3 py-2">{r.subject_user_id ? <Link className="underline" href={`/admin/audit?subject=${r.subject_user_id}`}>{r.subject_user_id.slice(0, 8)}</Link> : "—"}</td>
                <td className="px-3 py-2">{r.target_type ? `${r.target_type}:${(r.target_id ?? "").slice(0, 12)}` : "—"}</td>
                <td className="max-w-xs truncate px-3 py-2" title={JSON.stringify(r.metadata)}>{Object.keys(r.metadata).length ? JSON.stringify(r.metadata) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav aria-label="Pagination" className="mt-4 flex justify-between text-sm">
        {page > 1 ? <Link href={qs(page - 1)} className="font-semibold text-brand-700">← Newer</Link> : <span />}
        {rows.length === PAGE ? <Link href={qs(page + 1)} className="font-semibold text-brand-700">Older →</Link> : <span />}
      </nav>
    </>
  );
}
