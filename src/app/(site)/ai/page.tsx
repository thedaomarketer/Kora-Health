import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, ClipboardList, Compass, MessageCircleQuestion, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { EMERGENCY_NOTE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Kora AI — healthcare navigation assistant",
  description: "Kora AI helps you organize your concerns, understand healthcare terms, prepare for appointments and find relevant providers. It does not diagnose or prescribe.",
};

export default async function AiLandingPage() {
  const user = await getSessionUser();
  const cta = user?.role === "patient" ? "/patient/ai" : user ? "/provider" : "/sign-up";
  return (
    <>
      <section className="bg-brand-900 text-white">
        <div className="container-page grid gap-10 py-16 sm:py-20 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-clay-200"><Sparkles aria-hidden className="size-4" /> Kora AI</p>
            <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Understand your next step in care</h1>
            <p className="mt-5 max-w-xl text-lg text-brand-100">
              Kora AI is a healthcare navigation assistant. It helps you organize what you&apos;re experiencing, learn
              what different professionals do, prepare questions and find providers — clearly and without judgement.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={cta} variant="inverse" size="lg">{user ? "Open Kora AI" : "Create a free account to start"}</ButtonLink>
              <ButtonLink href="/providers" variant="accent" size="lg">Browse providers</ButtonLink>
            </div>
          </div>
          <Card className="bg-white/95 p-6 text-ink">
            <p className="flex items-center gap-2 text-sm font-semibold text-red-800"><AlertTriangle aria-hidden className="size-4" /> Not for emergencies</p>
            <p className="mt-2 text-sm leading-relaxed">{EMERGENCY_NOTE}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              If you&apos;re thinking about harming yourself, call or text 9-8-8 (Canada) or 988 (United States), or call
              116 123 (UK &amp; Ireland), any time.
            </p>
          </Card>
        </div>
      </section>

      <section className="container-page py-16">
        <h2 className="font-display text-3xl font-semibold text-ink">What Kora AI does</h2>
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [ClipboardList, "Structured intake", "Asks short follow-up questions and organizes what you share into a clear summary."],
            [Compass, "Points you to the right care", "Suggests which kinds of professionals may be relevant and links to matching providers."],
            [MessageCircleQuestion, "Prepares you for appointments", "Helps you write down questions and what you want to discuss."],
            [Sparkles, "Explains in plain language", "Explains healthcare terms and how services work."],
          ].map(([Icon, t, d]) => {
            const I = Icon as typeof Sparkles;
            return (
              <li key={t as string} className="rounded-3xl bg-white p-6 ring-1 ring-line/80">
                <I aria-hidden className="size-6 text-brand-700" />
                <h3 className="mt-3 font-semibold text-ink">{t as string}</h3>
                <p className="mt-1.5 text-sm text-muted">{d as string}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="bg-white py-16">
        <div className="container-page grid gap-8 lg:grid-cols-2">
          <div className="rounded-3xl bg-emerald-50 p-6 ring-1 ring-emerald-200">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-emerald-950"><CheckCircle2 aria-hidden className="size-5" /> Designed to</h2>
            <ul className="mt-4 space-y-2 text-emerald-950">
              <li>Give general health information and navigation support</li>
              <li>Direct you to emergency or urgent services when something could be serious</li>
              <li>Be clear about what it doesn&apos;t know</li>
              <li>Respect your preferences, like language and type of care</li>
            </ul>
          </div>
          <div className="rounded-3xl bg-red-50 p-6 ring-1 ring-red-200">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-red-950"><XCircle aria-hidden className="size-5" /> Will never</h2>
            <ul className="mt-4 space-y-2 text-red-950">
              <li>Diagnose you or tell you what condition you have</li>
              <li>Prescribe, stop or change medications or doses</li>
              <li>Claim to be a doctor or replace a healthcare professional</li>
              <li>Rank providers by race or ethnicity</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <div className="flex gap-4 rounded-3xl bg-brand-50 p-6 ring-1 ring-brand-100">
          <ShieldCheck aria-hidden className="size-7 shrink-0 text-brand-700" />
          <div>
            <h2 className="font-semibold text-ink">Your privacy</h2>
            <p className="mt-1 text-sm text-ink/80">
              Kora AI only works with your permission. Messages are processed by our AI service provider to generate
              responses and stored privately so you can revisit them — you can delete any conversation. Kora AI never
              reads the health information you store in Kora, and Kora staff can&apos;t read your conversations.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
