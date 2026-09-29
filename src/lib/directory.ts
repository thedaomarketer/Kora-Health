import "server-only";
import { z } from "zod";
import { asAnon, type Query } from "@/lib/db";
import { showDemoData } from "@/lib/env";
import type { VerificationStatus } from "@/components/ui/badge";

export interface ProviderSummary {
  id: string;
  slug: string;
  display_name: string;
  honorific: string | null;
  post_nominals: string | null;
  pronouns: string | null;
  headline: string | null;
  profession: string | null;
  profession_slug: string | null;
  languages: string[];
  offers_virtual: boolean;
  offers_in_person: boolean;
  accepting_new_patients: boolean;
  payment_options: string[];
  verification_status: VerificationStatus;
  verified_at: string | null;
  is_demo: boolean;
  specialties: { slug: string; name: string; primary: boolean }[];
  locations: { city: string; region: string | null; country: string }[];
  services: string[];
  has_availability: boolean;
  distance_km: number | null;
}

export const searchSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  specialty: z.string().regex(/^[a-z0-9-]+$/).max(60).optional().catch(undefined),
  profession: z.string().regex(/^[a-z0-9-]+$/).max(60).optional().catch(undefined),
  city: z.string().trim().max(80).optional().catch(undefined),
  country: z.string().regex(/^[A-Z]{2}$/).optional().catch(undefined),
  care: z.enum(["virtual", "in_person"]).optional().catch(undefined),
  language: z.string().regex(/^[a-z]{2,3}$/).optional().catch(undefined),
  payment: z.string().regex(/^[a-z_]+$/).max(40).optional().catch(undefined),
  accepting: z.literal("1").optional().catch(undefined),
  verified: z.literal("1").optional().catch(undefined),
  available: z.literal("1").optional().catch(undefined),
  lat: z.coerce.number().min(-90).max(90).optional().catch(undefined),
  lng: z.coerce.number().min(-180).max(180).optional().catch(undefined),
  radius: z.coerce.number().int().min(5).max(500).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(100).optional().catch(undefined),
});

export type SearchParams = z.infer<typeof searchSchema>;

export function parseSearchParams(raw: Record<string, string | string[] | undefined>): SearchParams {
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) flat[k] = Array.isArray(v) ? v[0] : v;
  return searchSchema.parse(flat);
}

const PAGE_SIZE = 12;

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const SUMMARY_COLUMNS = `
  p.id, p.slug, p.display_name, p.honorific, p.post_nominals, p.pronouns, p.headline,
  pr.name as profession, pr.slug as profession_slug, p.languages, p.offers_virtual, p.offers_in_person,
  p.accepting_new_patients, p.payment_options, p.verification_status, p.verified_at, p.is_demo,
  coalesce((select json_agg(json_build_object('slug', s.slug, 'name', s.name, 'primary', ps.is_primary)
                            order by ps.is_primary desc, s.sort_order)
            from public.provider_specialties ps join public.specialties s on s.id = ps.specialty_id
            where ps.provider_id = p.id), '[]') as specialties,
  coalesce((select json_agg(json_build_object('city', l.city, 'region', l.region, 'country', l.country))
            from public.locations l where l.provider_id = p.id), '[]') as locations,
  coalesce((select json_agg(distinct sv.name) from public.services sv
            where sv.provider_id = p.id and sv.is_active), '[]') as services,
  exists (select 1 from public.availability a where a.provider_id = p.id) as has_availability`;

/** Search the public directory. RLS (as anon) guarantees only public profiles are returned. */
export async function searchProviders(params: SearchParams) {
  const where: string[] = [];
  const values: unknown[] = [];
  const add = (v: unknown) => {
    values.push(v);
    return `$${values.length}`;
  };

  if (!showDemoData) where.push("not p.is_demo");
  if (params.q) {
    const term = add(`%${escapeLike(params.q)}%`);
    where.push(`(p.display_name ilike ${term} or p.headline ilike ${term} or pr.name ilike ${term}
      or exists (select 1 from public.provider_specialties ps join public.specialties s on s.id = ps.specialty_id
                 where ps.provider_id = p.id and (s.name ilike ${term} or s.description ilike ${term}))
      or exists (select 1 from public.services sv where sv.provider_id = p.id and sv.is_active and sv.name ilike ${term}))`);
  }
  if (params.specialty) {
    where.push(`exists (select 1 from public.provider_specialties ps join public.specialties s on s.id = ps.specialty_id
                        where ps.provider_id = p.id and s.slug = ${add(params.specialty)})`);
  }
  if (params.profession) where.push(`pr.slug = ${add(params.profession)}`);
  if (params.city) {
    where.push(`exists (select 1 from public.locations l where l.provider_id = p.id and lower(l.city) = lower(${add(params.city)}))`);
  }
  if (params.country) {
    where.push(`exists (select 1 from public.locations l where l.provider_id = p.id and l.country = ${add(params.country)})`);
  }
  if (params.care === "virtual") where.push("p.offers_virtual");
  if (params.care === "in_person") where.push("p.offers_in_person");
  if (params.language) where.push(`${add(params.language)} = any(p.languages)`);
  if (params.payment) where.push(`${add(params.payment)} = any(p.payment_options)`);
  if (params.accepting) where.push("p.accepting_new_patients");
  if (params.verified) where.push("p.verification_status = 'verified'");
  if (params.available) where.push("exists (select 1 from public.availability a where a.provider_id = p.id)");

  let distanceExpr = "null::float8";
  const hasGeo = params.lat !== undefined && params.lng !== undefined;
  if (hasGeo) {
    const lat = add(params.lat);
    const lng = add(params.lng);
    distanceExpr = `(select min(6371 * 2 * asin(sqrt(
        power(sin(radians(l.latitude - ${lat}::float8) / 2), 2) +
        cos(radians(${lat}::float8)) * cos(radians(l.latitude)) *
        power(sin(radians(l.longitude - ${lng}::float8) / 2), 2))))
      from public.locations l where l.provider_id = p.id and l.latitude is not null)`;
  }

  const page = params.page ?? 1;
  const whereSql = where.length ? `where ${where.join(" and ")}` : "";
  const radiusFilter = hasGeo && params.radius ? `where (distance_km <= ${add(params.radius)} or (distance_km is null and offers_virtual))` : "";
  const orderBy = hasGeo
    ? "distance_km asc nulls last, display_name"
    : "(verification_status = 'verified') desc, accepting_new_patients desc, display_name";

  const sql = `
    with results as (
      select ${SUMMARY_COLUMNS}, ${distanceExpr} as distance_km
      from public.provider_profiles p
      left join public.professions pr on pr.id = p.profession_id
      ${whereSql}
    )
    select *, count(*) over () as total from results
    ${radiusFilter}
    order by ${orderBy}
    limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`;

  const rows = await asAnon((q) => q<ProviderSummary & { total: string }>(sql, values));
  return {
    providers: rows.map(({ total: _total, ...r }) => ({ ...r, distance_km: r.distance_km === null ? null : Number(r.distance_km) })),
    total: rows[0] ? Number(rows[0].total) : 0,
    page,
    pageSize: PAGE_SIZE,
  };
}

export interface ReferenceData {
  specialties: { slug: string; name: string; description: string }[];
  professions: { slug: string; name: string }[];
}

export async function getReferenceData(): Promise<ReferenceData> {
  return asAnon(async (q) => ({
    specialties: await q(`select slug, name, description from public.specialties order by sort_order, name`),
    professions: await q(`select slug, name from public.professions order by sort_order, name`),
  })) as Promise<ReferenceData>;
}

export interface ProviderDetail extends ProviderSummary {
  bio: string | null;
  insurance_notes: string | null;
  clinic: { name: string; website: string | null; phone: string | null } | null;
  service_list: { id: string; name: string; description: string | null; modality: "virtual" | "in_person" | "both"; duration_minutes: number; fee_note: string | null }[];
  location_list: { id: string; label: string | null; address_line1: string | null; city: string; region: string | null; country: string; postal_code: string | null }[];
  weekly_hours: { weekday: number; start_time: string; end_time: string; timezone: string; modality: string }[];
}

export async function loadProviderDetail(q: Query, where: string, value: string): Promise<ProviderDetail | null> {
  const rows = await q<ProviderDetail>(
    `select ${SUMMARY_COLUMNS}, null::float8 as distance_km, p.bio, p.insurance_notes,
       (select json_build_object('name', c.name, 'website', c.website, 'phone', c.phone) from public.clinics c where c.id = p.clinic_id) as clinic,
       coalesce((select json_agg(json_build_object('id', sv.id, 'name', sv.name, 'description', sv.description, 'modality', sv.modality,
                  'duration_minutes', sv.duration_minutes, 'fee_note', sv.fee_note) order by sv.name)
                 from public.services sv where sv.provider_id = p.id and sv.is_active), '[]') as service_list,
       coalesce((select json_agg(json_build_object('id', l.id, 'label', l.label, 'address_line1', l.address_line1, 'city', l.city,
                  'region', l.region, 'country', l.country, 'postal_code', l.postal_code))
                 from public.locations l where l.provider_id = p.id), '[]') as location_list,
       coalesce((select json_agg(json_build_object('weekday', a.weekday, 'start_time', to_char(a.start_time, 'HH24:MI'),
                  'end_time', to_char(a.end_time, 'HH24:MI'), 'timezone', a.timezone, 'modality', a.modality)
                  order by a.weekday, a.start_time)
                 from public.availability a where a.provider_id = p.id), '[]') as weekly_hours
     from public.provider_profiles p
     left join public.professions pr on pr.id = p.profession_id
     where ${where} ${showDemoData ? "" : "and not p.is_demo"}`,
    [value],
  );
  return rows[0] ?? null;
}

export async function getPublicProvider(slug: string) {
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) return null;
  return asAnon((q) => loadProviderDetail(q, "p.slug = $1", slug));
}

export async function getOpenSlots(providerId: string, durationMinutes: number, days = 14) {
  return asAnon((q) =>
    q<{ starts_at: string; ends_at: string; modality: "virtual" | "in_person" | "both" }>(
      `select starts_at, ends_at, modality from public.provider_open_slots($1, $2, $3)`,
      [providerId, durationMinutes, days],
    ),
  );
}

export function providerFullName(p: Pick<ProviderSummary, "honorific" | "display_name">) {
  return [p.honorific, p.display_name].filter(Boolean).join(" ");
}
