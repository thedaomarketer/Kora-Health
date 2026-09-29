import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";
import { asUser } from "@/lib/db";

export const metadata: Metadata = { title: "Integrations" };

export default async function IntegrationsAdmin() {
  const user = await requireAdmin();
  const rows = await asUser(user, (q) => q<{ slug: string; name: string; status: string; active_connections: number; revoked_connections: number }>(`select * from public.admin_integration_stats()`));
  return (
    <>
      <PageHeader title="Integration monitoring" description="Catalog status and connection counts. An integration is marked available only after it's implemented, reviewed and tested (docs/INTEGRATIONS.md)." />
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line/80">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="border-b border-line bg-canvas text-xs uppercase text-muted"><tr><th scope="col" className="px-4 py-3">Integration</th><th scope="col" className="px-4 py-3">Status</th><th scope="col" className="px-4 py-3 text-right">Active</th><th scope="col" className="px-4 py-3 text-right">Revoked</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.slug}>
                <th scope="row" className="px-4 py-3 font-semibold text-ink">{r.name} <span className="font-mono text-xs font-normal text-muted">{r.slug}</span></th>
                <td className="px-4 py-3"><Badge tone={r.status === "available" ? "success" : "neutral"}>{r.status.replace("_", " ")}</Badge></td>
                <td className="px-4 py-3 text-right tabular-nums">{r.active_connections}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.revoked_connections}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
