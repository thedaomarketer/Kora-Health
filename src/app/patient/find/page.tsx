import type { Metadata } from "next";
import Link from "next/link";
import { Info, Sparkles } from "lucide-react";
import { ProviderCard } from "@/components/directory/provider-card";
import { Alert, EmptyState } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { Checkbox, Fieldset, Select } from "@/components/ui/form";
import { interpretConcern } from "@/lib/ai/assistant";
import { suggestSpecialties } from "@/lib/ai/concerns";
import { classifyUserMessage, requiresSafetyResponse, safetyResponse } from "@/lib/ai/safety";
import { SafeMarkdown } from "@/components/ai/safe-markdown";
import { requireUser } from "@/lib/auth/session";
import { COUNTRIES, LANGUAGES, PAYMENT_OPTIONS } from "@/lib/constants";
import { asUser } from "@/lib/db";
import { getReferenceData, listProvidersForMatching } from "@/lib/directory";
import { features } from "@/lib/env";
import { sanitizeForLog } from "@/lib/errors";
import { rankProviders } from "@/lib/matching";
import { getConsents, getPatientProfile } from "@/lib/profiles";

export const metadata: Metadata = { title: "Find care" };

const arr = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

export default async function FindCarePage({ searchParams }: PageProps<"/patient/find">) {
  const user = await requireUser({ role: "patient" });
  const sp = await searchParams;
  const [reference, consents, profile] = await Promise.all([getReferenceData(), getConsents(user), getPatientProfile(user)]);
  const personalize = consents.matching_personalization?.granted === true;
  const aiConsent = consents.ai_assistant?.granted === true;
  const submitted = sp.go === "1";
  const known = new Set(reference.specialties.map((s) => s.slug));

  const concern = typeof sp.concern === "string" ? sp.concern.trim().slice(0, 1000) : "";
  const prefs = {
    specialty: typeof sp.specialty === "string" && known.has(sp.specialty) ? sp.specialty : "",
    care: (sp.care === "virtual" || sp.care === "in_person" ? sp.care : "either") as "virtual" | "in_person" | "either",
    city: typeof sp.city === "string" ? sp.city.slice(0, 80) : submitted ? "" : personalize ? profile?.city ?? "" : "",
    country: typeof sp.country === "string" && sp.country in COUNTRIES ? sp.country : submitted ? "" : personalize ? profile?.country ?? "" : "",
    languages: (submitted ? arr(sp.languages) : personalize ? profile?.preferred_languages ?? [] : []).filter((l) => l in LANGUAGES),
    payment: (submitted ? arr(sp.payment) : personalize ? profile?.payment_preferences ?? [] : []).filter((p) => p in PAYMENT_OPTIONS),
    accepting: submitted ? sp.accepting === "1" : true,
  };

  let emergency: string | null = null;
  let specialties: string[] = [];
  let ai: Awaited<ReturnType<typeof interpretConcern>> = null;
  let source: "selected" | "ai" | "rules" | "none" = "none";
  let results: ReturnType<typeof rankProviders<Awaited<ReturnType<typeof listProvidersForMatching>>[number]>> = [];

  if (submitted) {
    const flags = concern ? classifyUserMessage(concern) : [];
    if (requiresSafetyResponse(flags)) {
      emergency = safetyResponse(flags);
    } else {
      if (prefs.specialty) {
        specialties = [prefs.specialty];
        source = "selected";
      } else if (concern) {
        if (features.ai && aiConsent) {
          const allowed = await asUser(user, async (q) => (await q<{ ok: boolean }>(`select public.check_rate_limit('ai_match', 20, 3600) as ok`))[0].ok);
          if (allowed) {
            try {
              ai = await interpretConcern(concern, reference.specialties);
            } catch (err) {
              console.error("[kora] concern interpretation failed", sanitizeForLog(err));
            }
          }
        }
        if (ai?.specialties.length) {
          specialties = ai.specialties;
          source = "ai";
        } else {
          specialties = suggestSpecialties(concern, known);
          source = "rules";
        }
      }
      const candidates = await listProvidersForMatching();
      results = rankProviders(
        candidates,
        { specialties, care: prefs.care, city: prefs.city || null, country: prefs.country || null, languages: prefs.languages, payment: prefs.payment, acceptingOnly: prefs.accepting },
        { language: (c) => LANGUAGES[c] ?? c, payment: (c) => PAYMENT_OPTIONS[c] ?? c },
        12,
      );
    }
  }
  const specName = (slug: string) => reference.specialties.find((s) => s.slug === slug)?.name ?? slug;

  return (
    <>
      <PageHeader
        title="Find care"
        description="Tell us what you need and what matters to you. Kora suggests relevant providers and explains why each one appears."
      />
      <div className="grid gap-8 xl:grid-cols-[22rem_1fr]">
        <Card className="h-fit">
          <CardHeader title="Your needs & preferences" />
          <CardBody>
            <form method="get" className="space-y-5">
              <input type="hidden" name="go" value="1" />
              <div>
                <label htmlFor="concern" className="block text-sm font-semibold text-ink">What do you need help with?</label>
                <textarea id="concern" name="concern" defaultValue={concern} rows={3} maxLength={1000} aria-describedby="concern-hint"
                  className="mt-1.5 block w-full rounded-xl border-0 px-3.5 py-2.5 ring-1 ring-inset ring-line focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                <p id="concern-hint" className="mt-1 text-xs text-muted">
                  {features.ai && aiConsent ? "Kora AI will suggest relevant specialties. " : "Kora matches your words to relevant specialties. "}
                  Avoid names or identifying details.
                </p>
              </div>
              <div>
                <label htmlFor="specialty" className="block text-sm font-semibold text-ink">Or choose a specialty</label>
                <Select id="specialty" name="specialty" defaultValue={prefs.specialty} className="mt-1.5">
                  <option value="">Let Kora suggest</option>
                  {reference.specialties.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
                </Select>
              </div>
              <Fieldset legend="Type of care">
                {[["either", "No preference"], ["virtual", "Virtual"], ["in_person", "In person"]].map(([v, l]) => (
                  <label key={v} className="flex min-h-8 items-center gap-2 text-sm">
                    <input type="radio" name="care" value={v} defaultChecked={prefs.care === v} className="size-5 accent-brand-700" /> {l}
                  </label>
                ))}
              </Fieldset>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="city" className="block text-sm font-semibold text-ink">City</label>
                  <input id="city" name="city" defaultValue={prefs.city} className="mt-1.5 block min-h-11 w-full rounded-xl border-0 px-3 ring-1 ring-inset ring-line focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                </div>
                <div>
                  <label htmlFor="country" className="block text-sm font-semibold text-ink">Country</label>
                  <Select id="country" name="country" defaultValue={prefs.country} className="mt-1.5">
                    <option value="">Any</option>
                    {Object.entries(COUNTRIES).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
                  </Select>
                </div>
              </div>
              <details open={prefs.languages.length > 0}>
                <summary className="cursor-pointer text-sm font-semibold text-ink">Languages {prefs.languages.length ? `(${prefs.languages.length})` : ""}</summary>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {Object.entries(LANGUAGES).map(([c, n]) => <Checkbox key={c} name="languages" value={c} label={n} defaultChecked={prefs.languages.includes(c)} />)}
                </div>
              </details>
              <details open={prefs.payment.length > 0}>
                <summary className="cursor-pointer text-sm font-semibold text-ink">Insurance & payment {prefs.payment.length ? `(${prefs.payment.length})` : ""}</summary>
                <div className="mt-2 space-y-2">
                  {Object.entries(PAYMENT_OPTIONS).map(([c, n]) => <Checkbox key={c} name="payment" value={c} label={n} defaultChecked={prefs.payment.includes(c)} />)}
                </div>
              </details>
              <Checkbox name="accepting" value="1" label="Only providers accepting new patients" defaultChecked={prefs.accepting} />
              <button type="submit" className={buttonClasses("primary", "md", "w-full")}>Find providers</button>
              {!personalize ? (
                <p className="text-xs text-muted">
                  Tip: turn on <Link href="/settings#privacy" className="underline">personalized suggestions</Link> to pre-fill these from your preferences.
                </p>
              ) : null}
            </form>
          </CardBody>
        </Card>

        <section aria-labelledby="results-title" className="space-y-5">
          <h2 id="results-title" className="sr-only">Suggested providers</h2>
          {emergency ? (
            <Alert tone="danger" title="Please get urgent help" role="alert">
              <SafeMarkdown text={emergency} />
            </Alert>
          ) : null}
          {!submitted ? (
            <EmptyState icon={<Sparkles aria-hidden className="size-6" />} title="Describe what you need to get started" description="You'll see providers that fit, with a plain-language explanation for each suggestion." />
          ) : null}
          {submitted && !emergency ? (
            <>
              {specialties.length ? (
                <Card className="p-5">
                  <p className="text-sm font-semibold text-ink">
                    {source === "ai" ? "Kora AI suggests looking at:" : source === "rules" ? "Based on what you described, relevant care may include:" : "Showing:"}
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {specialties.map((s) => <li key={s}><Link href={`/providers?specialty=${s}`} className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-800 ring-1 ring-brand-200">{specName(s)}</Link></li>)}
                  </ul>
                  {ai?.summary ? <p className="mt-3 text-sm text-ink/85">{ai.summary}</p> : null}
                  {ai?.questions.length ? (
                    <div className="mt-3">
                      <p className="text-sm font-semibold text-ink">Questions you could ask a clinician</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink/85">{ai.questions.map((q) => <li key={q}>{q}</li>)}</ul>
                    </div>
                  ) : null}
                  <p className="mt-3 flex gap-2 text-xs text-muted">
                    <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                    {source === "ai" ? "AI-generated suggestion for navigation only — not a diagnosis. " : "Suggestions are for navigation only — not a diagnosis. "}
                    If you&apos;re unsure, primary care is a good first step.
                  </p>
                </Card>
              ) : null}
              {results.length ? (
                <ul className="grid gap-5 md:grid-cols-2">
                  {results.map((r) => (
                    <li key={r.provider.id}>
                      <ProviderCard provider={r.provider} reason={r.reasons.length ? r.reasons : undefined} />
                      {r.gaps.length ? <p className="mt-2 px-2 text-xs text-muted">Keep in mind: {r.gaps.join(" ")}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No providers match all of these preferences yet" description="Try removing a language or payment filter, choosing virtual care, or broadening the location." />
              )}
              <details className="rounded-2xl bg-canvas p-4 text-sm text-muted">
                <summary className="cursor-pointer font-semibold text-ink">How matching works</summary>
                <p className="mt-2">
                  Providers are ranked only on what you selected here: the type of care, visit type, location, language,
                  payment options and whether they&apos;re accepting new patients. Every reason shown is one of these.
                  Kora never uses race, ethnicity or other sensitive attributes to rank or match, and verification status
                  is shown but not used for ranking.
                </p>
              </details>
            </>
          ) : null}
        </section>
      </div>
    </>
  );
}
