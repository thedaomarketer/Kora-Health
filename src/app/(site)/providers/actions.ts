"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentActiveUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { type ActionResult, failure } from "@/lib/errors";
import { fieldErrors, formToObject, optionalText, uuid, visitModality } from "@/lib/validation";

export async function toggleSaveProviderAction(fd: FormData) {
  const user = await currentActiveUser("patient");
  const parsed = z.object({ providerId: uuid, slug: z.string().max(80), save: z.enum(["1", "0"]) }).safeParse(formToObject(fd));
  if (!parsed.success) return;
  if (!user) redirect(`/sign-in?next=/providers/${encodeURIComponent(parsed.data.slug)}`);
  await asUser(user, (q) =>
    parsed.data.save === "1"
      ? q(`insert into public.saved_providers (patient_id, provider_id) values (auth.uid(), $1) on conflict do nothing`, [parsed.data.providerId])
      : q(`delete from public.saved_providers where patient_id = auth.uid() and provider_id = $1`, [parsed.data.providerId]),
  );
  revalidatePath(`/providers/${parsed.data.slug}`);
  revalidatePath("/patient/saved");
}

const reportSchema = z.object({
  targetType: z.enum(["provider_profile", "message", "conversation"]),
  targetId: uuid,
  reason: z.enum(["inaccurate_information", "impersonation", "harassment", "spam", "inappropriate_content", "safety_concern", "privacy_concern", "other"]),
  details: optionalText(2000),
});

export async function reportAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await currentActiveUser();
  if (!user) return { ok: false, error: "Please sign in to report." };
  const parsed = reportSchema.safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, error: "Choose a reason for your report.", fieldErrors: fieldErrors(parsed.error) };
  try {
    await asUser(user, (q) =>
      q(`insert into public.reports (target_type, target_id, reason, details) values ($1, $2, $3, $4)`, [
        parsed.data.targetType,
        parsed.data.targetId,
        parsed.data.reason,
        parsed.data.details,
      ]),
    );
    return { ok: true, message: "Thank you. Our trust and safety team will review your report." };
  } catch (err) {
    return failure(err);
  }
}

const requestSchema = z.object({
  providerId: uuid,
  serviceId: z.union([uuid, z.literal("")]).transform((v) => v || null),
  modality: visitModality,
  slot: z.iso.datetime({ offset: true, error: "Choose an available time." }),
  note: optionalText(1000),
  rescheduleOf: z.union([uuid, z.literal("")]).optional().transform((v) => v || null),
  ack: z.literal("on", { error: "Please confirm you understand this is not for emergencies." }),
});

export async function requestAppointmentAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await currentActiveUser("patient");
  if (!user) return { ok: false, error: "Sign in with a patient account to request appointments." };
  const parsed = requestSchema.safeParse(formToObject(fd));
  if (!parsed.success) {
    const errs = fieldErrors(parsed.error);
    return { ok: false, error: Object.values(errs)[0]?.[0] ?? "Please check the form.", fieldErrors: errs };
  }
  const d = parsed.data;
  try {
    const allowed = await asUser(user, async (q) => (await q<{ ok: boolean }>(`select public.check_rate_limit('appointment_request', 10, 3600) as ok`))[0].ok);
    if (!allowed) return { ok: false, error: "You've sent a lot of requests recently. Please try again later." };
    await asUser(user, (q) =>
      q(`select public.create_appointment_request($1, $2, $3, $4, $5, $6)`, [d.providerId, d.serviceId, d.modality, d.slot, d.note, d.rescheduleOf]),
    );
  } catch (err) {
    return failure(err);
  }
  revalidatePath("/patient/appointments");
  redirect("/patient/appointments?requested=1");
}
