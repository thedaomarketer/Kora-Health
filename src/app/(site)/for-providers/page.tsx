import type { Metadata } from "next";
import { BadgeCheck, CalendarCheck2, ClipboardCheck, MessagesSquare, ShieldCheck, UserRoundCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "For healthcare professionals",
  description: "Join Kora Health to be discovered by patients, receive appointment requests and communicate securely.",
};

const features = [
  { Icon: UserRoundCheck, title: "A profile patients can trust", text: "Show your profession, specialties, languages, services, locations and payment options in one clear profile." },
  { Icon: CalendarCheck2, title: "Appointment requests on your terms", text: "Publish weekly hours for virtual or in-person visits. You confirm or decline every request." },
  { Icon: MessagesSquare, title: "Secure messaging", text: "Message patients who have requested care with you. Conversations are private to you and the patient." },
  { Icon: ClipboardCheck, title: "Simple practice dashboard", text: "See requests, upcoming appointments, messages and profile activity at a glance." },
];

export default function ForProvidersPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-brand-50 to-canvas">
        <div className="container-page py-16 sm:py-24">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">For healthcare professionals</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            Be found by the patients and communities you serve
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            Kora connects patients with physicians, nurses, therapists, dentists, pharmacists, dietitians and other
            professionals — with verified credentials and privacy built in.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/sign-up?role=provider" size="lg">Join as a Provider</ButtonLink>
            <ButtonLink href="#verification" size="lg" variant="secondary">How verification works</ButtonLink>
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <ul className="grid gap-6 sm:grid-cols-2">
          {features.map(({ Icon, title, text }) => (
            <li key={title} className="rounded-3xl bg-white p-6 ring-1 ring-line/80">
              <Icon aria-hidden className="size-7 text-brand-700" />
              <h2 className="mt-4 text-lg font-semibold text-ink">{title}</h2>
              <p className="mt-2 text-muted">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="verification" className="scroll-mt-20 bg-white py-16">
        <div className="container-page grid gap-10 lg:grid-cols-2">
          <div>
            <ShieldCheck aria-hidden className="size-9 text-brand-700" />
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink">How verification works</h2>
            <p className="mt-4 text-muted">
              Kora never displays a provider as verified unless our team has completed the verification checklist.
              Verification confirms credentials — it is not an endorsement or a rating of clinical quality.
            </p>
          </div>
          <ol className="space-y-4">
            {[
              ["Submit your credentials", "Add your license or registration: issuing regulator, jurisdiction and number. You can attach supporting documents."],
              ["Kora reviews them", "A Kora verifier checks the regulator's public register and confirms that the license exists, is active, matches your name and the jurisdiction."],
              ["Your badge updates", "Approved profiles show “License verified” with the date. Until then, your profile shows “Verification pending”."],
              ["Changes trigger re-review", "If you edit your credentials after verification, your profile returns to pending until it's reviewed again."],
            ].map(([title, text], i) => (
              <li key={title} className="flex gap-4 rounded-2xl bg-canvas p-5">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-700 text-sm font-bold text-white">{i + 1}</span>
                <div>
                  <h3 className="font-semibold text-ink">{title}</h3>
                  <p className="mt-1 text-sm text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container-page py-16 text-center">
        <BadgeCheck aria-hidden className="mx-auto size-10 text-brand-700" />
        <h2 className="mt-4 font-display text-3xl font-semibold text-ink">Ready to join?</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted">Creating a provider profile is free while Kora is in early access.</p>
        <ButtonLink href="/sign-up?role=provider" size="lg" className="mt-6">Create your provider account</ButtonLink>
      </section>
    </>
  );
}
