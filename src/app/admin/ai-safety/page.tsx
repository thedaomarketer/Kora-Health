import type { Metadata } from "next";
import { Alert, EmptyState } from "@/components/ui/alert";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "AI safety monitoring" };

const DESCRIPTIONS: Record<string, string> = {
  emergency: "Possible emergency — fixed emergency guidance returned, model not called",
  crisis_self_harm: "Possible self-harm crisis — crisis resources returned, model not called",
  harm_to_others: "Possible risk to others — emergency guidance returned",
  abuse_or_unsafe: "Possible abuse — safety resources returned",
  medication_change: "Asked about changing medication — model instructed to defer to prescriber",
  diagnosis_request: "Asked for a diagnosis — model instructed not to diagnose",
  output_policy_review: "Response matched a policy pattern — corrective note appended",
};

export default async function AiSafetyPage({ searchParams }: PageProps<"/admin/ai-safety">) {
  const user = await requireAdmin("moderator");
  const sp = await searchParams;
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const rows = await asUser(user, (q) => q<{ flag: string; occurrences: number; last_seen: string }>(`select * from public.admin_ai_safety_summary($1)`, [days]));
  return (
    <>
      <PageHeader title="AI safety monitoring" description={`Safety flags raised by Kora AI in the last ${days} days. Aggregate counts only — staff cannot read AI conversations.`} />
      <Alert tone="info" className="mb-6">
        Review trends here. Spikes in <strong>output_policy_review</strong> indicate the model producing content close to its limits and warrant prompt review. See docs/AI_SAFETY.md.
      </Alert>
      <Card>
        <CardHeader title="Flags" action={<form method="get" className="flex items-center gap-2 text-sm"><label htmlFor="days">Window</label><select id="days" name="days" defaultValue={days} className="rounded-lg px-2 py-1 ring-1 ring-line"><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select><button type="submit" className="font-semibold text-brand-700">Apply</button></form>} />
        <CardBody>
          {rows.length ? (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-muted"><tr><th scope="col" className="py-2">Flag</th><th scope="col">Meaning</th><th scope="col" className="text-right">Count</th><th scope="col" className="text-right">Last seen</th></tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.flag}><td className="py-2 font-mono text-xs font-semibold">{r.flag}</td><td className="py-2 text-muted">{DESCRIPTIONS[r.flag] ?? ""}</td><td className="py-2 text-right tabular-nums">{r.occurrences}</td><td className="py-2 text-right">{formatDateTime(r.last_seen)}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyState title="No safety flags in this window" />}
        </CardBody>
      </Card>
    </>
  );
}
