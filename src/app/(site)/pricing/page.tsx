import type { Metadata } from "next";
import { Check } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { asAnon } from "@/lib/db";
import { features } from "@/lib/env";

export const metadata: Metadata = { title: "Plans for providers and clinics" };

interface Plan { id: string; name: string; description: string; price_cents: number | null; currency: string; billing_interval: string; features: string[] }

export default async function PricingPage() {
  const plans = features.database
    ? await asAnon((q) => q<Plan>(`select id, name, description, price_cents, currency, billing_interval, features from public.subscription_plans order by sort_order`))
    : [];
  return (
    <div className="container-page py-12 sm:py-16">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">Plans</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        Patients always use Kora for free. Provider and clinic plans are being finalized.
      </p>
      {plans.length ? (
        <ul className="mt-10 grid gap-6 md:grid-cols-3">
          {plans.map((p) => (
            <li key={p.id}>
              <Card className="flex h-full flex-col p-6">
                <h2 className="text-lg font-semibold text-ink">{p.name}</h2>
                <p className="mt-1 text-sm text-muted">{p.description}</p>
                <p className="mt-4 text-3xl font-bold text-ink">
                  {p.price_cents === null ? "—" : new Intl.NumberFormat("en-CA", { style: "currency", currency: p.currency.toUpperCase() }).format(p.price_cents / 100)}
                  <span className="text-sm font-normal text-muted"> / {p.billing_interval}</span>
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2"><Check aria-hidden className="size-4 text-brand-700" />{f}</li>
                  ))}
                </ul>
                <ButtonLink href="/provider/billing" className="mt-6">Choose plan</ButtonLink>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="mt-10 max-w-2xl p-8">
          <h2 className="text-lg font-semibold text-ink">Early access: free for providers</h2>
          <p className="mt-2 text-muted">
            Paid plans aren&apos;t available yet. Providers can create a profile, get verified, receive appointment
            requests and message patients at no cost during early access. We&apos;ll give plenty of notice before any
            pricing is introduced.
          </p>
          <ButtonLink href="/sign-up?role=provider" className="mt-6">Join as a Provider</ButtonLink>
        </Card>
      )}
    </div>
  );
}
