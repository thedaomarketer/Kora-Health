import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { asService } from "@/lib/db";
import { env, features } from "@/lib/env";
import { sanitizeForLog } from "@/lib/errors";
import { getStripe, normalizeStatus } from "@/lib/payments";

export const runtime = "nodejs";

/**
 * Stripe webhook. Signature-verified against the raw body; idempotent via
 * public.stripe_events. Writes subscriptions/payments with the service role.
 */
export async function POST(req: NextRequest) {
  if (!features.payments || !env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await asService(async (q) => {
      const inserted = await q(`insert into public.stripe_events (id, event_type) values ($1, $2) on conflict do nothing returning id`, [event.id, event.type]);
      if (!inserted.length) return; // already processed

      if (event.type.startsWith("customer.subscription.")) {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.user_id;
        const planId = sub.metadata?.plan_id;
        if (!userId || !planId) return;
        const periodEnd = sub.items?.data?.[0]?.current_period_end ?? null;
        await q(
          `insert into public.subscriptions (user_id, plan_id, status, stripe_customer_id, stripe_subscription_id, current_period_end, cancel_at_period_end)
           select $1, $2, $3, $4, $5, to_timestamp($6), $7 where exists (select 1 from public.users where id = $1)
           on conflict (stripe_subscription_id) do update set status = excluded.status, plan_id = excluded.plan_id,
             current_period_end = excluded.current_period_end, cancel_at_period_end = excluded.cancel_at_period_end`,
          [userId, planId, normalizeStatus(event.type === "customer.subscription.deleted" ? "canceled" : sub.status),
            typeof sub.customer === "string" ? sub.customer : sub.customer.id, sub.id, periodEnd, sub.cancel_at_period_end],
        );
        await q(`insert into public.audit_logs (subject_user_id, action, target_type, target_id, metadata) values ($1, 'billing.subscription_updated', 'subscription', $2, jsonb_build_object('status', $3::text))`,
          [userId, sub.id, sub.status]);
      } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
        const invoice = event.data.object as Stripe.Invoice;
        const customer = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customer || !invoice.id) return;
        await q(
          `insert into public.payments (user_id, subscription_id, amount_cents, currency, status, stripe_invoice_id)
           select s.user_id, s.id, $2, $3, $4, $5 from public.subscriptions s where s.stripe_customer_id = $1
            order by s.created_at desc limit 1
           on conflict (stripe_invoice_id) do update set status = excluded.status`,
          [customer, event.type === "invoice.paid" ? invoice.amount_paid : invoice.amount_due, invoice.currency, event.type === "invoice.paid" ? "succeeded" : "failed", invoice.id],
        );
      }
    });
  } catch (err) {
    console.error("[kora] stripe webhook failed", sanitizeForLog(err));
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
