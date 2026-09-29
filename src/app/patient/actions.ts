"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentActiveUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { type ActionResult, failure } from "@/lib/errors";
import { fieldErrors, formToObject, optionalText, uuid } from "@/lib/validation";

async function patient() {
  const user = await currentActiveUser("patient");
  if (!user) throw Object.assign(new Error("Please sign in with a patient account."), { code: "42501" });
  return user;
}

export async function withdrawRequestAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    const user = await patient();
    const id = uuid.parse(fd.get("requestId"));
    await asUser(user, (q) => q(`select public.withdraw_appointment_request($1)`, [id]));
    revalidatePath("/patient/appointments");
    return { ok: true, message: "Request withdrawn." };
  } catch (err) {
    return failure(err);
  }
}

export async function cancelAppointmentAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    const user = await currentActiveUser();
    if (!user) return { ok: false, error: "Please sign in." };
    const parsed = z.object({ appointmentId: uuid, reason: optionalText(500) }).parse(formToObject(fd));
    await asUser(user, (q) => q(`select public.cancel_appointment($1, $2)`, [parsed.appointmentId, parsed.reason]));
    revalidatePath("/patient/appointments");
    revalidatePath("/provider/appointments");
    return { ok: true, message: "Appointment cancelled. The other party has been notified." };
  } catch (err) {
    return failure(err);
  }
}

/** Open (or reuse) a conversation with a provider, then go to it. */
export async function startConversationAction(fd: FormData) {
  const user = await currentActiveUser();
  if (!user) redirect("/sign-in");
  const providerId = uuid.parse(fd.get("providerId"));
  const patientId = fd.get("patientId");
  let id: string;
  try {
    const rows = await asUser(user, (q) =>
      q<{ id: string }>(`select public.start_conversation($1, $2) as id`, [providerId, typeof patientId === "string" && patientId ? patientId : null]),
    );
    id = rows[0].id;
  } catch {
    redirect(user.role === "provider" ? "/provider/messages?error=start" : "/patient/messages?error=start");
  }
  redirect(user.role === "provider" ? `/provider/messages/${id}` : `/patient/messages/${id}`);
}

const MAX_ATTACHMENT = 10 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" };

/** Checks magic bytes so a renamed executable can't pass as a PDF/image. */
function sniffType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "application/pdf";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return null;
}

export async function sendMessageAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await currentActiveUser();
  if (!user) return { ok: false, error: "Please sign in." };
  const parsed = z
    .object({ conversationId: uuid, body: z.string().trim().min(1, "Write a message.").max(4000, "Messages can be up to 4,000 characters.") })
    .safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, error: fieldErrors(parsed.error).body?.[0] ?? "Write a message.", fieldErrors: fieldErrors(parsed.error) };
  const file = fd.get("attachment");
  const hasFile = file instanceof File && file.size > 0;

  try {
    const allowed = await asUser(user, async (q) => (await q<{ ok: boolean }>(`select public.check_rate_limit('message_send', 60, 3600) as ok`))[0].ok);
    if (!allowed) return { ok: false, error: "You're sending messages too quickly. Please wait a little." };

    let attachmentId: string | null = null;
    if (hasFile) {
      if (file.size > MAX_ATTACHMENT) return { ok: false, error: "Attachments can be up to 10 MB." };
      const bytes = new Uint8Array(await file.arrayBuffer());
      const type = sniffType(bytes);
      if (!type || !ALLOWED_TYPES[type]) return { ok: false, error: "Attach a PDF, PNG or JPEG file." };
      const { uploadAttachment } = await import("@/lib/storage");
      attachmentId = await uploadAttachment(user, parsed.data.conversationId, file.name, type, bytes);
    }
    await asUser(user, (q) =>
      q(`insert into public.messages (conversation_id, body, attachment_id) values ($1, $2, $3)`, [parsed.data.conversationId, parsed.data.body, attachmentId]),
    );
  } catch (err) {
    return failure(err);
  }
  revalidatePath(`/patient/messages/${parsed.data.conversationId}`);
  revalidatePath(`/provider/messages/${parsed.data.conversationId}`);
  return { ok: true };
}

export async function closeConversationAction(fd: FormData) {
  const user = await currentActiveUser();
  if (!user) redirect("/sign-in");
  const id = uuid.parse(fd.get("conversationId"));
  await asUser(user, (q) => q(`select public.close_conversation($1)`, [id]));
  revalidatePath(`/patient/messages/${id}`);
  revalidatePath(`/provider/messages/${id}`);
}

// ---------------------------------------------------------------- health data
const healthSchema = z.object({
  id: z.union([uuid, z.literal("")]).optional(),
  category: z.enum(["condition", "allergy", "medication", "immunization", "measurement", "procedure", "note"]),
  label: z.string().trim().min(1, "Enter a name.").max(200),
  value: optionalText(500),
  unit: optionalText(30),
  recordedOn: z.union([z.iso.date(), z.literal("")]).transform((v) => v || null),
});

export async function saveHealthEntryAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = healthSchema.safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, error: "Please check the entry.", fieldErrors: fieldErrors(parsed.error) };
  try {
    const user = await patient();
    const d = parsed.data;
    await asUser(user, (q) =>
      d.id
        ? q(`update public.health_data set category = $1, label = $2, value = $3, unit = $4, recorded_on = $5 where id = $6`, [d.category, d.label, d.value, d.unit, d.recordedOn, d.id])
        : q(`insert into public.health_data (category, label, value, unit, recorded_on) values ($1, $2, $3, $4, $5)`, [d.category, d.label, d.value, d.unit, d.recordedOn]),
    );
    revalidatePath("/patient/health");
    return { ok: true, message: "Saved." };
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === "42501") return { ok: false, error: "Turn on health information storage in your privacy settings first." };
    return failure(err);
  }
}

export async function deleteHealthEntryAction(fd: FormData) {
  const user = await patient();
  const id = uuid.parse(fd.get("id"));
  await asUser(user, (q) => q(`delete from public.health_data where id = $1`, [id]));
  revalidatePath("/patient/health");
}

// -------------------------------------------------------------- integrations
export async function disconnectIntegrationAction(fd: FormData) {
  const user = await patient();
  const id = uuid.parse(fd.get("connectionId"));
  const deleteData = fd.get("deleteData") === "on";
  await asUser(user, (q) => q(`select public.disconnect_integration($1, $2)`, [id, deleteData]));
  revalidatePath("/patient/connections");
}

export async function revokeScopeAction(fd: FormData) {
  const user = await patient();
  const id = uuid.parse(fd.get("connectionId"));
  const scope = z.string().max(80).parse(fd.get("scope"));
  await asUser(user, (q) => q(`select public.revoke_integration_scope($1, $2)`, [id, scope]));
  revalidatePath("/patient/connections");
}
