import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { EmptyState } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/card";
import { TextField } from "@/components/ui/form";
import { requireAdmin } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { setUserStatusAction } from "../actions";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const user = await requireAdmin("moderator");
  const sp = await searchParams;
  const query = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const rows = query.length >= 3
    ? await asUser(user, async (q) => {
        await q(`select public.admin_record_event('user_search', 'user', null, null, jsonb_build_object('query_length', $1::int))`, [query.length]);
        return q<{ id: string; email: string; display_name: string; role: string; status: string; status_reason: string | null; created_at: string; admin_role: string | null }>(
          `select u.id, u.email, u.display_name, u.role, u.status, u.status_reason, u.created_at, a.admin_role
             from public.users u left join public.administrators a on a.user_id = u.id
            where u.email ilike $1 or u.display_name ilike $1 order by u.created_at desc limit 50`,
          [`%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`],
        );
      })
    : [];
  return (
    <>
      <PageHeader title="Users" description="Search accounts by email or name. Staff see account details only — never health information, messages or AI conversations." />
      <form method="get" className="mb-6 flex max-w-xl gap-2">
        <label htmlFor="q" className="sr-only">Search users</label>
        <input id="q" name="q" defaultValue={query} minLength={3} placeholder="Email or name (min. 3 characters)" className="block min-h-11 flex-1 rounded-xl border-0 px-3.5 ring-1 ring-inset ring-line focus:ring-2 focus:ring-brand-500 focus:outline-none" />
        <button type="submit" className="rounded-full bg-brand-700 px-5 font-semibold text-white hover:bg-brand-800">Search</button>
      </form>
      {query.length >= 3 ? (
        rows.length ? (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.id} className="rounded-2xl bg-white p-4 ring-1 ring-line/80">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{r.display_name || "(no name)"} <span className="font-normal text-muted">· {r.email}</span></p>
                    <p className="mt-1 flex flex-wrap gap-1.5 text-sm">
                      <Badge tone="brand">{r.role}</Badge>
                      <Badge tone={r.status === "active" ? "success" : "danger"}>{r.status}</Badge>
                      {r.admin_role ? <Badge tone="info">admin: {r.admin_role}</Badge> : null}
                      <span className="text-muted">joined {formatDateTime(r.created_at)}</span>
                    </p>
                    {r.status_reason ? <p className="mt-1 text-sm text-muted">Reason: {r.status_reason}</p> : null}
                  </div>
                  {r.id !== user.id ? (
                    <ActionForm action={setUserStatusAction} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="userId" value={r.id} />
                      <input type="hidden" name="status" value={r.status === "active" ? "suspended" : "active"} />
                      <TextField label="Reason" name="reason" required minLength={3} />
                      <SubmitButton variant={r.status === "active" ? "danger" : "secondary"} size="md">{r.status === "active" ? "Suspend" : "Reactivate"}</SubmitButton>
                    </ActionForm>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="No matching accounts" />
      ) : null}
    </>
  );
}
