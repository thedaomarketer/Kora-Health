import Link from "next/link";
import { Languages, MapPin, Monitor, Building2, CalendarCheck2 } from "lucide-react";
import { Badge, DemoBadge, VerificationBadge } from "@/components/ui/badge";
import { LANGUAGES } from "@/lib/constants";
import { providerFullName, type ProviderSummary } from "@/lib/directory";
import { cn } from "@/lib/cn";

export function ProviderInitials({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <div
      aria-hidden
      className={cn(
        "grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-100 to-clay-100 text-lg font-bold text-brand-800",
        className,
      )}
    >
      {initials}
    </div>
  );
}

export function ProviderCard({ provider, reason }: { provider: ProviderSummary; reason?: string[] }) {
  const name = providerFullName(provider);
  const location = provider.locations[0];
  const languages = provider.languages.map((l) => LANGUAGES[l] ?? l);
  return (
    <article className="group relative flex h-full flex-col rounded-[var(--radius-card)] bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-line/70 transition-shadow hover:shadow-[var(--shadow-lift)]">
      <div className="flex items-start gap-4">
        <ProviderInitials name={provider.display_name} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug text-ink">
            <Link href={`/providers/${provider.slug}`} className="after:absolute after:inset-0 after:rounded-[var(--radius-card)] focus-visible:outline-none">
              {name}
              {provider.post_nominals ? <span className="font-normal text-muted">, {provider.post_nominals}</span> : null}
            </Link>
          </h3>
          <p className="mt-0.5 text-sm text-muted">
            {provider.profession ?? "Healthcare professional"}
            {provider.pronouns ? ` · ${provider.pronouns}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <VerificationBadge status={provider.verification_status} verifiedAt={provider.verified_at} />
            {provider.is_demo ? <DemoBadge /> : null}
          </div>
        </div>
      </div>

      {provider.headline ? <p className="mt-4 line-clamp-2 text-sm text-ink/85">{provider.headline}</p> : null}

      {provider.specialties.length ? (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Specialties">
          {provider.specialties.slice(0, 3).map((s) => (
            <li key={s.slug}>
              <Badge tone="brand">{s.name}</Badge>
            </li>
          ))}
        </ul>
      ) : null}

      <dl className="mt-4 space-y-1.5 text-sm text-muted">
        {location ? (
          <div className="flex items-center gap-2">
            <dt className="sr-only">Location</dt>
            <MapPin aria-hidden className="size-4 shrink-0 text-brand-600" />
            <dd>
              {location.city}
              {location.region ? `, ${location.region}` : ""}
              {provider.distance_km !== null ? ` · ${Math.round(provider.distance_km)} km away` : ""}
            </dd>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <dt className="sr-only">Care options</dt>
          {provider.offers_virtual ? <Monitor aria-hidden className="size-4 shrink-0 text-brand-600" /> : <Building2 aria-hidden className="size-4 shrink-0 text-brand-600" />}
          <dd>{[provider.offers_in_person && "In person", provider.offers_virtual && "Virtual"].filter(Boolean).join(" · ") || "Contact for options"}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="sr-only">Languages</dt>
          <Languages aria-hidden className="size-4 shrink-0 text-brand-600" />
          <dd className="truncate">{languages.join(", ")}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="sr-only">Availability</dt>
          <CalendarCheck2 aria-hidden className="size-4 shrink-0 text-brand-600" />
          <dd>
            {!provider.accepting_new_patients
              ? "Not accepting new patients"
              : provider.has_availability
                ? "Accepting new patients · online requests"
                : "Accepting new patients"}
          </dd>
        </div>
      </dl>

      {reason?.length ? (
        <div className="mt-4 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
          <p className="font-semibold">Why this provider appears</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {reason.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
