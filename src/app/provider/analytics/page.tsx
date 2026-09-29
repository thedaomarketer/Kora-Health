import type { Metadata } from "next";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";

export const metadata: Metadata = { title: "Analytics" };

interface Stats { pending_requests: number; upcoming_appointments: number; completed_appointments_30d: number; requests_30d: number; saved_by_patients: number; patients: number; unread_messages: number }

export default async function AnalyticsPage() {
  const user = await requireUser({ role: "provider" });
  const [stats, weekly] = await asUser(user, async (q) => [
    (await q<{ s: Stats }>(`select public.provider_stats() as s`))[0].s,
    await q<{ week: string; requests: number; confirmed: number }>(
      `select to_char(w, 'Mon DD') as week,
              (select count(*)::int from public.appointment_requests r where r.provider_id = public.current_provider_id() and r.created_at >= w and r.created_at < w + interval '7 days') as requests,
              (select count(*)::int from public.appointments a where a.provider_id = public.current_provider_id() and a.created_at >= w and a.created_at < w + interval '7 days') as confirmed
         from generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') w order by w`,
    ),
  ] as const);
  const max = Math.max(1, ...weekly.map((w) => w.requests));
  const tiles = [
    ["Requests (30 days)", stats.requests_30d],
    ["Completed visits (30 days)", stats.completed_appointments_30d],
    ["Patients on Kora", stats.patients],
    ["Saved your profile", stats.saved_by_patients],
  ] as const;
  return (
    <>
      <PageHeader title="Analytics" description="Activity on your Kora profile. Counts only — no patient-level tracking." />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([label, value]) => (
          <li key={label} className="rounded-3xl bg-white p-5 ring-1 ring-line/80">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-1 text-3xl font-bold text-ink">{value}</p>
          </li>
        ))}
      </ul>
      <Card className="mt-8">
        <CardHeader title="Appointment requests per week" description="Last 8 weeks" />
        <CardBody>
          <table className="w-full text-sm">
            <caption className="sr-only">Weekly appointment requests and confirmations</caption>
            <thead className="sr-only"><tr><th scope="col">Week of</th><th scope="col">Requests</th><th scope="col">Confirmed</th></tr></thead>
            <tbody>
              {weekly.map((w) => (
                <tr key={w.week}>
                  <th scope="row" className="w-24 py-1.5 pr-3 text-left font-medium text-muted">{w.week}</th>
                  <td className="py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-3 rounded-full bg-brand-600" style={{ width: `${(w.requests / max) * 100}%`, minWidth: w.requests ? "0.75rem" : 0 }} aria-hidden />
                      <span className="tabular-nums text-ink">{w.requests}</span>
                    </div>
                  </td>
                  <td className="w-28 py-1.5 text-right tabular-nums text-muted">{w.confirmed} confirmed</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </>
  );
}
