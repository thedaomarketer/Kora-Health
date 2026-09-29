import type { Metadata } from "next";
import { Check } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { features } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { openBillingPortalAction, startCheckoutAction } from "./actions";

export const metadata: Metadata = { title: "Plan & billing" };

export default async function BillingPage({ searchParams }: PageProps<"/provider/billing">) {
  const user = await requireUser({ role: "provider" });
  const sp = await searchParams;
  const [plans, subs, payments] = await asUser(user, async (q) => [
    await q<{ id: string; name: string; description: string; price_cents: number | null; currency: string; billing_interval: string; features: string[]; stripe_price_id: string | null }>(
      `select id, name, description, price_cents, currency, billing_interval, features, stripe_price_id from public.subscription_plans order by sort_order`,
    ),
    await q<{ id: string; plan_name: string; status: string; current_period_end: string | null; cancel_at_period_end: boolean }>(
      `select s.id, p.name as plan_name, s.status, s.current_period_end, s.cancel_at_period_end from public.subscriptions s
         join public.subscription_plans p on p.id = s.plan_id where s.user_id = auth.uid() order by s.created_at desc`,
    ),
    await q<{ id: string; amount_cents: number; currency: string; status: string; created_at: string }>(
      `select id, amount_cents, currency, status, created_at from public.payments where user_id = auth.uid() order by created_at desc limit 12`,
    ),
  ] as const);
  const current = subs.find((s) => ["active", "trialing", "past_due"].includes(s.status));
  const money = (cents: number, cur: string) => new Intl.NumberFormat("en-CA", { style: "currency", currency: cur.toUpperCase() }).format(cents / 100);

  return (
    <>
      <PageHeader title="Plan & billing" description="Kora is free for providers during early access." />
      {sp.checkout === "success" ? <Alert tone="success" className="mb-6">Thanks! Your subscription will appear here once Stripe confirms the payment.</Alert> : null}
      {sp.checkout === "cancelled" ? <Alert tone="info" className="mb-6">Checkout was cancelled. You haven&apos;t been charged.</Alert> : null}

      <Card className="mb-8">
        <CardHeader title="Current plan" />
        <CardBody>
          {current ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-ink">{current.plan_name} <Badge tone={current.status === "past_due" ? "warning" : "success"}>{current.status.replace("_", " ")}</Badge></p>
                {current.current_period_end ? <p className="text-sm text-muted">{current.cancel_at_period_end ? "Ends" : "Renews"} {formatDateTime(current.current_period_end)}</p> : null}
              </div>
              <ActionForm action={openBillingPortalAction}><SubmitButton variant="secondary">Manage billing</SubmitButton></ActionForm>
            </div>
          ) : (
            <p className="text-muted"><strong className="text-ink">Early access (free).</strong> Your profile, verification, appointment requests and messaging are included at no cost.</p>
          )}
        </CardBody>
      </Card>

      {!features.payments || plans.length === 0 ? (
        <Alert tone="info" title="Paid plans aren't available yet">
          Kora hasn&apos;t launched paid plans. You won&apos;t be charged, and we&apos;ll give notice before introducing any fees.
        </Alert>
      ) : (
        <ul className="grid gap-5 md:grid-cols-3">
          {plans.map((p) => (
            <li key={p.id}>
              <Card className="flex h-full flex-col p-6">
                <h2 className="text-lg font-semibold text-ink">{p.name}</h2>
                <p className="mt-1 text-sm text-muted">{p.description}</p>
                {p.price_cents !== null ? <p className="mt-4 text-2xl font-bold text-ink">{money(p.price_cents, p.currency)}<span className="text-sm font-normal text-muted"> / {p.billing_interval}</span></p> : null}
                <ul className="mt-4 flex-1 space-y-1.5 text-sm">{p.features.map((f) => <li key={f} className="flex gap-2"><Check aria-hidden className="size-4 text-brand-700" />{f}</li>)}</ul>
                <ActionForm action={startCheckoutAction} className="mt-5">
                  <input type="hidden" name="planId" value={p.id} />
                  <SubmitButton className="w-full" disabled={!p.stripe_price_id || Boolean(current)} pendingLabel="Redirecting…">{current ? "Manage in billing portal" : "Choose plan"}</SubmitButton>
                </ActionForm>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {payments.length ? (
        <Card className="mt-8">
          <CardHeader title="Payment history" />
          <ul className="divide-y divide-line">
            {payments.map((p) => (
              <li key={p.id} className="flex justify-between px-6 py-3 text-sm"><span>{formatDateTime(p.created_at)}</span><span>{money(p.amount_cents, p.currency)} · {p.status}</span></li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
