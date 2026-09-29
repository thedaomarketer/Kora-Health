import type { Metadata } from "next";
import Link from "next/link";
import { SearchX, SlidersHorizontal, X } from "lucide-react";
import { ProviderCard } from "@/components/directory/provider-card";
import { UseLocationButton } from "@/components/directory/use-location-button";
import { Alert, EmptyState, NotConfigured } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { Checkbox, Select } from "@/components/ui/form";
import { COUNTRIES, LANGUAGES, PAYMENT_OPTIONS } from "@/lib/constants";
import { getReferenceData, parseSearchParams, searchProviders, type SearchParams } from "@/lib/directory";
import { features } from "@/lib/env";

export const metadata: Metadata = {
  title: "Find a healthcare provider",
  description: "Search healthcare professionals by specialty, location, language, virtual or in-person care, and verification status.",
};

const FORM_ID = "provider-search";

export default async function ProvidersPage({ searchParams }: PageProps<"/providers">) {
  const params = parseSearchParams(await searchParams);
  if (!features.database) {
    return (
      <div className="container-page py-12">
        <NotConfigured feature="The provider directory" />
      </div>
    );
  }
  const [ref, results] = await Promise.all([getReferenceData(), searchProviders(params)]);
  const totalPages = Math.max(1, Math.ceil(results.total / results.pageSize));
  const activeFilters = describeFilters(params, ref);
  const hasGeo = params.lat !== undefined && params.lng !== undefined;

  return (
    <div className="container-page py-10 sm:py-12">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Find a healthcare provider</h1>
        <p className="mt-3 text-muted">
          Search by what matters to you. Profiles show whether Kora has verified a provider&apos;s license — verification
          confirms credentials, not clinical quality.
        </p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[18rem_1fr]">
        {/* Filters */}
        <aside aria-labelledby="filters-title">
          <details className="group rounded-3xl bg-white p-5 ring-1 ring-line/80 lg:open:block" open>
            <summary className="flex cursor-pointer list-none items-center justify-between lg:cursor-default lg:pointer-events-none [&::-webkit-details-marker]:hidden">
              <h2 id="filters-title" className="flex items-center gap-2 font-semibold text-ink">
                <SlidersHorizontal aria-hidden className="size-4" /> Filters
              </h2>
              <span className="text-sm text-brand-700 lg:hidden">Show / hide</span>
            </summary>
            <form id={FORM_ID} action="/providers" method="get" className="mt-5 space-y-5">
              <div>
                <label htmlFor="f-q" className="block text-sm font-semibold text-ink">Keyword</label>
                <input
                  id="f-q"
                  name="q"
                  defaultValue={params.q}
                  placeholder="Name, service or concern"
                  className="mt-1.5 block min-h-11 w-full rounded-xl border-0 px-3.5 ring-1 ring-inset ring-line placeholder:text-stone-500 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <FilterSelect id="f-specialty" name="specialty" label="Specialty" value={params.specialty} options={ref.specialties.map((s) => [s.slug, s.name])} anyLabel="Any specialty" />
              <FilterSelect id="f-profession" name="profession" label="Profession" value={params.profession} options={ref.professions.map((p) => [p.slug, p.name])} anyLabel="Any profession" />
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-ink">Location</legend>
                <label htmlFor="f-city" className="sr-only">City</label>
                <input
                  id="f-city"
                  name="city"
                  defaultValue={params.city}
                  placeholder="City"
                  autoComplete="address-level2"
                  className="block min-h-11 w-full rounded-xl border-0 px-3.5 ring-1 ring-inset ring-line placeholder:text-stone-500 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
                <label htmlFor="f-country" className="sr-only">Country</label>
                <Select id="f-country" name="country" defaultValue={params.country ?? ""}>
                  <option value="">Any country</option>
                  {Object.entries(COUNTRIES).map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </Select>
                <UseLocationButton formId={FORM_ID} />
                {hasGeo ? (
                  <>
                    <input type="hidden" name="lat" value={params.lat} />
                    <input type="hidden" name="lng" value={params.lng} />
                  </>
                ) : null}
                <label htmlFor="f-radius" className="block pt-1 text-sm font-medium text-ink">Distance</label>
                <Select id="f-radius" name="radius" defaultValue={params.radius ? String(params.radius) : ""}>
                  <option value="">Any distance</option>
                  {[10, 25, 50, 100, 250].map((r) => (
                    <option key={r} value={r}>Within {r} km</option>
                  ))}
                </Select>
                {!hasGeo ? <p className="text-xs text-muted">Distance needs your location.</p> : null}
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-ink">Type of care</legend>
                {[
                  ["", "Any"],
                  ["virtual", "Virtual care"],
                  ["in_person", "In-person care"],
                ].map(([value, label]) => (
                  <label key={value} className="flex min-h-9 items-center gap-3 text-sm">
                    <input type="radio" name="care" value={value} defaultChecked={(params.care ?? "") === value} className="size-4 accent-brand-700" />
                    {label}
                  </label>
                ))}
              </fieldset>
              <FilterSelect id="f-language" name="language" label="Language" value={params.language} options={Object.entries(LANGUAGES)} anyLabel="Any language" />
              <FilterSelect id="f-payment" name="payment" label="Insurance & payment" value={params.payment} options={Object.entries(PAYMENT_OPTIONS)} anyLabel="Any option" />
              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-ink">Availability & trust</legend>
                <Checkbox name="accepting" value="1" defaultChecked={Boolean(params.accepting)} label="Accepting new patients" />
                <Checkbox name="available" value="1" defaultChecked={Boolean(params.available)} label="Accepts online appointment requests" />
                <Checkbox name="verified" value="1" defaultChecked={Boolean(params.verified)} label="License verified by Kora" />
              </fieldset>
              <div className="flex gap-2 pt-1">
                <button type="submit" className={buttonClasses("primary", "md", "flex-1")}>Apply filters</button>
                <Link href="/providers" className={buttonClasses("ghost", "md")}>Reset</Link>
              </div>
            </form>
          </details>
        </aside>

        {/* Results */}
        <section aria-labelledby="results-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="results-title" className="text-lg font-semibold text-ink" aria-live="polite">
              {results.total === 1 ? "1 provider" : `${results.total} providers`}
            </h2>
            <p className="text-sm text-muted">
              Sorted by {hasGeo ? "distance" : "verification status, then availability for new patients, then name"}.
            </p>
          </div>

          {activeFilters.length ? (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Active filters">
              {activeFilters.map((f) => (
                <li key={f.key}>
                  <Link
                    href={withoutParam(params, f.key)}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-brand-50 px-3 text-sm font-medium text-brand-800 ring-1 ring-brand-200 hover:bg-brand-100"
                  >
                    {f.label}
                    <X aria-hidden className="size-3.5" />
                    <span className="sr-only">(remove filter)</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          {results.providers.some((p) => p.is_demo) ? (
            <Alert tone="info" className="mt-5">
              Development environment: profiles marked &ldquo;Sample profile&rdquo; are fictional test data.
            </Alert>
          ) : null}

          {results.providers.length ? (
            <ul className="mt-6 grid gap-5 md:grid-cols-2">
              {results.providers.map((p) => (
                <li key={p.id}>
                  <ProviderCard provider={p} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-6">
              <EmptyState
                icon={<SearchX aria-hidden className="size-6" />}
                title="No providers match these filters"
                description="Try removing a filter, searching a nearby city, or including virtual care."
                action={<Link href="/providers" className={buttonClasses("secondary", "sm")}>Clear all filters</Link>}
              />
            </div>
          )}

          {totalPages > 1 ? (
            <nav aria-label="Pagination" className="mt-8 flex items-center justify-between gap-4">
              {results.page > 1 ? (
                <Link href={withParam(params, "page", String(results.page - 1))} className={buttonClasses("secondary", "sm")}>Previous</Link>
              ) : <span />}
              <p className="text-sm text-muted">Page {results.page} of {totalPages}</p>
              {results.page < totalPages ? (
                <Link href={withParam(params, "page", String(results.page + 1))} className={buttonClasses("secondary", "sm")}>Next</Link>
              ) : <span />}
            </nav>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function FilterSelect({ id, name, label, value, options, anyLabel }: { id: string; name: string; label: string; value?: string; options: [string, string][]; anyLabel: string }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-ink">{label}</label>
      <Select id={id} name={name} defaultValue={value ?? ""} className="mt-1.5">
        <option value="">{anyLabel}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </Select>
    </div>
  );
}

function toQuery(params: SearchParams) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  return qs;
}

function withParam(params: SearchParams, key: string, value: string) {
  const qs = toQuery(params);
  qs.set(key, value);
  return `/providers?${qs}`;
}

function withoutParam(params: SearchParams, key: string) {
  const qs = toQuery(params);
  qs.delete(key);
  qs.delete("page");
  if (key === "lat") {
    qs.delete("lng");
    qs.delete("radius");
  }
  const s = qs.toString();
  return s ? `/providers?${s}` : "/providers";
}

function describeFilters(params: SearchParams, ref: Awaited<ReturnType<typeof getReferenceData>>) {
  const out: { key: string; label: string }[] = [];
  if (params.q) out.push({ key: "q", label: `“${params.q}”` });
  if (params.specialty) out.push({ key: "specialty", label: ref.specialties.find((s) => s.slug === params.specialty)?.name ?? params.specialty });
  if (params.profession) out.push({ key: "profession", label: ref.professions.find((p) => p.slug === params.profession)?.name ?? params.profession });
  if (params.city) out.push({ key: "city", label: params.city });
  if (params.country) out.push({ key: "country", label: COUNTRIES[params.country] ?? params.country });
  if (params.care) out.push({ key: "care", label: params.care === "virtual" ? "Virtual care" : "In-person care" });
  if (params.language) out.push({ key: "language", label: LANGUAGES[params.language] ?? params.language });
  if (params.payment) out.push({ key: "payment", label: PAYMENT_OPTIONS[params.payment] ?? params.payment });
  if (params.accepting) out.push({ key: "accepting", label: "Accepting new patients" });
  if (params.available) out.push({ key: "available", label: "Online requests" });
  if (params.verified) out.push({ key: "verified", label: "License verified" });
  if (params.lat !== undefined) out.push({ key: "lat", label: params.radius ? `Within ${params.radius} km of you` : "Near you" });
  return out;
}
