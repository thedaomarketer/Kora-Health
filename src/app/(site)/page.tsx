import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  ClipboardList,
  Compass,
  FileLock2,
  HandHeart,
  HeartHandshake,
  KeyRound,
  Link2,
  MessagesSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRoundCheck,
  Users,
  Watch,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { ProviderCard } from "@/components/directory/provider-card";
import { HeroVisual } from "@/components/marketing/hero-visual";
import { HeroBackground } from "@/components/marketing/hero-background";
import { Reveal } from "@/components/marketing/reveal";
import { getReferenceData, searchProviders, type ProviderSummary, type ReferenceData } from "@/lib/directory";
import { asAnon } from "@/lib/db";
import { features } from "@/lib/env";
import { EMERGENCY_NOTE } from "@/lib/constants";

async function loadHomeData() {
  if (!features.database) return null;
  try {
    const [ref, featured, integrations] = await Promise.all([
      getReferenceData(),
      searchProviders({ accepting: "1" }),
      asAnon((q) => q<{ slug: string; name: string; description: string; status: string; category: string }>(
        `select slug, name, description, status, category from public.integrations order by sort_order`,
      )),
    ]);
    return { ref, featured: featured.providers.slice(0, 3), integrations };
  } catch (err) {
    console.error("[kora] home data unavailable", (err as Error).message);
    return null;
  }
}

export default async function HomePage() {
  const data = await loadHomeData();
  return (
    <>
      <Hero specialties={data?.ref.specialties ?? []} />
      <SpecialtyMarquee specialties={data?.ref.specialties ?? []} />
      <Reveal><SearchSection ref_={data?.ref ?? null} /></Reveal>
      <Reveal><AiSection /></Reveal>
      <Reveal><HowItWorks /></Reveal>
      <Reveal><FindProvider providers={data?.featured ?? []} /></Reveal>
      <Reveal><Specialties specialties={data?.ref.specialties ?? []} /></Reveal>
      <Reveal><ConnectedData integrations={data?.integrations ?? []} /></Reveal>
      <Reveal><ProviderOnboarding /></Reveal>
      <Reveal><PrivacySecurity /></Reveal>
      <Reveal><Community /></Reveal>
      <Reveal><Faq /></Reveal>
      <Reveal><FinalCta /></Reveal>
    </>
  );
}

function SectionHeading({ eyebrow, title, description, id }: { eyebrow: string; title: string; description?: string; id: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">{eyebrow}</p>
      <h2 id={id} className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        {title}
      </h2>
      {description ? <p className="mt-4 text-lg leading-relaxed text-muted">{description}</p> : null}
    </div>
  );
}

/* 1. Hero ------------------------------------------------------------------ */
function Hero({ specialties }: { specialties: ReferenceData["specialties"] }) {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      <HeroBackground />
      <div className="container-page grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:py-24">
        <div className="animate-fade-up">
          <Badge tone="clay" className="mb-5">
            <HeartHandshake aria-hidden className="size-3.5" /> A connected health community
          </Badge>
          <h1 id="hero-title" className="font-display text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl">
            Find care. Connect with professionals.{" "}
            <span className="text-shimmer">Navigate your health.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            Kora Health helps Black patients and communities discover healthcare professionals, request appointments,
            message securely and prepare for care — with you in control of your information.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ButtonLink href="/providers" size="lg">
              <Search aria-hidden className="size-5" /> Find a Provider
            </ButtonLink>
            <ButtonLink href="/ai" size="lg" variant="secondary">
              <Sparkles aria-hidden className="size-5 text-clay-600" /> Talk to Kora AI
            </ButtonLink>
            <ButtonLink href="/for-providers" size="lg" variant="ghost">
              Join as a Provider <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
          </div>
          {specialties.length ? (
            <div className="mt-10">
              <p className="text-sm font-medium text-muted">Popular searches</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {specialties.slice(0, 6).map((s) => (
                  <li key={s.slug}>
                    <Link
                      href={`/providers?specialty=${s.slug}`}
                      className="inline-flex min-h-9 items-center rounded-full bg-white px-3.5 text-sm font-medium text-ink ring-1 ring-line hover:ring-brand-300 hover:text-brand-800"
                    >
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <HeroVisual />
      </div>
    </section>
  );
}


function SpecialtyMarquee({ specialties }: { specialties: ReferenceData["specialties"] }) {
  if (specialties.length < 6) return null;
  const items = [...specialties, ...specialties];
  return (
    <div aria-hidden className="marquee-wrap relative border-y border-line/60 bg-white/60 py-4 backdrop-blur">
      <div className="mx-auto flex max-w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <ul className="marquee flex shrink-0 gap-3 pr-3">
          {items.map((s, i) => (
            <li key={`${s.slug}-${i}`} className="whitespace-nowrap rounded-full bg-white px-4 py-1.5 text-sm font-medium text-brand-800 ring-1 ring-brand-100">
              {s.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* 2. Search ---------------------------------------------------------------- */
function SearchSection({ ref_ }: { ref_: ReferenceData | null }) {
  return (
    <section aria-labelledby="search-title" className="container-page -mt-4 pb-16">
      <div className="rounded-[2rem] bg-white p-6 shadow-[var(--shadow-lift)] ring-1 ring-line/70 sm:p-8">
        <h2 id="search-title" className="text-xl font-semibold text-ink">
          Search healthcare professionals
        </h2>
        <form action="/providers" method="get" className="mt-5 grid gap-4 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end">
          <div>
            <label htmlFor="home-q" className="block text-sm font-semibold text-ink">
              What do you need help with?
            </label>
            <input
              id="home-q"
              name="q"
              placeholder="e.g. therapist, blood pressure, dentist"
              className="mt-1.5 block min-h-12 w-full rounded-xl border-0 px-4 ring-1 ring-inset ring-line placeholder:text-stone-500 focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="home-specialty" className="block text-sm font-semibold text-ink">
              Specialty
            </label>
            <select
              id="home-specialty"
              name="specialty"
              className="mt-1.5 block min-h-12 w-full rounded-xl border-0 px-4 ring-1 ring-inset ring-line focus:ring-2 focus:ring-brand-500 focus:outline-none"
            >
              <option value="">Any specialty</option>
              {ref_?.specialties.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="home-city" className="block text-sm font-semibold text-ink">
              City
            </label>
            <input
              id="home-city"
              name="city"
              placeholder="e.g. Toronto"
              autoComplete="address-level2"
              className="mt-1.5 block min-h-12 w-full rounded-xl border-0 px-4 ring-1 ring-inset ring-line placeholder:text-stone-500 focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>
          <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-700 px-6 font-semibold text-white hover:bg-brand-800">
            <Search aria-hidden className="size-5" /> Search
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link href="/providers?care=virtual" className="font-medium text-brand-700 hover:underline">
            Virtual care
          </Link>
          <Link href="/providers?accepting=1" className="font-medium text-brand-700 hover:underline">
            Accepting new patients
          </Link>
          <Link href="/providers?verified=1" className="font-medium text-brand-700 hover:underline">
            License-verified only
          </Link>
        </div>
      </div>
    </section>
  );
}

/* 3. AI assistant ---------------------------------------------------------- */
function AiSection() {
  const can = [
    "Organize what you want to discuss with a clinician",
    "Suggest which type of professional may be relevant",
    "Explain general healthcare terms in plain language",
    "Help you prepare questions for your appointment",
    "Guide you around Kora and find providers",
  ];
  const cannot = ["Diagnose conditions", "Prescribe or change medication", "Replace a healthcare professional", "Handle emergencies"];
  return (
    <section aria-labelledby="ai-title" className="bg-brand-900 py-20 text-white">
      <div className="container-page grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-clay-200">Kora AI</p>
          <h2 id="ai-title" className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            A health navigation assistant — not a doctor
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-brand-100">
            Kora AI helps you make sense of your next step. It asks structured follow-up questions, organizes what you
            share, and points you toward the right kind of care. It is clear about its limits and directs you to
            emergency services when something could be urgent.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/ai" variant="inverse" size="lg">
              <Sparkles aria-hidden className="size-5" /> Talk to Kora AI
            </ButtonLink>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/15">
            <h3 className="font-semibold text-white">Kora AI can</h3>
            <ul className="mt-4 space-y-3 text-sm text-brand-100">
              {can.map((c) => (
                <li key={c} className="flex gap-2">
                  <BadgeCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-300" /> {c}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/15">
            <h3 className="font-semibold text-white">Kora AI will not</h3>
            <ul className="mt-4 space-y-3 text-sm text-brand-100">
              {cannot.map((c) => (
                <li key={c} className="flex gap-2">
                  <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-clay-300" /> {c}
                </li>
              ))}
            </ul>
            <p className="mt-5 rounded-2xl bg-clay-600/30 p-3 text-xs leading-relaxed text-white">{EMERGENCY_NOTE}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* 4. How it works ---------------------------------------------------------- */
function HowItWorks() {
  const steps = [
    { Icon: Compass, title: "Discover", text: "Search professionals by specialty, location, language, care type and more." },
    { Icon: HeartHandshake, title: "Connect", text: "Save providers, request an appointment and message securely once connected." },
    { Icon: Sparkles, title: "Understand", text: "Use Kora AI to organize your concerns and prepare questions — in plain language." },
    { Icon: CalendarCheck2, title: "Access care", text: "Get confirmations, reminders and details for virtual or in-person visits." },
  ];
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="container-page scroll-mt-20 py-20">
      <SectionHeading id="how-title" eyebrow="How Kora works" title="From first search to your appointment" />
      <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(({ Icon, title, text }, i) => (
          <li key={title} className="relative rounded-3xl bg-white p-6 shadow-[var(--shadow-card)] ring-1 ring-line/70">
            <span className="text-sm font-semibold text-clay-600">Step {i + 1}</span>
            <Icon aria-hidden className="mt-3 size-7 text-brand-700" />
            <h3 className="mt-3 text-lg font-semibold text-ink">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* 5. Find a provider ------------------------------------------------------- */
function FindProvider({ providers }: { providers: ProviderSummary[] }) {
  return (
    <section aria-labelledby="find-title" className="bg-white py-20">
      <div className="container-page">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            id="find-title"
            eyebrow="Find a provider"
            title="Profiles built for informed choices"
            description="Every profile shows profession, specialties, languages, care options and — importantly — whether Kora has verified the provider's license."
          />
          <ButtonLink href="/providers" variant="secondary">
            Browse the directory <ArrowRight aria-hidden className="size-4" />
          </ButtonLink>
        </div>
        {providers.length ? (
          <>
            {providers.some((p) => p.is_demo) ? (
              <Alert tone="info" className="mt-8">
                You&apos;re viewing a development environment. Profiles marked &ldquo;Sample profile&rdquo; are fictional and
                shown for testing only.
              </Alert>
            ) : null}
            <ul className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {providers.map((p) => (
                <li key={p.id}>
                  <ProviderCard provider={p} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-8 rounded-3xl bg-canvas p-8 text-center text-muted">
            The directory is opening soon. Providers are joining and completing verification.
          </p>
        )}
      </div>
    </section>
  );
}

/* 6. Specialties ----------------------------------------------------------- */
function Specialties({ specialties }: { specialties: ReferenceData["specialties"] }) {
  if (!specialties.length) return null;
  return (
    <section aria-labelledby="spec-title" className="container-page py-20">
      <SectionHeading id="spec-title" eyebrow="Healthcare specialties" title="Care for every part of your health" />
      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {specialties.slice(0, 16).map((s) => (
          <li key={s.slug}>
            <Link
              href={`/providers?specialty=${s.slug}`}
              className="group flex h-full flex-col rounded-2xl bg-white p-4 ring-1 ring-line/80 transition hover:ring-brand-300 hover:shadow-[var(--shadow-card)]"
            >
              <span className="font-semibold text-ink group-hover:text-brand-800">{s.name}</span>
              <span className="mt-1 line-clamp-2 text-sm text-muted">{s.description}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/providers" className="mt-6 inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
        See all specialties <ArrowRight aria-hidden className="size-4" />
      </Link>
    </section>
  );
}

/* 7. Connected health data ------------------------------------------------- */
function ConnectedData({ integrations }: { integrations: { slug: string; name: string; description: string; status: string }[] }) {
  return (
    <section aria-labelledby="data-title" className="bg-gradient-to-b from-brand-50 to-canvas py-20">
      <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <SectionHeading
            id="data-title"
            eyebrow="Connected health data"
            title="Your information, on your terms"
            description="Keep track of allergies, medications and notes today. Connections to health apps, wearables and records are being built with explicit consent, clear permissions and one-tap disconnect."
          />
          <ul className="mt-8 space-y-3 text-sm text-ink">
            {[
              [KeyRound, "You choose exactly what to share — permission by permission."],
              [Link2, "Disconnect any time and delete imported data."],
              [ClipboardList, "See a history of every connection and permission change."],
            ].map(([Icon, text]) => {
              const I = Icon as typeof KeyRound;
              return (
                <li key={text as string} className="flex gap-3">
                  <I aria-hidden className="size-5 shrink-0 text-brand-700" /> {text as string}
                </li>
              );
            })}
          </ul>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {(integrations.length
            ? integrations.slice(0, 6)
            : [{ slug: "x", name: "Health apps & wearables", description: "Planned integrations.", status: "coming_soon" }]
          ).map((i) => (
            <li key={i.slug} className="rounded-2xl bg-white p-5 ring-1 ring-line/80">
              <div className="flex items-start justify-between gap-2">
                <Watch aria-hidden className="size-5 text-brand-700" />
                <Badge tone={i.status === "available" ? "success" : "neutral"}>{i.status === "available" ? "Available" : "Coming soon"}</Badge>
              </div>
              <p className="mt-3 font-semibold text-ink">{i.name}</p>
              <p className="mt-1 text-sm text-muted">{i.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* 8. Provider onboarding --------------------------------------------------- */
function ProviderOnboarding() {
  const steps = [
    { Icon: UserRoundCheck, title: "Create your profile", text: "Profession, specialties, languages, services and where you practice." },
    { Icon: ShieldCheck, title: "Get verified", text: "Submit your license. Kora staff check it against the regulator's public register." },
    { Icon: CalendarCheck2, title: "Set availability", text: "Share weekly hours for virtual or in-person visits and receive requests." },
    { Icon: MessagesSquare, title: "Connect with patients", text: "Confirm appointments and communicate through secure messaging." },
  ];
  return (
    <section aria-labelledby="prov-title" className="container-page py-20">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:items-center">
        <div>
          <SectionHeading
            id="prov-title"
            eyebrow="For healthcare professionals"
            title="Be found by the communities you serve"
            description="Join a directory designed around trust: verified credentials, transparent profiles and patient-controlled communication."
          />
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/sign-up?role=provider" size="lg">
              <Stethoscope aria-hidden className="size-5" /> Join as a Provider
            </ButtonLink>
            <ButtonLink href="/for-providers" size="lg" variant="secondary">
              Learn more
            </ButtonLink>
          </div>
        </div>
        <ol className="grid gap-4 sm:grid-cols-2">
          {steps.map(({ Icon, title, text }) => (
            <li key={title} className="rounded-3xl bg-white p-6 ring-1 ring-line/80">
              <Icon aria-hidden className="size-6 text-clay-600" />
              <h3 className="mt-3 font-semibold text-ink">{title}</h3>
              <p className="mt-1.5 text-sm text-muted">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* 9. Privacy & security ---------------------------------------------------- */
function PrivacySecurity() {
  const items = [
    { Icon: FileLock2, title: "Private by design", text: "Your profile, health information and messages are visible only to you — and messages only to the provider you're talking to." },
    { Icon: ShieldCheck, title: "Enforced at the database", text: "Access rules are enforced in the database itself, not just the app, and every sensitive action is logged." },
    { Icon: KeyRound, title: "Consent you control", text: "Separate, revocable consent for Kora AI, stored health information and personalization." },
    { Icon: HandHeart, title: "Delete anytime", text: "Delete your account and associated data from your settings at any time." },
  ];
  return (
    <section aria-labelledby="privacy-title" className="bg-white py-20">
      <div className="container-page">
        <SectionHeading
          id="privacy-title"
          eyebrow="Privacy & security"
          title="Health information deserves the highest care"
          description="Kora collects only what's needed to help you find and access care. Information is encrypted in transit and stored on infrastructure that encrypts data at rest."
        />
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ Icon, title, text }) => (
            <li key={title}>
              <div className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                <Icon aria-hidden className="size-6" />
              </div>
              <h3 className="mt-4 font-semibold text-ink">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
            </li>
          ))}
        </ul>
        <Link href="/security" className="mt-8 inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
          How we protect your information <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    </section>
  );
}

/* 10. Community ------------------------------------------------------------ */
function Community() {
  return (
    <section aria-labelledby="community-title" className="container-page py-20">
      <div className="overflow-hidden rounded-[2rem] bg-clay-50 p-8 ring-1 ring-clay-100 sm:p-12">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-clay-700">Community</p>
            <h2 id="community-title" className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Healthcare navigation, built with community at the centre
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-ink/80">
              Kora is designed for people who want to find professionals they feel comfortable with, in languages they
              speak, with information presented clearly and respectfully. Patients choose providers based on the
              information that matters to them.
            </p>
          </div>
          <ul className="grid gap-4">
            {[
              [Users, "Patient-led choice", "Filter by what matters to you — language, care type, location and more. Kora never ranks providers by race or ethnicity."],
              [HeartHandshake, "Respectful communication", "Community guidelines and reporting tools keep conversations safe for patients and professionals."],
              [Sparkles, "Plain-language resources", "Health information that explains, without judgement or jargon."],
            ].map(([Icon, title, text]) => {
              const I = Icon as typeof Users;
              return (
                <li key={title as string} className="flex gap-4 rounded-2xl bg-white/80 p-5">
                  <I aria-hidden className="size-6 shrink-0 text-clay-600" />
                  <div>
                    <h3 className="font-semibold text-ink">{title as string}</h3>
                    <p className="mt-1 text-sm text-muted">{text as string}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* 11. FAQ ------------------------------------------------------------------ */
const FAQ = [
  {
    q: "Is Kora Health a healthcare provider?",
    a: "No. Kora is a platform that helps you find healthcare professionals, request appointments and communicate securely. Care is provided by the independent professionals listed on Kora.",
  },
  {
    q: "What does “License verified” mean?",
    a: "It means Kora staff confirmed the provider's professional license or registration with the issuing regulator's public register — that the license exists, is active, matches the provider's name and the jurisdiction listed. It is not a rating of clinical quality. Profiles that haven't completed this check are clearly labelled.",
  },
  {
    q: "Can Kora AI diagnose me or recommend medication?",
    a: "No. Kora AI provides general health information and helps you navigate care. It doesn't diagnose, prescribe, change medication or replace a healthcare professional. If something may be urgent, it will direct you to emergency or urgent care.",
  },
  {
    q: "Who can see my information?",
    a: "Your profile and health information are private to you. When you request an appointment, the provider sees your name and the note you choose to include. Messages are visible only to you and that provider. Kora staff cannot browse your health information.",
  },
  {
    q: "Does Kora cost anything for patients?",
    a: "Creating a patient account, searching the directory, requesting appointments and messaging are free. Fees for care itself are set by providers and are shown on their profiles where provided.",
  },
  {
    q: "Can I delete my account?",
    a: "Yes. You can delete your account and associated information at any time from your settings.",
  },
];

function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="bg-white py-20">
      <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.6fr]">
        <SectionHeading id="faq-title" eyebrow="FAQ" title="Questions, answered" />
        <div className="divide-y divide-line rounded-3xl ring-1 ring-line">
          {FAQ.map((item) => (
            <details key={item.q} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink">
                {item.q}
                <span aria-hidden className="text-xl text-brand-700 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 leading-relaxed text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* 12. CTA ------------------------------------------------------------------ */
function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="container-page py-20">
      <div className="relative overflow-hidden rounded-[2rem] bg-brand-800 px-6 py-14 text-center text-white sm:px-12">
        <div aria-hidden className="absolute -right-24 -top-24 size-72 rounded-full bg-brand-600/40 blur-3xl" />
        <div aria-hidden className="absolute -bottom-24 -left-24 size-72 rounded-full bg-clay-500/30 blur-3xl" />
        <h2 id="cta-title" className="relative font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Your next step in care starts here
        </h2>
        <p className="relative mx-auto mt-4 max-w-xl text-lg text-brand-100">
          Create a free account to save providers, request appointments and message securely.
        </p>
        <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href="/providers" variant="inverse" size="lg">
            Find a Provider
          </ButtonLink>
          <ButtonLink href="/sign-up" variant="accent" size="lg">
            Create free account
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
