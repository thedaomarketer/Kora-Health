import { BadgeCheck, CalendarCheck2, MessageCircle, Sparkles } from "lucide-react";

/**
 * Illustrative product composition for the hero. Uses clearly generic
 * placeholder content (no real people, no testimonials, no statistics).
 */
export function HeroVisual() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md select-none lg:max-w-none">
      <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-brand-100 via-canvas to-clay-100 blur-2xl" />
      <div className="relative grid gap-4">
        <div className="animate-fade-up rounded-3xl bg-white p-5 shadow-[var(--shadow-lift)] ring-1 ring-line/70">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-100 to-clay-100 font-bold text-brand-800">
              Dr
            </div>
            <div className="min-w-0 flex-1">
              <div className="h-3 w-32 rounded-full bg-stone-200" />
              <div className="mt-2 h-2.5 w-24 rounded-full bg-stone-100" />
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
              <BadgeCheck className="size-3.5" /> License verified
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {["Primary care", "Virtual", "English · French"].map((t) => (
              <span key={t} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800">
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="ml-6 animate-fade-up rounded-3xl bg-brand-800 p-5 text-white shadow-[var(--shadow-lift)] [animation-delay:120ms] sm:ml-12">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-100">
            <Sparkles className="size-4" /> Kora AI · navigation assistant
          </div>
          <p className="mt-3 text-sm leading-relaxed text-white/95">
            Based on what you shared, a <strong>primary care</strong> provider is a good first step. Here are three
            questions you could bring to your appointment…
          </p>
          <p className="mt-3 text-xs text-brand-100/80">General information only — not a diagnosis.</p>
        </div>

        <div className="mr-8 grid animate-fade-up grid-cols-2 gap-4 [animation-delay:240ms]">
          <div className="rounded-3xl bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-line/70">
            <CalendarCheck2 className="size-5 text-brand-700" />
            <p className="mt-2 text-sm font-semibold text-ink">Request sent</p>
            <p className="text-xs text-muted">Awaiting confirmation</p>
          </div>
          <div className="rounded-3xl bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-line/70">
            <MessageCircle className="size-5 text-clay-600" />
            <p className="mt-2 text-sm font-semibold text-ink">Secure message</p>
            <p className="text-xs text-muted">Only you and your provider</p>
          </div>
        </div>
      </div>
    </div>
  );
}
