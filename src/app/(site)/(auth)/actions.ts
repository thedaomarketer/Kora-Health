"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { asService } from "@/lib/db";
import { env, features } from "@/lib/env";
import { type ActionResult, failure } from "@/lib/errors";
import { CONSENT_VERSIONS, safeNextPath } from "@/lib/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { email, fieldErrors, formToObject, password } from "@/lib/validation";

const NOT_CONFIGURED: ActionResult = {
  ok: false,
  error: "Accounts aren't available in this environment yet (authentication is not configured).",
};

const signUpSchema = z.object({
  role: z.enum(["patient", "provider"]),
  displayName: z.string().trim().min(2, "Enter your name.").max(120),
  email,
  password,
  acceptTerms: z.literal("on", { error: "You must accept the Terms of Service and Privacy Policy." }),
  productUpdates: z.literal("on").optional(),
});

export async function signUpAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  if (!features.auth || !features.database) return NOT_CONFIGURED;
  const parsed = signUpSchema.safeParse(formToObject(fd));
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  }
  const { role, displayName, email, password, productUpdates } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role, display_name: displayName },
      emailRedirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/onboarding`,
    },
  });
  if (error) {
    if (/password/i.test(error.message)) {
      return { ok: false, error: "That password isn't strong enough. Try a longer passphrase.", fieldErrors: { password: [error.message] } };
    }
    if (error.status === 429) return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
    console.error("[kora] sign-up failed", error.status, error.code);
    return { ok: false, error: "We couldn't create your account. Please try again." };
  }

  // Record the agreements made on this form. The user row was created by the
  // auth trigger; `identities` is empty when the email is already registered.
  const newUser = data.user && (data.user.identities?.length ?? 0) > 0 ? data.user : null;
  if (newUser) {
    try {
      await asService(async (q) => {
        const consents: Array<[string, boolean]> = [
          ["terms_of_service", true],
          ["privacy_policy", true],
          ["product_updates", Boolean(productUpdates)],
        ];
        for (const [type, granted] of consents) {
          await q(`insert into public.consents (user_id, consent_type, version, granted) values ($1, $2, $3, $4)`, [
            newUser.id,
            type,
            CONSENT_VERSIONS[type as keyof typeof CONSENT_VERSIONS],
            granted,
          ]);
        }
      });
    } catch (err) {
      return failure(err);
    }
  }

  if (data.session) redirect("/onboarding");
  // Same response whether or not the email already existed (no account enumeration).
  return { ok: true, message: "Check your email to confirm your address, then sign in." };
}

const signInSchema = z.object({ email, password: z.string().min(1, "Enter your password.").max(128), next: z.string().optional() });

export async function signInAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  if (!features.auth || !features.database) return NOT_CONFIGURED;
  const parsed = signInSchema.safeParse(formToObject(fd));
  if (!parsed.success) {
    return { ok: false, error: "Enter your email and password.", fieldErrors: fieldErrors(parsed.error) };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) {
    if (error.status === 429) return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
    if (error.code === "email_not_confirmed") return { ok: false, error: "Please confirm your email address first — check your inbox." };
    return { ok: false, error: "Email or password is incorrect." };
  }
  redirect(safeNextPath(parsed.data.next, "/onboarding"));
}

export async function signOutAction() {
  if (features.auth) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}

export async function requestPasswordResetAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  if (!features.auth) return NOT_CONFIGURED;
  const parsed = z.object({ email }).safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, error: "Enter a valid email address.", fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
  });
  if (error?.status === 429) return { ok: false, error: "Too many requests. Please wait a few minutes." };
  return { ok: true, message: "If an account exists for that email, we've sent a link to reset your password." };
}

export async function updatePasswordAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  if (!features.auth) return NOT_CONFIGURED;
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "Passwords don't match.", path: ["confirm"] })
    .safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, error: "Your reset link has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: "We couldn't update your password. Try a different one." };
  await asService((q) =>
    q(`insert into public.audit_logs (actor_id, subject_user_id, action, target_type, target_id) values ($1, $1, 'account.password_changed', 'user', $1)`, [data.user.id]),
  );
  redirect("/onboarding");
}
