"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { currentActiveUser } from "@/lib/auth/session";
import { asService, asUser } from "@/lib/db";
import { env, features } from "@/lib/env";
import { type ActionResult, failure } from "@/lib/errors";
import { getStripe } from "@/lib/payments";

export async function startCheckoutAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  if (!features.payments) return { ok: false, error: "Payments aren't enabled yet." };
  const user = await currentActiveUser("provider");
  if (!user) return { ok: false, error: "Please sign in with a provider account." };
  const planId = z.string().regex(/^[a-z0-9_-]+$/).safeParse(fd.get("planId"));
  if (!planId.success) return { ok: false, error: "Choose a plan." };
  let url: string | null = null;
  try {
    const [plan] = await asUser(user, (q) =>
      q<{ id: string; stripe_price_id: string | null }>(`select id, stripe_price_id from public.subscription_plans where id = $1 and is_active`, [planId.data]),
    );
    if (!plan?.stripe_price_id) return { ok: false, error: "That plan isn't available." };
    const [existing] = await asUser(user, (q) =>
      q<{ stripe_customer_id: string | null }>(`select stripe_customer_id from public.subscriptions where user_id = auth.uid() and stripe_customer_id is not null order by created_at desc limit 1`),
    );
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      ...(existing?.stripe_customer_id ? { customer: existing.stripe_customer_id } : { customer_email: user.email }),
      client_reference_id: user.id,
      metadata: { user_id: user.id, plan_id: plan.id },
      subscription_data: { metadata: { user_id: user.id, plan_id: plan.id } },
      success_url: `${env.NEXT_PUBLIC_SITE_URL}/provider/billing?checkout=success`,
      cancel_url: `${env.NEXT_PUBLIC_SITE_URL}/provider/billing?checkout=cancelled`,
    });
    await asService((q) =>
      q(`insert into public.audit_logs (actor_id, subject_user_id, action, target_type, target_id) values ($1, $1, 'billing.checkout_started', 'plan', $2)`, [user.id, plan.id]),
    );
    url = session.url;
  } catch (err) {
    return failure(err);
  }
  if (!url) return { ok: false, error: "Couldn't start checkout. Please try again." };
  redirect(url);
}

export async function openBillingPortalAction(_prev: ActionResult | null): Promise<ActionResult> {
  if (!features.payments) return { ok: false, error: "Payments aren't enabled yet." };
  const user = await currentActiveUser("provider");
  if (!user) return { ok: false, error: "Please sign in." };
  let url: string;
  try {
    const [sub] = await asUser(user, (q) =>
      q<{ stripe_customer_id: string | null }>(`select stripe_customer_id from public.subscriptions where user_id = auth.uid() and stripe_customer_id is not null order by created_at desc limit 1`),
    );
    if (!sub?.stripe_customer_id) return { ok: false, error: "No billing account found." };
    const portal = await getStripe().billingPortal.sessions.create({ customer: sub.stripe_customer_id, return_url: `${env.NEXT_PUBLIC_SITE_URL}/provider/billing` });
    url = portal.url;
  } catch (err) {
    return failure(err);
  }
  redirect(url);
}
