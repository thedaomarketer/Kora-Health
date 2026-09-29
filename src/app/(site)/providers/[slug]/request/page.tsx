import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RequestForm } from "@/components/directory/request-form";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { getOpenSlots, getPublicProvider, providerFullName } from "@/lib/directory";
import { features } from "@/lib/env";
import { requestAppointmentAction } from "../../actions";

export const metadata: Metadata = { title: "Request an appointment", robots: { index: false } };

export default async function RequestPage({ params, searchParams }: PageProps<"/providers/[slug]/request">) {
  const { slug } = await params;
  const sp = await searchParams;
  if (!features.database) notFound();
  const user = await getSessionUser();
  if (!user) redirect(`/sign-in?next=/providers/${slug}/request`);

  const provider = await getPublicProvider(slug);
  if (!provider) notFound();
  const name = providerFullName(provider);
  const rescheduleOf = typeof sp.reschedule === "string" && /^[0-9a-f-]{36}$/.test(sp.reschedule) ? sp.reschedule : undefined;

  if (user.role !== "patient") {
    return (
      <div className="container-page max-w-2xl py-12">
        <Alert tone="info" title="Patient account required">
          Appointment requests are made from patient accounts. You&apos;re signed in as a provider.
        </Alert>
      </div>
    );
  }

  const durations = [...new Set([30, ...provider.service_list.map((s) => s.duration_minutes)])];
  const slotLists = await Promise.all(durations.map((d) => getOpenSlots(provider.id, d, 14)));
  const slotsByDuration = Object.fromEntries(durations.map((d, i) => [d, slotLists[i].map((s) => ({ starts_at: s.starts_at, modality: s.modality }))]));
  const tz = provider.weekly_hours[0]?.timezone ?? "America/Toronto";

  return (
    <div className="container-page max-w-3xl py-10 sm:py-12">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href={`/providers/${provider.slug}`} className="hover:text-brand-700 hover:underline">{name}</Link>
        <span aria-hidden> / </span>
        <span aria-current="page">{rescheduleOf ? "Reschedule" : "Request appointment"}</span>
      </nav>
      <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink">
        {rescheduleOf ? "Request a new time" : "Request an appointment"}
      </h1>
      <p className="mt-2 text-muted">
        with <strong className="text-ink">{name}</strong>
        {provider.profession ? ` · ${provider.profession}` : ""}. The provider will confirm or decline your request, and
        you&apos;ll be notified in Kora.
      </p>

      {provider.is_demo ? (
        <Alert tone="info" className="mt-5">
          This is a fictional sample profile. Requests here are for development testing only.
        </Alert>
      ) : null}

      {!provider.accepting_new_patients && !rescheduleOf ? (
        <Alert tone="warning" className="mt-6" title="Not accepting new patients">
          This provider isn&apos;t accepting new patients. If you&apos;re an existing patient you may still request a time.
        </Alert>
      ) : null}

      <Card className="mt-8 p-6 sm:p-8">
        {provider.weekly_hours.length ? (
          <RequestForm
            action={requestAppointmentAction}
            providerId={provider.id}
            services={provider.service_list}
            slotsByDuration={slotsByDuration}
            offersVirtual={provider.offers_virtual}
            offersInPerson={provider.offers_in_person}
            timeZone={tz}
            rescheduleOf={rescheduleOf}
          />
        ) : (
          <div className="text-center">
            <p className="text-muted">This provider hasn&apos;t enabled online appointment requests.</p>
            <ButtonLink href={`/providers/${provider.slug}`} variant="secondary" className="mt-4">
              Back to profile
            </ButtonLink>
          </div>
        )}
      </Card>
    </div>
  );
}
