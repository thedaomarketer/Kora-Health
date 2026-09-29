import "server-only";
import Stripe from "stripe";
import { env, features } from "@/lib/env";

/**
 * Stripe is used only from the server. The secret key and webhook secret
 * never reach the browser; card data is handled entirely by Stripe Checkout.
 */
let stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (!features.payments || !env.STRIPE_SECRET_KEY) throw new Error("Payments are not configured");
  stripe ??= new Stripe(env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, timeout: 20_000 });
  return stripe;
}

export const SUBSCRIPTION_STATUSES = ["incomplete", "trialing", "active", "past_due", "canceled", "unpaid", "paused"] as const;

export function normalizeStatus(status: string): (typeof SUBSCRIPTION_STATUSES)[number] {
  if ((SUBSCRIPTION_STATUSES as readonly string[]).includes(status)) return status as (typeof SUBSCRIPTION_STATUSES)[number];
  return status === "incomplete_expired" ? "canceled" : "incomplete";
}
