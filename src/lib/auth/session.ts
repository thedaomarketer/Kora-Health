import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { asUser } from "@/lib/db";
import { features } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AppRole = "patient" | "provider";
export type AdminRole = "moderator" | "verifier" | "superadmin";

export interface SessionUser {
  id: string;
  email: string;
  role: AppRole;
  status: "active" | "suspended";
  displayName: string;
  adminRole: AdminRole | null;
}

/**
 * Resolve the signed-in user for this request. `auth.getUser()` validates
 * the access token with Supabase Auth (it does not trust the cookie alone).
 * Cached per request.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!features.auth || !features.database) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const rows = await asUser({ id: data.user.id, email: data.user.email }, (q) =>
    q<{ role: AppRole; status: "active" | "suspended"; display_name: string; email: string; admin_role: AdminRole | null }>(
      `select u.role, u.status, u.display_name, u.email, a.admin_role
         from public.users u
         left join public.administrators a on a.user_id = u.id
        where u.id = auth.uid()`,
    ),
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: data.user.id,
    email: row.email,
    role: row.role,
    status: row.status,
    displayName: row.display_name,
    adminRole: row.admin_role,
  };
});

export function homePathFor(user: Pick<SessionUser, "role">) {
  return user.role === "provider" ? "/provider" : "/patient";
}

/** Require a signed-in, active user (optionally with a specific role). */
export async function requireUser(opts: { role?: AppRole; next?: string } = {}): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(`/sign-in${opts.next ? `?next=${encodeURIComponent(opts.next)}` : ""}`);
  }
  if (user.status !== "active") redirect("/account-suspended");
  if (opts.role && user.role !== opts.role) redirect(homePathFor(user));
  return user;
}

const ADMIN_RANK: Record<AdminRole, AdminRole[]> = {
  moderator: ["moderator", "superadmin"],
  verifier: ["verifier", "superadmin"],
  superadmin: ["superadmin"],
};

export function hasAdminRole(user: SessionUser | null, required?: AdminRole) {
  if (!user?.adminRole || user.status !== "active") return false;
  return required ? ADMIN_RANK[required].includes(user.adminRole) : true;
}

/** Require any admin role (or a specific one). Database functions re-check. */
export async function requireAdmin(required?: AdminRole): Promise<SessionUser> {
  const user = await requireUser({ next: "/admin" });
  if (!hasAdminRole(user, required)) redirect("/forbidden");
  return user;
}

/** For server actions: return the user or null without redirecting. */
export async function currentActiveUser(role?: AppRole) {
  const user = await getSessionUser();
  if (!user || user.status !== "active") return null;
  if (role && user.role !== role) return null;
  return user;
}
