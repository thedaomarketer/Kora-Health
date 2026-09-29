import Link from "next/link";
import { KoraLogo } from "@/components/brand/logo";
import { EMERGENCY_NOTE } from "@/lib/constants";

const columns = [
  {
    title: "Patients",
    links: [
      { href: "/providers", label: "Find a provider" },
      { href: "/ai", label: "Kora AI" },
      { href: "/sign-up", label: "Create an account" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
  {
    title: "Providers",
    links: [
      { href: "/for-providers", label: "Join as a provider" },
      { href: "/for-providers#verification", label: "How verification works" },
      { href: "/pricing", label: "Plans" },
    ],
  },
  {
    title: "Kora",
    links: [
      { href: "/about", label: "About" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/security", label: "Security" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-brand-950 text-brand-100">
      <div className="container-page py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-sm">
            <KoraLogo inverse />
            <p className="mt-4 text-sm leading-relaxed text-brand-100/80">
              A connected health community helping people find healthcare professionals, communicate securely and
              navigate their care.
            </p>
          </div>
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="text-sm font-semibold text-white">{col.title}</h2>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-brand-100/85 hover:text-white hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-12 border-t border-white/10 pt-6 text-xs leading-relaxed text-brand-100/75">
          <p className="max-w-3xl">{EMERGENCY_NOTE}</p>
          <p className="mt-3">
            Kora AI provides general information and navigation support only. It does not diagnose, treat or replace
            advice from a qualified healthcare professional.
          </p>
          <p className="mt-3">© {new Date().getFullYear()} Kora Health.</p>
        </div>
      </div>
    </footer>
  );
}
