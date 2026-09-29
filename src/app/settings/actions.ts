"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentActiveUser, getSessionUser } from "@/lib/auth/session";
import { syncConsents } from "@/lib/consents";
import { asService, asUser } from "@/lib/db";
import { features } from "@/lib/env";
import { type ActionResult, failure } from "@/lib/errors";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { formToObject } from "@/lib/validation";

const consentType = z.enum(["ai_assistant", "health_data_storage", "matching_personalization", "product_updates"]);

export async function setConsentAction(fd: FormData) {
  const user = await currentActiveUser();
  if (!user) redirect("/sign-in");
  const parsed = z.object({ type: consentType, granted: z.enum(["1", "0"]), back: z.string().optional() }).safeParse(formToObject(fd));
  if (!parsed.success) return;
  await asUser(user, (q) => syncConsents(q, { [parsed.data.type]: parsed.data.granted === "1" }));
  revalidatePath("/settings");
  revalidatePath("/patient", "layout");
  if (parsed.data.back?.startsWith("/") && !parsed.data.back.startsWith("//")) redirect(parsed.data.back);
}

export async function updateAccountAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await currentActiveUser();
  if (!user) return { ok: false, error: "Please sign in." };
  const parsed = z.object({ displayName: z.string().trim().min(2, "Enter your name.").max(120) }).safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, error: "Enter your name (2–120 characters)." };
  try {
    await asUser(user, (q) => q(`update public.users set display_name = $1 where id = auth.uid()`, [parsed.data.displayName]));
    revalidatePath("/", "layout");
    return { ok: true, message: "Saved." };
  } catch (err) {
    return failure(err);
  }
}

export async function markNotificationsReadAction() {
  const user = await currentActiveUser();
  if (!user) return;
  await asUser(user, (q) => q(`update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null`));
  revalidatePath("/", "layout");
}

/**
 * Permanently deletes the account. The auth user is removed with the
 * service-role admin API; database rows cascade from auth.users. The audit
 * entry is written first (audit logs keep only pseudonymous ids).
 */
export async function deleteAccountAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in." };
  if (fd.get("confirm") !== "DELETE") return { ok: false, error: 'Type DELETE to confirm.' };
  if (!features.accountDeletion) {
    return { ok: false, error: "Account deletion isn't configured in this environment. Contact support to delete your account." };
  }
  if (user.adminRole) {
    return { ok: false, error: "Administrator accounts must have their admin role removed by another superadmin before deletion." };
  }
  try {
    await asService((q) =>
      q(`insert into public.audit_logs (actor_id, subject_user_id, action, target_type, target_id, metadata)
         values ($1, $1, 'account.deleted', 'user', $1, jsonb_build_object('role', $2::text))`, [user.id, user.role]),
    );
    const admin = createSupabaseAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut().catch(() => {});
  } catch (err) {
    return failure(err);
  }
  redirect("/?account=deleted");
}
