import type { Metadata } from "next";
import Link from "next/link";
import { Alert, EmptyState } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Verifications" };

export default async function VerificationsQueue({ searchParams }: PageProps<"/admin/verifications">) {
  const user = await requireAdmin("verifier");
  const sp = await searchParams;
  const rows = await asUser(user, (q) =>
    q<{ id: string; status: string; submitted_at: string; name: string; profession: string | null; is_demo: boolean; credentials: number; reason: string | null }>(
      `select v.id, v.status, v.submitted_at, concat_ws(' ', p.honorific, p.display_name) as name, pr.name as profession, p.is_demo,
              (select count(*)::int from public.provider_credentials c where c.provider_id = p.id) as credentials,
              v.checks ->> 'reason' as reason
         from public.provider_verifications v
         join public.provider_profiles p on p.id = v.provider_id
         left join public.professions pr on pr.id = p.profession_id
        where v.status = 'submitted' order by v.submitted_at asc limit 200`,
    ),
  );
  return (
    <>
      <PageHeader title="Provider verifications" description="Review submitted credentials against the issuing regulator's public register. Oldest first." />
      {sp.reviewed ? <Alert tone="success" className="mb-6">Review recorded and the provider notified.</Alert> : null}
      {rows.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-white ring-1 ring-line/80">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/verifications/${r.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-brand-50/50">
                <div>
                  <p className="font-semibold text-ink">{r.name} {r.is_demo ? <Badge tone="info">Sample</Badge> : null}</p>
                  <p className="text-sm text-muted">{r.profession ?? "Profession not set"} · {r.credentials} credential(s) · submitted {formatDateTime(r.submitted_at)}</p>
                </div>
                {r.reason === "credentials_changed" ? <Badge tone="info">Re-review: credentials changed</Badge> : <Badge tone="warning">Awaiting review</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      ) : <EmptyState title="Queue is empty" description="No verifications are waiting for review." />}
    </>
  );
}
