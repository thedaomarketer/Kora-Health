import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bookmark, BookmarkCheck, Building2, CalendarPlus, Clock, Info, Languages, MapPin, Monitor, Wallet } from "lucide-react";
import { ProviderInitials } from "@/components/directory/provider-card";
import { ReportDialog } from "@/components/report-dialog";
import { Alert } from "@/components/ui/alert";
import { Badge, DemoBadge, VerificationBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { LANGUAGES, PAYMENT_OPTIONS, COUNTRIES } from "@/lib/constants";
import { asUser } from "@/lib/db";
import { getOpenSlots, getPublicProvider, providerFullName } from "@/lib/directory";
import { features } from "@/lib/env";
import { formatDateTime, MODALITY_LABEL, WEEKDAYS } from "@/lib/format";
import { reportAction, toggleSaveProviderAction } from "../actions";

export async function generateMetadata({ params }: PageProps<"/providers/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!features.database) return { title: "Provider" };
  const p = await getPublicProvider(slug);
  if (!p) return { title: "Provider not found" };
  return {
    title: `${providerFullName(p)} — ${p.profession ?? "Healthcare professional"}`,
    description: p.headline ?? undefined,
    robots: p.is_demo ? { index: false } : undefined,
  };
}

export default async function ProviderProfilePage({ params }: PageProps<"/providers/[slug]">) {
  const { slug } = await params;
  if (!features.database) notFound();
  const provider = await getPublicProvider(slug);
  if (!provider) notFound();

  const user = await getSessionUser();
  const [slots, saved] = await Promise.all([
    getOpenSlots(provider.id, provider.service_list[0]?.duration_minutes ?? 30, 14),
    user?.role === "patient"
      ? asUser(user, async (q) => (await q(`select 1 from public.saved_providers where patient_id = auth.uid() and provider_id = $1`, [provider.id])).length > 0)
      : Promise.resolve(false),
  ]);
  const tz = provider.weekly_hours[0]?.timezone;
  const name = providerFullName(provider);
  const canRequest = provider.accepting_new_patients && provider.weekly_hours.length > 0;

  return (
    <div className="container-page py-10 sm:py-12">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/providers" className="hover:text-brand-700 hover:underline">Find a provider</Link>
        <span aria-hidden> / </span>
        <span aria-current="page">{name}</span>
      </nav>

      {provider.is_demo ? (
        <Alert tone="info" title="Sample profile — development data" className="mt-5">
          This profile is fictional and exists only to test Kora in a development environment. It does not represent a
          real healthcare professional.
        </Alert>
      ) : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {/* Header */}
          <Card className="p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <ProviderInitials name={provider.display_name} className="size-20 text-2xl" />
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
                  {name}
                  {provider.post_nominals ? <span className="font-sans text-xl font-normal text-muted">, {provider.post_nominals}</span> : null}
                </h1>
                <p className="mt-1 text-muted">
                  {provider.profession ?? "Healthcare professional"}
                  {provider.pronouns ? ` · ${provider.pronouns}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <VerificationBadge status={provider.verification_status} verifiedAt={provider.verified_at} />
                  {provider.is_demo ? <DemoBadge /> : null}
                  {provider.accepting_new_patients ? <Badge tone="brand">Accepting new patients</Badge> : <Badge>Not accepting new patients</Badge>}
                </div>
                {provider.headline ? <p className="mt-4 text-lg text-ink/90">{provider.headline}</p> : null}
              </div>
            </div>
            <VerificationExplainer status={provider.verification_status} verifiedAt={provider.verified_at} />
          </Card>

          {provider.bio ? (
            <Card>
              <CardHeader title="About" />
              <CardBody>
                <p className="whitespace-pre-line leading-relaxed text-ink/90">{provider.bio}</p>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Specialties & services" />
            <CardBody className="space-y-5">
              <ul className="flex flex-wrap gap-2" aria-label="Specialties">
                {provider.specialties.map((s) => (
                  <li key={s.slug}>
                    <Link href={`/providers?specialty=${s.slug}`}>
                      <Badge tone="brand" className="text-sm">{s.name}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
              {provider.service_list.length ? (
                <ul className="divide-y divide-line rounded-2xl ring-1 ring-line">
                  {provider.service_list.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">{s.name}</p>
                        {s.description ? <p className="mt-0.5 text-sm text-muted">{s.description}</p> : null}
                        {s.fee_note ? <p className="mt-1 text-sm text-ink/80">Fees: {s.fee_note}</p> : null}
                      </div>
                      <div className="flex gap-1.5">
                        <Badge>{s.duration_minutes} min</Badge>
                        <Badge tone="info">{MODALITY_LABEL[s.modality]}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">This provider hasn&apos;t listed individual services yet.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Weekly hours for online requests" description={tz ? `Times shown in ${tz.replace("_", " ")}` : undefined} />
            <CardBody>
              {provider.weekly_hours.length ? (
                <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                  {groupHours(provider.weekly_hours).map(([day, ranges]) => (
                    <div key={day} className="flex justify-between gap-4 border-b border-line/60 py-1.5 text-sm">
                      <dt className="font-medium text-ink">{WEEKDAYS[day]}</dt>
                      <dd className="text-muted">{ranges.join(", ")}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-muted">This provider hasn&apos;t published availability for online requests.</p>
              )}
              <p className="mt-4 text-xs text-muted">
                Kora shows availability the provider has entered on Kora. It is not synced with their practice&apos;s own
                scheduling system; every request is confirmed by the provider.
              </p>
            </CardBody>
          </Card>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          <Card className="p-6 lg:sticky lg:top-24">
            <h2 className="font-semibold text-ink">Request an appointment</h2>
            {canRequest ? (
              <>
                <p className="mt-1 text-sm text-muted">
                  {slots.length ? (
                    <>Next opening: <strong className="text-ink">{formatDateTime(slots[0].starts_at, tz)}</strong></>
                  ) : (
                    "No openings in the next two weeks."
                  )}
                </p>
                {user?.role === "provider" ? (
                  <p className="mt-4 text-sm text-muted">Appointment requests are made from patient accounts.</p>
                ) : (
                  <ButtonLink href={`/providers/${provider.slug}/request`} className="mt-4 w-full" size="lg">
                    <CalendarPlus aria-hidden className="size-5" /> Request appointment
                  </ButtonLink>
                )}
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">
                {provider.accepting_new_patients
                  ? "This provider hasn't enabled online requests yet."
                  : "This provider isn't accepting new patients right now."}
              </p>
            )}
            {user?.role !== "provider" ? (
              <form action={toggleSaveProviderAction} className="mt-3">
                <input type="hidden" name="providerId" value={provider.id} />
                <input type="hidden" name="slug" value={provider.slug} />
                <input type="hidden" name="save" value={saved ? "0" : "1"} />
                <Button type="submit" variant="secondary" className="w-full" aria-pressed={saved}>
                  {saved ? <BookmarkCheck aria-hidden className="size-5 text-brand-700" /> : <Bookmark aria-hidden className="size-5" />}
                  {saved ? "Saved" : "Save provider"}
                </Button>
              </form>
            ) : null}
            <p className="mt-4 flex gap-2 text-xs text-muted">
              <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              Not for emergencies. If you need urgent help, call 911 or your local emergency number.
            </p>
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold text-ink">Details</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <Detail icon={<Monitor aria-hidden className="size-4" />} label="Care options">
                {[provider.offers_in_person && "In person", provider.offers_virtual && "Virtual"].filter(Boolean).join(" · ") || "Not specified"}
              </Detail>
              <Detail icon={<Languages aria-hidden className="size-4" />} label="Languages">
                {provider.languages.map((l) => LANGUAGES[l] ?? l).join(", ")}
              </Detail>
              <Detail icon={<Wallet aria-hidden className="size-4" />} label="Insurance & payment">
                {provider.payment_options.length ? provider.payment_options.map((p) => PAYMENT_OPTIONS[p] ?? p).join(", ") : "Contact the provider"}
                {provider.insurance_notes ? <span className="mt-1 block text-muted">{provider.insurance_notes}</span> : null}
              </Detail>
              {provider.clinic ? (
                <Detail icon={<Building2 aria-hidden className="size-4" />} label="Practice">
                  {provider.clinic.name}
                </Detail>
              ) : null}
              {provider.location_list.map((l) => (
                <Detail key={l.id} icon={<MapPin aria-hidden className="size-4" />} label={l.label ?? "Location"}>
                  {[l.address_line1, l.city, l.region, COUNTRIES[l.country] ?? l.country, l.postal_code].filter(Boolean).join(", ")}
                </Detail>
              ))}
              {tz ? (
                <Detail icon={<Clock aria-hidden className="size-4" />} label="Time zone">
                  {tz.replace("_", " ")}
                </Detail>
              ) : null}
            </dl>
          </Card>

          {user ? (
            <div className="flex justify-center">
              <ReportDialog action={reportAction} targetType="provider_profile" targetId={provider.id} label="Report this profile" />
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Detail({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-brand-700">{icon}</span>
      <div>
        <dt className="font-semibold text-ink">{label}</dt>
        <dd className="mt-0.5 text-ink/80">{children}</dd>
      </div>
    </div>
  );
}

function VerificationExplainer({ status, verifiedAt }: { status: string; verifiedAt: string | null }) {
  const text =
    status === "verified"
      ? `Kora staff confirmed this provider's license with the issuing regulator's public register${verifiedAt ? ` on ${new Date(verifiedAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}` : ""}. Verification confirms credentials — it is not a rating of clinical quality.`
      : "This provider has submitted credentials, but Kora has not finished verifying them yet. Confirm licensing details directly with the provider or the relevant regulator.";
  return (
    <p className="mt-6 rounded-2xl bg-canvas p-4 text-sm leading-relaxed text-muted">
      <span className="font-semibold text-ink">About verification: </span>
      {text}
    </p>
  );
}

function groupHours(hours: { weekday: number; start_time: string; end_time: string }[]) {
  const map = new Map<number, string[]>();
  for (const h of hours) {
    const list = map.get(h.weekday) ?? [];
    list.push(`${h.start_time}–${h.end_time}`);
    map.set(h.weekday, list);
  }
  return [...map.entries()].sort((a, b) => ((a[0] + 6) % 7) - ((b[0] + 6) % 7));
}
