import type { Metadata } from "next";
import { MessageSquare, Users } from "lucide-react";
import { EmptyState } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { startConversationAction } from "@/app/patient/actions";

export const metadata: Metadata = { title: "Patients" };

export default async function PatientsPage() {
  const user = await requireUser({ role: "provider" });
  const [{ provider_id: providerId }] = await asUser(user, (q) => q<{ provider_id: string }>(`select public.current_provider_id() as provider_id`));
  const rows = await asUser(user, (q) =>
    q<{ patient_id: string; name: string; requests: number; appointments: number; next_at: string | null; last_at: string | null }>(
      `with rel as (
         select patient_id, patient_display_name as name, created_at as ts, 'r' as kind, null::timestamptz as starts_at, null::text as status
           from public.appointment_requests where provider_id = public.current_provider_id()
         union all
         select patient_id, patient_display_name, created_at, 'a', starts_at, status::text
           from public.appointments where provider_id = public.current_provider_id())
       select patient_id, (array_agg(name order by ts desc))[1] as name,
              count(*) filter (where kind = 'r')::int as requests,
              count(*) filter (where kind = 'a')::int as appointments,
              min(starts_at) filter (where kind = 'a' and status = 'confirmed' and starts_at > now()) as next_at,
              max(ts) as last_at
         from rel group by patient_id order by max(ts) desc`,
    ),
  );
  return (
    <>
      <PageHeader title="Patients" description="People who have requested appointments with you on Kora. You see only what they've shared in requests and messages." />
      {rows.length ? (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line/80">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
              <tr><th scope="col" className="px-4 py-3">Patient</th><th scope="col" className="px-4 py-3">Requests</th><th scope="col" className="px-4 py-3">Appointments</th><th scope="col" className="px-4 py-3">Next appointment</th><th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.patient_id}>
                  <th scope="row" className="px-4 py-3 font-semibold text-ink">{r.name}</th>
                  <td className="px-4 py-3">{r.requests}</td>
                  <td className="px-4 py-3">{r.appointments}</td>
                  <td className="px-4 py-3 text-muted">{r.next_at ? formatDateTime(r.next_at) : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <form action={startConversationAction}>
                      <input type="hidden" name="providerId" value={providerId} />
                      <input type="hidden" name="patientId" value={r.patient_id} />
                      <button type="submit" className={buttonClasses("secondary", "sm")}><MessageSquare aria-hidden className="size-4" /> Message</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState icon={<Users aria-hidden className="size-6" />} title="No patients yet" description="Patients appear here after they request an appointment." />}
    </>
  );
}
