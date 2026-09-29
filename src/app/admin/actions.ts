"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSessionUser, hasAdminRole, type AdminRole } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { type ActionResult, failure } from "@/lib/errors";
import { email, fieldErrors, formToObject, optionalText, uuid } from "@/lib/validation";

async function admin(role?: AdminRole) {
  const user = await getSessionUser();
  if (!user || !hasAdminRole(user, role)) throw Object.assign(new Error(`${role ?? "admin"} role required`), { code: "42501" });
  return user;
}

const CHECKS = ["license_found_in_public_register", "name_matches", "license_active", "jurisdiction_matches"] as const;

export async function reviewVerificationAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = z
    .object({ verificationId: uuid, decision: z.enum(["approved", "rejected", "more_info_requested"]), reason: optionalText(1000), registerUrl: optionalText(500) })
    .safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, error: "Please complete the review form.", fieldErrors: fieldErrors(parsed.error) };
  const checks: Record<string, boolean | string> = Object.fromEntries(CHECKS.map((c) => [c, fd.get(c) === "on"]));
  if (parsed.data.registerUrl) checks.register_reference = parsed.data.registerUrl;
  try {
    const user = await admin("verifier");
    await asUser(user, (q) =>
      q(`select public.review_provider_verification($1, $2, $3, $4)`, [parsed.data.verificationId, parsed.data.decision, parsed.data.reason, JSON.stringify(checks)]),
    );
  } catch (err) {
    return failure(err);
  }
  revalidatePath("/admin/verifications");
  redirect("/admin/verifications?reviewed=1");
}

export async function suspendProviderAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = z.object({ providerId: uuid, reason: z.string().trim().min(3, "Give a reason.").max(500) }).safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, error: "Give a reason for the suspension." };
  try {
    const user = await admin("verifier");
    await asUser(user, (q) => q(`select public.admin_suspend_provider($1, $2)`, [parsed.data.providerId, parsed.data.reason]));
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Provider suspended and removed from the directory." };
  } catch (err) {
    return failure(err);
  }
}

export async function resolveReportAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = z.object({ reportId: uuid, status: z.enum(["reviewing", "actioned", "dismissed"]), note: optionalText(1000) }).safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, error: "Choose an outcome." };
  try {
    const user = await admin("moderator");
    await asUser(user, (q) => q(`select public.resolve_report($1, $2, $3)`, [parsed.data.reportId, parsed.data.status, parsed.data.note]));
    revalidatePath("/admin/reports");
    return { ok: true, message: "Report updated." };
  } catch (err) {
    return failure(err);
  }
}

export async function setUserStatusAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = z.object({ userId: uuid, status: z.enum(["active", "suspended"]), reason: z.string().trim().min(3).max(500) }).safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, error: "A reason is required." };
  try {
    const user = await admin("moderator");
    await asUser(user, (q) => q(`select public.admin_set_user_status($1, $2, $3)`, [parsed.data.userId, parsed.data.status, parsed.data.reason]));
    revalidatePath("/admin/users");
    return { ok: true, message: parsed.data.status === "suspended" ? "Account suspended." : "Account reactivated." };
  } catch (err) {
    return failure(err);
  }
}

export async function grantAdminAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = z.object({ email, role: z.enum(["moderator", "verifier", "superadmin"]) }).safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, error: "Enter an email and role." };
  try {
    const user = await admin("superadmin");
    const done = await asUser(user, async (q) => {
      const [target] = await q<{ id: string }>(`select id from public.users where lower(email) = $1`, [parsed.data.email]);
      if (!target) return false;
      await q(`select public.admin_grant_role($1, $2)`, [target.id, parsed.data.role]);
      return true;
    });
    if (!done) return { ok: false, error: "No account found with that email." };
    revalidatePath("/admin/admins");
    return { ok: true, message: "Role granted." };
  } catch (err) {
    return failure(err);
  }
}

export async function revokeAdminAction(fd: FormData) {
  const user = await admin("superadmin");
  const id = uuid.parse(fd.get("userId"));
  await asUser(user, (q) => q(`select public.admin_revoke_role($1)`, [id]));
  revalidatePath("/admin/admins");
}
