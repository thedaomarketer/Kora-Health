import "server-only";
import type { SessionUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { loadProviderDetail, type ProviderDetail } from "@/lib/directory";

export interface PatientProfile {
  display_name: string;
  pronouns: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  preferred_languages: string[];
  care_modality_preference: "virtual" | "in_person" | "both";
  payment_preferences: string[];
  insurance_note: string | null;
  onboarding_completed_at: string | null;
  specialty_interests: string[];
}

export async function getPatientProfile(user: SessionUser): Promise<PatientProfile | null> {
  const rows = await asUser(user, (q) =>
    q<PatientProfile>(
      `select u.display_name, p.pronouns, p.city, p.region, p.country, p.preferred_languages, p.care_modality_preference,
              p.payment_preferences, p.insurance_note, p.onboarding_completed_at,
              coalesce((select array_agg(s.slug) from public.patient_specialty_interests i
                        join public.specialties s on s.id = i.specialty_id where i.patient_id = p.user_id), '{}') as specialty_interests
         from public.patient_profiles p join public.users u on u.id = p.user_id
        where p.user_id = auth.uid()`,
    ),
  );
  return rows[0] ?? null;
}

export async function getConsents(user: SessionUser) {
  const rows = await asUser(user, (q) =>
    q<{ consent_type: string; granted: boolean; version: string; created_at: string }>(
      `select consent_type, granted, version, created_at from public.current_consents where user_id = auth.uid()`,
    ),
  );
  return Object.fromEntries(rows.map((r) => [r.consent_type, r])) as Record<string, (typeof rows)[number] | undefined>;
}

export interface OwnProviderProfile extends ProviderDetail {
  is_published: boolean;
  onboarding_completed_at: string | null;
  profession_id: number | null;
}

/** The signed-in provider's own profile (visible to them regardless of publish state). */
export async function getOwnProviderProfile(user: SessionUser): Promise<OwnProviderProfile | null> {
  return asUser(user, async (q) => {
    const detail = await loadProviderDetail(q, "p.user_id = auth.uid() and $1::text is not null", "own");
    if (!detail) return null;
    const [extra] = await q<{ is_published: boolean; onboarding_completed_at: string | null; profession_id: number | null }>(
      `select is_published, onboarding_completed_at, profession_id from public.provider_profiles where user_id = auth.uid()`,
    );
    return { ...detail, ...extra };
  });
}
