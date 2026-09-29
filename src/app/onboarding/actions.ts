"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentActiveUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { syncConsents } from "@/lib/consents";
import { type ActionResult, failure } from "@/lib/errors";
import {
  careModality,
  countryCode,
  fieldErrors,
  formToObject,
  languageCode,
  optionalText,
  paymentOption,
  slugify,
} from "@/lib/validation";

const patientSchema = z.object({
  displayName: z.string().trim().min(2, "Enter your name.").max(120),
  pronouns: optionalText(40),
  city: optionalText(120),
  region: optionalText(120),
  country: z.union([countryCode, z.literal("")]).transform((v) => v || null),
  languages: z.array(languageCode).min(1, "Choose at least one language.").max(20),
  carePreference: careModality,
  payment: z.array(paymentOption).max(5),
  insuranceNote: optionalText(300),
  specialties: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(30),
  consentAi: z.literal("on").optional(),
  consentHealth: z.literal("on").optional(),
  consentMatching: z.literal("on").optional(),
  mode: z.enum(["onboarding", "settings"]),
});

export async function savePatientProfileAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await currentActiveUser("patient");
  if (!user) return { ok: false, error: "Please sign in with a patient account." };
  const parsed = patientSchema.safeParse(formToObject(fd, ["languages", "payment", "specialties"]));
  if (!parsed.success) {
    const errs = fieldErrors(parsed.error);
    return { ok: false, error: Object.values(errs)[0]?.[0] ?? "Please check the form.", fieldErrors: errs };
  }
  const d = parsed.data;
  try {
    await asUser(user, async (q) => {
      await q(`update public.users set display_name = $1 where id = auth.uid()`, [d.displayName]);
      await q(
        `update public.patient_profiles set pronouns = $1, city = $2, region = $3, country = $4, preferred_languages = $5,
                care_modality_preference = $6, payment_preferences = $7, insurance_note = $8,
                onboarding_completed_at = coalesce(onboarding_completed_at, now())
          where user_id = auth.uid()`,
        [d.pronouns, d.city, d.region, d.country, d.languages, d.carePreference, d.payment, d.insuranceNote],
      );
      await q(`delete from public.patient_specialty_interests where patient_id = auth.uid()`);
      if (d.specialties.length) {
        await q(
          `insert into public.patient_specialty_interests (patient_id, specialty_id)
           select auth.uid(), id from public.specialties where slug = any($1)`,
          [d.specialties],
        );
      }
      if (d.mode === "onboarding") {
        await syncConsents(q, {
          ai_assistant: Boolean(d.consentAi),
          health_data_storage: Boolean(d.consentHealth),
          matching_personalization: Boolean(d.consentMatching),
        });
      }
    });
  } catch (err) {
    return failure(err);
  }
  revalidatePath("/patient", "layout");
  if (d.mode === "onboarding") redirect("/patient?welcome=1");
  return { ok: true, message: "Your preferences have been saved." };
}

const providerSchema = z
  .object({
    displayName: z.string().trim().min(2, "Enter the name patients will see.").max(120),
    honorific: z.enum(["", "Dr.", "Prof."]).transform((v) => v || null),
    postNominals: optionalText(60),
    pronouns: optionalText(40),
    profession: z.string().regex(/^[a-z0-9-]+$/, "Choose your profession."),
    specialties: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1, "Choose at least one specialty.").max(8, "Choose up to 8 specialties."),
    primarySpecialty: z.string().regex(/^[a-z0-9-]+$/).optional(),
    headline: optionalText(160),
    bio: optionalText(3000),
    languages: z.array(languageCode).min(1, "Choose at least one language.").max(20),
    offersVirtual: z.literal("on").optional(),
    offersInPerson: z.literal("on").optional(),
    accepting: z.literal("on").optional(),
    payment: z.array(paymentOption).max(5),
    insuranceNotes: optionalText(500),
    city: optionalText(120),
    region: optionalText(120),
    country: z.union([countryCode, z.literal("")]).transform((v) => v || null),
    address: optionalText(200),
    postalCode: optionalText(20),
    mode: z.enum(["onboarding", "settings"]),
  })
  .refine((v) => v.offersVirtual || v.offersInPerson, { message: "Choose virtual care, in-person care, or both.", path: ["offersVirtual"] })
  .refine((v) => !v.offersInPerson || (v.city && v.country) || v.mode === "settings", {
    message: "Add the city and country where you see patients in person.",
    path: ["city"],
  });

export async function saveProviderProfileAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await currentActiveUser("provider");
  if (!user) return { ok: false, error: "Please sign in with a provider account." };
  const parsed = providerSchema.safeParse(formToObject(fd, ["specialties", "languages", "payment"]));
  if (!parsed.success) {
    const errs = fieldErrors(parsed.error);
    return { ok: false, error: Object.values(errs)[0]?.[0] ?? "Please check the form.", fieldErrors: errs };
  }
  const d = parsed.data;
  try {
    await asUser(user, async (q) => {
      let [profile] = await q<{ id: string }>(`select id from public.provider_profiles where user_id = auth.uid()`);
      if (!profile) {
        const slug = `${slugify(d.displayName) || "provider"}-${randomBytes(3).toString("hex")}`;
        [profile] = await q<{ id: string }>(`select public.create_provider_profile($1, $2) as id`, [d.displayName, slug]);
      }
      const [prof] = await q<{ id: number }>(`select id from public.professions where slug = $1`, [d.profession]);
      if (!prof) throw Object.assign(new Error("Choose your profession."), { code: "22023" });
      await q(
        `update public.provider_profiles set display_name = $1, honorific = $2, post_nominals = $3, pronouns = $4,
                profession_id = $5, headline = $6, bio = $7, languages = $8, offers_virtual = $9, offers_in_person = $10,
                accepting_new_patients = $11, payment_options = $12, insurance_notes = $13
          where id = $14`,
        [d.displayName, d.honorific, d.postNominals, d.pronouns, prof.id, d.headline, d.bio, d.languages,
          Boolean(d.offersVirtual), Boolean(d.offersInPerson), Boolean(d.accepting), d.payment, d.insuranceNotes, profile.id],
      );
      await q(`update public.users set display_name = $1 where id = auth.uid()`, [d.displayName]);
      await q(`delete from public.provider_specialties where provider_id = $1`, [profile.id]);
      await q(
        `insert into public.provider_specialties (provider_id, specialty_id, is_primary)
         select $1, id, slug = coalesce($3, $2[1]) from public.specialties where slug = any($2)`,
        [profile.id, d.specialties, d.primarySpecialty ?? null],
      );
      if (d.mode === "onboarding" && d.city && d.country) {
        const [existing] = await q(`select id from public.locations where provider_id = $1 limit 1`, [profile.id]);
        if (!existing) {
          await q(
            `insert into public.locations (provider_id, label, address_line1, city, region, country, postal_code)
             values ($1, 'Main practice', $2, $3, $4, $5, $6)`,
            [profile.id, d.address, d.city, d.region, d.country, d.postalCode],
          );
        }
      }
      if (d.mode === "onboarding") {
        await q(`update public.provider_profiles set onboarding_completed_at = coalesce(onboarding_completed_at, now()) where id = $1`, [profile.id]);
      }
    });
  } catch (err) {
    return failure(err);
  }
  revalidatePath("/provider", "layout");
  if (d.mode === "onboarding") redirect("/provider?welcome=1");
  return { ok: true, message: "Profile saved." };
}
