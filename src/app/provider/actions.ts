"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentActiveUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { type ActionResult, failure } from "@/lib/errors";
import { careModality, countryCode, fieldErrors, formToObject, httpsUrl, optionalText, uuid } from "@/lib/validation";

async function provider() {
  const user = await currentActiveUser("provider");
  if (!user) throw Object.assign(new Error("Please sign in with a provider account."), { code: "42501" });
  return user;
}

function invalid(error: z.ZodError): ActionResult {
  const errs = fieldErrors(error);
  return { ok: false, error: Object.values(errs)[0]?.[0] ?? "Please check the form.", fieldErrors: errs };
}

const revalidateProvider = () => revalidatePath("/provider", "layout");

// -------------------------------------------------------------------- publish
export async function setPublishedAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    const user = await provider();
    const publish = fd.get("publish") === "1";
    await asUser(user, (q) => q(`update public.provider_profiles set is_published = $1 where user_id = auth.uid()`, [publish]));
    revalidateProvider();
    return { ok: true, message: publish ? "Your profile is published." : "Your profile is hidden from the directory." };
  } catch (err) {
    return failure(err);
  }
}

// ------------------------------------------------------------------- services
const serviceSchema = z.object({
  id: z.union([uuid, z.literal("")]).optional(),
  name: z.string().trim().min(2, "Enter a service name.").max(120),
  description: optionalText(1000),
  modality: careModality,
  duration: z.coerce.number().int().min(10, "Minimum 10 minutes.").max(240, "Maximum 240 minutes."),
  feeNote: optionalText(200),
});

export async function saveServiceAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = serviceSchema.safeParse(formToObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  try {
    const user = await provider();
    await asUser(user, (q) =>
      d.id
        ? q(`update public.services set name = $1, description = $2, modality = $3, duration_minutes = $4, fee_note = $5 where id = $6`, [d.name, d.description, d.modality, d.duration, d.feeNote, d.id])
        : q(`insert into public.services (provider_id, name, description, modality, duration_minutes, fee_note)
             values (public.current_provider_id(), $1, $2, $3, $4, $5)`, [d.name, d.description, d.modality, d.duration, d.feeNote]),
    );
    revalidateProvider();
    return { ok: true, message: "Service saved." };
  } catch (err) {
    return failure(err);
  }
}

export async function deleteServiceAction(fd: FormData) {
  const user = await provider();
  const id = uuid.parse(fd.get("id"));
  await asUser(user, (q) => q(`update public.services set is_active = false where id = $1`, [id]));
  revalidateProvider();
}

// ------------------------------------------------------------------ locations
const locationSchema = z.object({
  id: z.union([uuid, z.literal("")]).optional(),
  label: optionalText(120),
  address: optionalText(200),
  city: z.string().trim().min(1, "Enter a city.").max(120),
  region: optionalText(120),
  country: countryCode,
  postalCode: optionalText(20),
});

export async function saveLocationAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = locationSchema.safeParse(formToObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  try {
    const user = await provider();
    await asUser(user, (q) =>
      d.id
        ? q(`update public.locations set label = $1, address_line1 = $2, city = $3, region = $4, country = $5, postal_code = $6 where id = $7`, [d.label, d.address, d.city, d.region, d.country, d.postalCode, d.id])
        : q(`insert into public.locations (provider_id, label, address_line1, city, region, country, postal_code)
             values (public.current_provider_id(), $1, $2, $3, $4, $5, $6)`, [d.label, d.address, d.city, d.region, d.country, d.postalCode]),
    );
    revalidateProvider();
    return { ok: true, message: "Location saved." };
  } catch (err) {
    return failure(err);
  }
}

export async function deleteLocationAction(fd: FormData) {
  const user = await provider();
  const id = uuid.parse(fd.get("id"));
  await asUser(user, (q) => q(`delete from public.locations where id = $1`, [id]));
  revalidateProvider();
}

// --------------------------------------------------------------- availability
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM.");
const availabilitySchema = z
  .object({
    weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1, "Choose at least one day."),
    start: time,
    end: time,
    timezone: z.string().min(3).max(64),
    modality: careModality,
    locationId: z.union([uuid, z.literal("")]).transform((v) => v || null),
  })
  .refine((v) => v.end > v.start, { message: "End time must be after start time.", path: ["end"] });

export async function addAvailabilityAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = availabilitySchema.safeParse(formToObject(fd, ["weekdays"]));
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  try {
    const user = await provider();
    await asUser(user, async (q) => {
      for (const day of d.weekdays) {
        const overlap = await q(
          `select 1 from public.availability where provider_id = public.current_provider_id() and weekday = $1 and start_time < $3::time and end_time > $2::time`,
          [day, d.start, d.end],
        );
        if (overlap.length) throw Object.assign(new Error("these hours overlap hours you've already added"), { code: "22023" });
        await q(
          `insert into public.availability (provider_id, weekday, start_time, end_time, timezone, modality, location_id)
           values (public.current_provider_id(), $1, $2, $3, $4, $5, $6)`,
          [day, d.start, d.end, d.timezone, d.modality, d.locationId],
        );
      }
    });
    revalidateProvider();
    return { ok: true, message: "Availability added." };
  } catch (err) {
    return failure(err);
  }
}

export async function deleteAvailabilityAction(fd: FormData) {
  const user = await provider();
  const id = uuid.parse(fd.get("id"));
  await asUser(user, (q) => q(`delete from public.availability where id = $1`, [id]));
  revalidateProvider();
}

// --------------------------------------------------------------- credentials
const credentialSchema = z.object({
  type: z.enum(["license", "registration", "certification", "degree"]),
  issuingBody: z.string().trim().min(2, "Enter the issuing regulator or body.").max(200),
  jurisdiction: z.string().trim().min(2, "Enter the jurisdiction.").max(120),
  number: optionalText(80),
  expiresOn: z.union([z.iso.date(), z.literal("")]).transform((v) => v || null),
});

export async function addCredentialAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = credentialSchema.safeParse(formToObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  try {
    const user = await provider();
    await asUser(user, (q) =>
      q(`insert into public.provider_credentials (provider_id, credential_type, issuing_body, jurisdiction, credential_number, expires_on)
         values (public.current_provider_id(), $1, $2, $3, $4, $5)`, [d.type, d.issuingBody, d.jurisdiction, d.number, d.expiresOn]),
    );
    revalidateProvider();
    return { ok: true, message: "Credential added." };
  } catch (err) {
    return failure(err);
  }
}

export async function deleteCredentialAction(fd: FormData) {
  const user = await provider();
  const id = uuid.parse(fd.get("id"));
  await asUser(user, (q) => q(`delete from public.provider_credentials where id = $1`, [id]));
  revalidateProvider();
}

export async function submitVerificationAction(_prev: ActionResult | null): Promise<ActionResult> {
  try {
    const user = await provider();
    await asUser(user, (q) => q(`select public.submit_provider_verification()`));
  } catch (err) {
    return failure(err);
  }
  revalidateProvider();
  redirect("/provider/verification?submitted=1");
}

// --------------------------------------------------------------- appointments
const respondSchema = z.object({
  requestId: uuid,
  decision: z.enum(["accept", "decline"]),
  message: optionalText(1000),
  locationId: z.union([uuid, z.literal("")]).optional().transform((v) => v || null),
  visitUrl: httpsUrl.optional().transform((v) => v || null),
});

export async function respondToRequestAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = respondSchema.safeParse(formToObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  try {
    const user = await provider();
    await asUser(user, (q) =>
      q(`select public.respond_to_appointment_request($1, $2, $3, $4, $5)`, [d.requestId, d.decision === "accept", d.message, d.locationId, d.visitUrl]),
    );
  } catch (err) {
    return failure(err);
  }
  revalidateProvider();
  redirect(`/provider/appointments?updated=${d.decision === "accept" ? "confirmed" : "declined"}`);
}

const updateSchema = z.object({
  appointmentId: uuid,
  status: z.enum(["", "completed", "no_show"]).transform((v) => v || null),
  visitUrl: httpsUrl.optional().transform((v) => v ?? null),
  instructions: optionalText(1000),
});

export async function updateAppointmentAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(formToObject(fd));
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  try {
    const user = await provider();
    await asUser(user, (q) => q(`select public.provider_update_appointment($1, $2, $3, $4)`, [d.appointmentId, d.status, d.visitUrl, d.instructions]));
    revalidateProvider();
    return { ok: true, message: "Appointment updated." };
  } catch (err) {
    return failure(err);
  }
}
